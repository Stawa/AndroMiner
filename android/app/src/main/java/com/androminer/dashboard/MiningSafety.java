package com.androminer.dashboard;

/** Pure policy shared by the start check and the native session watchdog. */
final class MiningSafety {
    /** Highest temperature limit a user may set. 0 disables the temperature limit. */
    static final int MAX_TEMPERATURE_LIMIT_C = 85;
    /** Highest battery stop level a user may set. 0 disables the battery limit. */
    static final int MAX_BATTERY_FLOOR_PERCENT = 50;

    static int clampTemperatureLimit(int value) {
        return Math.max(0, Math.min(MAX_TEMPERATURE_LIMIT_C, value));
    }

    static int clampBatteryFloor(int value) {
        return Math.max(0, Math.min(MAX_BATTERY_FLOOR_PERCENT, value));
    }

    private static boolean unusable(Double value) {
        return value == null || !Double.isFinite(value);
    }

    /**
     * A limit of 0 is disabled: its reading is not required and never stops mining. Android's own
     * severe thermal throttling status always stops mining.
     */
    static String violation(
            Double temperature,
            Double batteryPercent,
            boolean charging,
            int thermalStatus,
            int threshold,
            int batteryFloor,
            boolean chargingOnly) {
        if (thermalStatus >= 3)
            return "Android reports severe thermal throttling. Let the device cool.";
        if (threshold > 0 && unusable(temperature))
            return "Temperature reading is unavailable. Mining stopped for protection.";
        if (batteryFloor > 0
                && (unusable(batteryPercent) || batteryPercent < 0 || batteryPercent > 100))
            return "Battery reading is unavailable. Mining stopped for protection.";
        if (threshold > 0 && temperature >= threshold)
            return "Temperature limit reached (" + threshold + " °C).";
        if (batteryFloor > 0 && batteryPercent <= batteryFloor)
            return "Battery reached the " + batteryFloor + "% stop limit.";
        if (chargingOnly && !charging) return "Charging-only mining stopped: power disconnected.";
        return null;
    }
}
