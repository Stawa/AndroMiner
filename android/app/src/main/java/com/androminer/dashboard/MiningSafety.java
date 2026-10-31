package com.androminer.dashboard;

/** Pure policy shared by the start check and the native session watchdog. */
final class MiningSafety {
    static String violation(
            Double temperature,
            Double batteryTemperature,
            Double batteryPercent,
            boolean charging,
            int thermalStatus,
            int threshold,
            int batteryFloor,
            boolean chargingOnly) {
        if (thermalStatus >= 3)
            return "Android reports severe thermal throttling. Let the device cool.";
        if (temperature == null
                || !Double.isFinite(temperature)
                || batteryPercent == null
                || !Double.isFinite(batteryPercent)
                || batteryPercent < 0
                || batteryPercent > 100)
            return "Required temperature or battery reading is unavailable. Mining stopped for protection.";
        if (temperature >= threshold) return "Temperature limit reached (" + threshold + " °C).";
        // A CPU or case sensor must never mask an overheating battery.
        if (batteryTemperature != null && batteryTemperature >= 45)
            return "Battery temperature reached the fixed 45 °C stop limit.";
        if (batteryPercent <= batteryFloor)
            return "Battery reached the " + batteryFloor + "% stop limit.";
        if (chargingOnly && !charging) return "Charging-only mining stopped: power disconnected.";
        return null;
    }
}
