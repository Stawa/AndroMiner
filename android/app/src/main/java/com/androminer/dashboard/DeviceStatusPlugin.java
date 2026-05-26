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

        result.put("batteryLevel", getBatteryLevel(batteryIntent));
        result.put("isCharging", isCharging(batteryIntent));
        result.put("cpuThreads", Runtime.getRuntime().availableProcessors());
        result.put("cpuName", cpu.name);
        result.put("cpuClockGhz", cpu.clockValue);
        result.put("cpuClockLabel", cpu.clockLabel);
        result.put("gpuName", gpu.name);
        result.put("gpuClockMhz", gpu.clockValue);
        result.put("gpuClockLabel", gpu.clockLabel);
        if (temperature != null) {
            result.put("temperatureC", temperature.valueC);
            result.put("temperatureSource", temperature.source);
            result.put("temperatureSensor", temperature.sensorName);
        }
        result.put("thermalStatus", getThermalStatus(temperature));
        call.resolve(result);
    }

    private double getBatteryLevel(Intent batteryIntent) {
        if (batteryIntent == null) {
            return 1.0;
        }

        int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);

        if (level < 0 || scale <= 0) {
            return 1.0;
        }

        return (double) level / (double) scale;
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
        String normalized = type.toLowerCase();
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
        Double clockMhz = readBestGpuClockMhz();

        return new HardwareInfo(
                cleanHardwareName(name, "GPU"),
                clockMhz,
                clockMhz == null ? "-" : String.format(Locale.US, "%.0f MHz", clockMhz));
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

    private Double readBestCpuClockGhz() {
        File cpuDirectory = new File("/sys/devices/system/cpu");
        File[] cpuEntries = cpuDirectory.listFiles();
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
                            readBestFrequencyKhz(
                                    new File(cpuEntry, "cpufreq/cpuinfo_max_freq"),
                                    new File(cpuEntry, "cpufreq/scaling_max_freq"),
                                    new File(cpuEntry, "cpufreq/scaling_cur_freq")));
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

    private Double readBestGpuClockMhz() {
        long bestRaw =
                readBestRawFrequency(
                        new File("/sys/class/kgsl/kgsl-3d0/devfreq/max_freq"),
                        new File("/sys/class/kgsl/kgsl-3d0/max_gpuclk"),
                        new File("/sys/class/kgsl/kgsl-3d0/devfreq/cur_freq"),
                        new File("/sys/class/kgsl/kgsl-3d0/gpuclk"));

        File devfreqDirectory = new File("/sys/class/devfreq");
        File[] entries = devfreqDirectory.listFiles();

        if (entries != null) {
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

                bestRaw =
                        Math.max(
                                bestRaw,
                                readBestRawFrequency(
                                        new File(entry, "max_freq"), new File(entry, "cur_freq")));
            }
        }

        return normalizeGpuFrequencyMhz(bestRaw);
    }

    private long readBestFrequencyKhz(File... files) {
        long best = -1;

        for (File file : files) {
            Long raw = readLong(file);
            if (raw == null || raw <= 0) {
                continue;
            }

            long khz = raw > 10_000_000L ? raw / 1000L : raw;
            best = Math.max(best, khz);
        }

        return best;
    }

    private long readBestRawFrequency(File... files) {
        long best = -1;

        for (File file : files) {
            Long raw = readLong(file);
            if (raw != null && raw > 0) {
                best = Math.max(best, raw);
            }
        }

        return best;
    }

    private Double normalizeGpuFrequencyMhz(long rawFrequency) {
        if (rawFrequency <= 0) {
            return null;
        }

        double mhz;
        if (rawFrequency >= 1_000_000L) {
            mhz = rawFrequency / 1_000_000.0;
        } else if (rawFrequency >= 10_000L) {
            mhz = rawFrequency / 1000.0;
        } else {
            mhz = rawFrequency;
        }

        return mhz > 0 && mhz < 5000 ? mhz : null;
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
}
