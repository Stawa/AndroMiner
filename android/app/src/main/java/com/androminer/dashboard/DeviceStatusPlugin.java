package com.androminer.dashboard;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceStatus")
public class DeviceStatusPlugin extends Plugin {
  @PluginMethod
  public void getStatus(PluginCall call) {
    JSObject result = new JSObject();
    Intent batteryIntent =
        getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
    TemperatureReading temperature = getBestPhoneTemperature(batteryIntent);

    result.put("batteryLevel", getBatteryLevel(batteryIntent));
    result.put("isCharging", isCharging(batteryIntent));
    result.put("cpuThreads", Runtime.getRuntime().availableProcessors());
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

    int temperature = batteryIntent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
    if (temperature == Integer.MIN_VALUE) {
      return null;
    }

    return temperature / 10.0;
  }

  private TemperatureReading getBestPhoneTemperature(Intent batteryIntent) {
    List<TemperatureReading> readings = getThermalZoneReadings();
    TemperatureReading skinOrBody = medianReading(filterByClass(readings, SensorClass.SKIN_OR_BODY));
    if (skinOrBody != null) {
      return skinOrBody;
    }

    TemperatureReading batteryZone = medianReading(filterByClass(readings, SensorClass.BATTERY));
    if (batteryZone != null) {
      return batteryZone;
    }

    Double batteryIntentTemperature = getBatteryTemperatureC(batteryIntent);
    if (batteryIntentTemperature != null) {
      return new TemperatureReading(batteryIntentTemperature, "battery", "battery-intent");
    }

    TemperatureReading cpuOrSoc = medianReading(filterByClass(readings, SensorClass.CPU_OR_SOC));
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

    PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
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
}
