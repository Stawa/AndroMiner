package com.androminer.dashboard;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "DeviceStatus")
public class DeviceStatusPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        Intent batteryIntent =
                getContext()
                        .registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        TemperatureReading temperature = getBestPhoneTemperature(batteryIntent);
        HardwareInfo cpu = getCpuHardwareInfo();
        HardwareInfo gpu = getGpuHardwareInfo();
        PowerReading power = getPowerReading(batteryIntent);

        result.put("batteryLevel", getBatteryLevel(batteryIntent));
        result.put("isCharging", isCharging(batteryIntent));
        if (power != null) {
            result.put("batteryCurrentMa", power.currentMa);
            result.put("batteryVoltageV", power.voltageV);
            result.put("powerDrawW", power.powerW);
        }
        result.put("cpuThreads", Runtime.getRuntime().availableProcessors());
        result.put("cpuName", cpu.name);
        result.put("cpuClockGhz", cpu.clockValue);
        result.put("cpuClockLabel", cpu.clockLabel);
        Double cpuMaxClockGhz = readMaxCpuClockGhz();
        result.put("cpuMaxClockGhz", cpuMaxClockGhz);
        result.put(
                "cpuMaxClockLabel",
                cpuMaxClockGhz == null ? "-" : String.format(Locale.US, "%.2f GHz", cpuMaxClockGhz));
        result.put("gpuName", gpu.name);
        if (temperature != null) {
            result.put("temperatureC", temperature.valueC);
            result.put("temperatureSource", temperature.source);
            result.put("temperatureSensor", temperature.sensorName);
        }
        result.put("thermalStatus", getThermalStatus(temperature));
        call.resolve(result);
    }

    private Double getBatteryLevel(Intent batteryIntent) {
        if (batteryIntent == null) {
            return null;
        }

        int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);

        if (level < 0 || scale <= 0) {
            return null;
        }

        return (double) level / (double) scale;
    }

    static String safetyViolation(
            Context context, JSObject config, int batteryFloor, boolean chargingOnly) {
        return safetyObservation(context, config, batteryFloor, chargingOnly).reason;
    }

    static final class SafetyObservation {
        final String reason;
        final JSObject details;

        SafetyObservation(String reason, JSObject details) {
            this.reason = reason;
            this.details = details;
        }
    }

    static SafetyObservation safetyObservation(
            Context context, JSObject config, int batteryFloor, boolean chargingOnly) {
        DeviceStatusPlugin reader = new DeviceStatusPlugin();
        Intent battery =
                context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        TemperatureReading reading = reader.getBestPhoneTemperature(battery);
        Double level = reader.getBatteryLevel(battery);
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        int severity =
                Build.VERSION.SDK_INT >= 29 && power != null ? power.getCurrentThermalStatus() : 0;
        String reason =
                MiningSafety.violation(
                        reading == null ? null : reading.valueC,
                        level == null ? null : level * 100,
                        reader.isCharging(battery),
                        severity,
                        MiningSafety.clampTemperatureLimit(config.getInteger("thermalThreshold", 42)),
                        MiningSafety.clampBatteryFloor(batteryFloor),
                        chargingOnly);
        if (reason == null
                && config.optBoolean("autoPauseScreenOff", false)
                && power != null
                && !power.isInteractive()) reason = "Mining paused when the screen turned off.";
        JSObject details = new JSObject();
        details.put("at", System.currentTimeMillis());
        details.put("temperatureC", reading == null ? org.json.JSONObject.NULL : reading.valueC);
        details.put("temperatureSource", reading == null ? "unavailable" : reading.source);
        details.put("sensorName", reading == null ? org.json.JSONObject.NULL : reading.sensorName);
        Double batteryTemperature = reader.getBatteryTemperatureC(battery);
        details.put(
                "batteryTemperatureC",
                batteryTemperature == null ? org.json.JSONObject.NULL : batteryTemperature);
        details.put("batteryPercent", level == null ? org.json.JSONObject.NULL : level * 100);
        details.put("charging", reader.isCharging(battery));
        details.put(
                "thermalStatus", Build.VERSION.SDK_INT >= 29 ? severity : org.json.JSONObject.NULL);
        details.put(
                "temperatureLimitC",
                MiningSafety.clampTemperatureLimit(config.optInt("thermalThreshold", 42)));
        details.put("batteryFloorPercent", MiningSafety.clampBatteryFloor(batteryFloor));
        details.put("chargingOnly", chargingOnly);
        details.put("action", reason == null ? "continue" : "stop");
        return new SafetyObservation(reason, details);
    }

    private boolean isCharging(Intent batteryIntent) {
        if (batteryIntent == null) {
            return false;
        }

        int status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        int plugged = batteryIntent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);

        return status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL
                || plugged != 0;
    }

    private PowerReading getPowerReading(Intent batteryIntent) {
        BatteryManager batteryManager =
                (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
        if (batteryManager == null || batteryIntent == null) {
            return null;
        }

        long currentMicroamps =
                batteryManager.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
        int voltageMillivolts = batteryIntent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1);

        if (currentMicroamps == Long.MIN_VALUE || currentMicroamps == 0 || voltageMillivolts <= 0) {
            return null;
        }

        double currentMa = Math.abs(currentMicroamps) / 1000.0;
        double voltageV = voltageMillivolts / 1000.0;
        double powerW = currentMa * voltageV / 1000.0;

        if (!Double.isFinite(powerW) || powerW <= 0) {
            return null;
        }

        return new PowerReading(currentMa, voltageV, powerW);
    }

    private Double getBatteryTemperatureC(Intent batteryIntent) {
        if (batteryIntent == null) {
            return null;
        }

        int temperature =
                batteryIntent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
        if (temperature == Integer.MIN_VALUE) {
            return null;
        }

        return temperature / 10.0;
    }

    private TemperatureReading getBestPhoneTemperature(Intent batteryIntent) {
        List<TemperatureReading> readings = getThermalZoneReadings();
        TemperatureReading skinOrBody =
                medianReading(filterByClass(readings, SensorClass.SKIN_OR_BODY));
        if (skinOrBody != null) {
            return skinOrBody;
        }

        TemperatureReading batteryZone =
                medianReading(filterByClass(readings, SensorClass.BATTERY));
        if (batteryZone != null) {
            return batteryZone;
        }

        Double batteryIntentTemperature = getBatteryTemperatureC(batteryIntent);
        if (batteryIntentTemperature != null) {
            return new TemperatureReading(batteryIntentTemperature, "battery", "battery-intent");
        }

        TemperatureReading cpuOrSoc =
                medianReading(filterByClass(readings, SensorClass.CPU_OR_SOC));
        if (cpuOrSoc != null) {
            return cpuOrSoc;
        }

        return medianReading(readings);
    }

    private List<TemperatureReading> getThermalZoneReadings() {
        File thermalDirectory = new File("/sys/class/thermal");
        File[] zones = thermalDirectory.listFiles();
        List<TemperatureReading> readings = new ArrayList<>();

        if (zones == null) {
            return readings;
        }

        for (File zone : zones) {
            String name = zone.getName();
            if (!name.startsWith("thermal_zone")) {
                continue;
            }

            String type = readFirstLine(new File(zone, "type"));
            if (type == null) {
                continue;
            }

            Double temperature = readTemperature(new File(zone, "temp"));
            if (temperature != null) {
                SensorClass sensorClass = classifySensor(type);
                String source = sensorClass == SensorClass.BATTERY ? "battery" : "native";
                readings.add(new TemperatureReading(temperature, source, type.trim()));
            }
        }

        return readings;
    }

    private SensorClass classifySensor(String type) {
        String normalized = type.toLowerCase(Locale.ROOT);
        if (normalized.contains("battery")
                || normalized.contains("batt")
                || normalized.contains("bms")
                || normalized.contains("chg")) {
            return SensorClass.BATTERY;
        }
        if (normalized.contains("skin")
                || normalized.contains("case")
                || normalized.contains("shell")
                || normalized.contains("body")
                || normalized.contains("quiet")
                || normalized.contains("xo_therm")
                || normalized.contains("pa_therm")) {
            return SensorClass.SKIN_OR_BODY;
        }
        if (normalized.contains("cpu")
                || normalized.contains("soc")
                || normalized.contains("ap")
                || normalized.contains("tsens")
                || normalized.contains("cluster")
                || normalized.contains("core")) {
            return SensorClass.CPU_OR_SOC;
        }

        return SensorClass.OTHER;
    }

    private List<TemperatureReading> filterByClass(
            List<TemperatureReading> readings, SensorClass sensorClass) {
        List<TemperatureReading> filtered = new ArrayList<>();
        for (TemperatureReading reading : readings) {
            if (classifySensor(reading.sensorName) == sensorClass) {
                filtered.add(reading);
            }
        }

        return filtered;
    }

    private TemperatureReading medianReading(List<TemperatureReading> readings) {
        if (readings.isEmpty()) {
            return null;
        }

        Collections.sort(readings, (left, right) -> Double.compare(left.valueC, right.valueC));
        return readings.get(readings.size() / 2);
    }

    private Double readTemperature(File file) {
        String raw = readFirstLine(file);
        if (raw == null) {
            return null;
        }

        try {
            double value = Double.parseDouble(raw.trim());
            if (value > 1000) {
                value = value / 1000.0;
            }
            if (value < 0 || value > 125) {
                return null;
            }
            return value;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String readFirstLine(File file) {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return reader.readLine();
        } catch (IOException exception) {
            return null;
        }
    }

    private String getThermalStatus(TemperatureReading temperature) {
        String systemStatus = getSystemThermalStatus();

        if (temperature == null) {
            return systemStatus;
        }

        String sensorClass = classifySensor(temperature.sensorName).name();
        double value = temperature.valueC;
        if (sensorClass.equals(SensorClass.CPU_OR_SOC.name())) {
            if (value >= 78) {
                return "hot";
            }
            if (value >= 68) {
                return "warm";
            }
            if (value < 42) {
                return "cool";
            }
        } else {
            if (value >= 46) {
                return "hot";
            }
            if (value >= 40) {
                return "warm";
            }
            if (value < 30) {
                return "cool";
            }
        }

        if (systemStatus.equals("hot") || systemStatus.equals("warm")) {
            return systemStatus;
        }

        return "normal";
    }

    private String getSystemThermalStatus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return "unknown";
        }

        PowerManager powerManager =
                (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) {
            return "unknown";
        }

        int status = powerManager.getCurrentThermalStatus();
        if (status == PowerManager.THERMAL_STATUS_NONE) {
            return "normal";
        }
        if (status == PowerManager.THERMAL_STATUS_LIGHT) {
            return "warm";
        }
        if (status == PowerManager.THERMAL_STATUS_MODERATE) {
            return "warm";
        }
        if (status == PowerManager.THERMAL_STATUS_SEVERE
                || status == PowerManager.THERMAL_STATUS_CRITICAL
                || status == PowerManager.THERMAL_STATUS_EMERGENCY
                || status == PowerManager.THERMAL_STATUS_SHUTDOWN) {
            return "hot";
        }

        return "unknown";
    }

    private HardwareInfo getCpuHardwareInfo() {
        String name =
                firstMeaningful(
                        getSocName(),
                        readCpuInfoValue("Hardware"),
                        readCpuInfoValue("model name"),
                        readCpuInfoValue("Processor"),
                        Build.HARDWARE,
                        Build.BOARD);
        Double clockGhz = readBestCpuClockGhz();

        return new HardwareInfo(
                cleanHardwareName(name, "CPU"),
                clockGhz,
                clockGhz == null ? "-" : String.format(Locale.US, "%.2f GHz", clockGhz));
    }

    private HardwareInfo getGpuHardwareInfo() {
        String name =
                firstMeaningful(
                        readFirstLine(new File("/sys/class/kgsl/kgsl-3d0/gpu_model")),
                        findDevfreqGpuName(),
                        inferGpuFamilyName());
        return new HardwareInfo(cleanHardwareName(name, "GPU"), null, "-");
    }

    private String getSocName() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return null;
        }

        return firstMeaningful(
                joinHardwareName(Build.SOC_MANUFACTURER, Build.SOC_MODEL),
                Build.SOC_MODEL,
                Build.SOC_MANUFACTURER);
    }

    private String joinHardwareName(String manufacturer, String model) {
        String left = manufacturer == null ? "" : manufacturer.trim();
        String right = model == null ? "" : model.trim();

        if (left.isEmpty()) {
            return right;
        }
        if (right.isEmpty()) {
            return left;
        }
        if (right.toLowerCase(Locale.US).contains(left.toLowerCase(Locale.US))) {
            return right;
        }

        return left + " " + right;
    }

    private String readCpuInfoValue(String key) {
        File cpuInfo = new File("/proc/cpuinfo");
        try (BufferedReader reader = new BufferedReader(new FileReader(cpuInfo))) {
            String line;
            while ((line = reader.readLine()) != null) {
                int split = line.indexOf(':');
                if (split <= 0) {
                    continue;
                }

                String candidateKey = line.substring(0, split).trim();
                if (!candidateKey.equalsIgnoreCase(key)) {
                    continue;
                }

                String value = line.substring(split + 1).trim();
                if (isMeaningful(value)) {
                    return value;
                }
            }
        } catch (IOException ignored) {

        }

        return null;
    }

    /** Current (live) frequency of the fastest core. */
    private Double readBestCpuClockGhz() {
        File[] cpuEntries = new File("/sys/devices/system/cpu").listFiles();
        long bestKhz = -1;

        if (cpuEntries == null) {
            return null;
        }

        for (File cpuEntry : cpuEntries) {
            if (!cpuEntry.getName().matches("cpu\\d+")) {
                continue;
            }

            bestKhz =
                    Math.max(
                            bestKhz,
                            readFirstFrequencyKhz(
                                    new File(cpuEntry, "cpufreq/scaling_cur_freq"),
                                    new File(cpuEntry, "cpufreq/cpuinfo_cur_freq")));
        }

        return bestKhz > 0 ? bestKhz / 1_000_000.0 : null;
    }

    /** Hardware maximum of the fastest core; unlike the live clock it never changes. */
    private Double readMaxCpuClockGhz() {
        File[] cpuEntries = new File("/sys/devices/system/cpu").listFiles();
        long bestKhz = -1;

        if (cpuEntries == null) {
            return null;
        }

        for (File cpuEntry : cpuEntries) {
            if (!cpuEntry.getName().matches("cpu\\d+")) {
                continue;
            }

            long khz = readFirstFrequencyKhz(new File(cpuEntry, "cpufreq/cpuinfo_max_freq"));
            if (khz <= 0) {
                khz = readFirstFrequencyKhz(new File(cpuEntry, "cpufreq/scaling_max_freq"));
            }
            bestKhz = Math.max(bestKhz, khz);
        }

        return bestKhz > 0 ? bestKhz / 1_000_000.0 : null;
    }

    private String findDevfreqGpuName() {
        File devfreqDirectory = new File("/sys/class/devfreq");
        File[] entries = devfreqDirectory.listFiles();

        if (entries == null) {
            return null;
        }

        for (File entry : entries) {
            String descriptor =
                    (entry.getName()
                                    + " "
                                    + readNullable(new File(entry, "name"))
                                    + " "
                                    + readNullable(new File(entry, "device/name")))
                            .toLowerCase(Locale.US);
            if (!looksLikeGpuDescriptor(descriptor)) {
                continue;
            }

            return firstMeaningful(
                    readFirstLine(new File(entry, "gpu_model")),
                    readFirstLine(new File(entry, "name")),
                    entry.getName());
        }

        return null;
    }

    private long readFirstFrequencyKhz(File... files) {
        for (File file : files) {
            Long raw = readLong(file);
            if (raw == null || raw <= 0) {
                continue;
            }

            return raw > 10_000_000L ? raw / 1000L : raw;
        }

        return -1;
    }

    private Long readLong(File file) {
        String raw = readFirstLine(file);
        if (raw == null) {
            return null;
        }

        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String inferGpuFamilyName() {
        String hardware = (Build.HARDWARE == null ? "" : Build.HARDWARE).toLowerCase(Locale.US);
        String board = (Build.BOARD == null ? "" : Build.BOARD).toLowerCase(Locale.US);
        String combined = hardware + " " + board;

        if (combined.contains("qcom")
                || combined.contains("qualcomm")
                || combined.contains("kgsl")) {
            return "Adreno GPU";
        }
        if (combined.contains("mali") || combined.contains("mt") || combined.contains("exynos")) {
            return "Mali GPU";
        }
        if (combined.contains("powervr") || combined.contains("img")) {
            return "PowerVR GPU";
        }

        return null;
    }

    private boolean looksLikeGpuDescriptor(String descriptor) {
        return descriptor.contains("gpu")
                || descriptor.contains("kgsl")
                || descriptor.contains("adreno")
                || descriptor.contains("mali")
                || descriptor.contains("powervr")
                || descriptor.contains("3d");
    }

    private String readNullable(File file) {
        String value = readFirstLine(file);
        return value == null ? "" : value;
    }

    private String firstMeaningful(String... values) {
        for (String value : values) {
            if (isMeaningful(value)) {
                return value.trim();
            }
        }

        return null;
    }

    private boolean isMeaningful(String value) {
        if (value == null) {
            return false;
        }

        String normalized = value.trim();
        return !normalized.isEmpty()
                && !normalized.equals("0")
                && !normalized.equalsIgnoreCase("unknown")
                && !normalized.equalsIgnoreCase("null");
    }

    private String cleanHardwareName(String value, String fallback) {
        String cleaned = isMeaningful(value) ? value.trim() : fallback;
        cleaned = cleaned.replace('\t', ' ').replace('_', ' ').replaceAll("\\s+", " ");
        cleaned = cleaned.replace("Qualcomm Technologies, Inc", "Qualcomm");

        if (cleaned.toLowerCase(Locale.US).contains("kgsl")) {
            return "Adreno GPU";
        }
        if (cleaned.toLowerCase(Locale.US).contains("mali")) {
            return cleaned.toUpperCase(Locale.US).contains("MALI")
                    ? cleaned
                    : cleaned.replace("mali", "Mali");
        }

        return cleaned;
    }

    private enum SensorClass {
        BATTERY,
        SKIN_OR_BODY,
        CPU_OR_SOC,
        OTHER
    }

    private static class TemperatureReading {

        final double valueC;
        final String source;
        final String sensorName;

        TemperatureReading(double valueC, String source, String sensorName) {
            this.valueC = valueC;
            this.source = source;
            this.sensorName = sensorName;
        }
    }

    private static class HardwareInfo {

        final String name;
        final Double clockValue;
        final String clockLabel;

        HardwareInfo(String name, Double clockValue, String clockLabel) {
            this.name = name;
            this.clockValue = clockValue;
            this.clockLabel = clockLabel;
        }
    }

    private static class PowerReading {
        final double currentMa;
        final double voltageV;
        final double powerW;

        PowerReading(double currentMa, double voltageV, double powerW) {
            this.currentMa = currentMa;
            this.voltageV = voltageV;
            this.powerW = powerW;
        }
    }
}
