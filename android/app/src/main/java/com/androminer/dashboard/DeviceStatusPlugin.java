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

    result.put("batteryLevel", getBatteryLevel(batteryIntent));
    result.put("isCharging", isCharging(batteryIntent));
    result.put("cpuThreads", Runtime.getRuntime().availableProcessors());
    result.put("temperatureC", getBestTemperatureC(batteryIntent));
    result.put("temperatureSource", getCpuTemperatureC() != null ? "native" : "battery");
    result.put("thermalStatus", getThermalStatus());
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

  private Double getBestTemperatureC(Intent batteryIntent) {
    Double cpuTemperature = getCpuTemperatureC();
    if (cpuTemperature != null) {
      return cpuTemperature;
    }

    return getBatteryTemperatureC(batteryIntent);
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

  private Double getCpuTemperatureC() {
    File thermalDirectory = new File("/sys/class/thermal");
    File[] zones = thermalDirectory.listFiles();

    if (zones == null) {
      return null;
    }

    for (File zone : zones) {
      String name = zone.getName();
      if (!name.startsWith("thermal_zone")) {
        continue;
      }

      String type = readFirstLine(new File(zone, "type"));
      if (type == null || !isCpuThermalZone(type)) {
        continue;
      }

      Double temperature = readTemperature(new File(zone, "temp"));
      if (temperature != null) {
        return temperature;
      }
    }

    return null;
  }

  private boolean isCpuThermalZone(String type) {
    String normalized = type.toLowerCase();
    return normalized.contains("cpu")
        || normalized.contains("soc")
        || normalized.contains("ap")
        || normalized.contains("xo_therm")
        || normalized.contains("tsens");
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
      if (value < -20 || value > 130) {
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

  private String getThermalStatus() {
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
}
