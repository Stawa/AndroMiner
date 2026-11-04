package com.androminer.dashboard;

import java.util.ArrayList;
import java.util.List;

/**
 * Adaptive protection policy. Pure and clock-injected: the native watchdog feeds it one reading per
 * poll and applies the returned intensity. Escalation is immediate; recovery needs the reading to
 * clear its threshold by a margin and then holds for a delay, one level at a time.
 */
final class ProtectionEngine {
    enum State {
        NORMAL(100),
        CAUTION(75),
        THROTTLED(40),
        CRITICAL(0);

        /** Share of the configured mining intensity allowed in this state. */
        final int intensityPercent;

        State(int intensityPercent) {
            this.intensityPercent = intensityPercent;
        }
    }

    static final double TEMP_CAUTION_BELOW_LIMIT_C = 4;
    static final double TEMP_THROTTLE_BELOW_LIMIT_C = 2;
    static final double TEMP_HYSTERESIS_C = 2;
    static final int BATTERY_CAUTION_ABOVE_FLOOR = 8;
    static final int BATTERY_THROTTLE_ABOVE_FLOOR = 3;
    static final int BATTERY_HYSTERESIS = 3;
    /** Only used when a reliable CPU sensor exists; not user-configurable. */
    static final double CPU_CAUTION_C = 75;
    static final double CPU_THROTTLE_C = 85;
    static final double CPU_CRITICAL_C = 95;
    static final double CPU_HYSTERESIS_C = 3;
    static final long RECOVERY_DELAY_MS = 30_000;
    static final long STALE_AFTER_MS = 10_000;
    static final long UNAVAILABLE_STOP_AFTER_MS = 20_000;

    static final class Config {
        final int temperatureLimitC;
        final int batteryFloorPercent;
        final boolean chargingOnly;
        final boolean pauseOnScreenOff;

        Config(
                int temperatureLimitC,
                int batteryFloorPercent,
                boolean chargingOnly,
                boolean pauseOnScreenOff) {
            this.temperatureLimitC = MiningSafety.clampTemperatureLimit(temperatureLimitC);
            this.batteryFloorPercent = MiningSafety.clampBatteryFloor(batteryFloorPercent);
            this.chargingOnly = chargingOnly;
            this.pauseOnScreenOff = pauseOnScreenOff;
        }
    }

    /** One poll. A null reading means the source could not be read this time. */
    static final class Input {
        long nowMs;
        Double batteryTemperatureC;
        Double batteryPercent;
        boolean charging;
        /** Android PowerManager thermal status 0-6; null when readable but failed. */
        Integer thermalStatus;
        /** False below API 29, where Android exposes no thermal status. */
        boolean thermalSupported;
        /** Only set from a sensor classified as CPU; null when no reliable one exists. */
        Double cpuTemperatureC;
        boolean screenOn = true;
    }

    static final class Event {
        String type;
        long at;
        String trigger;
        String sensor;
        Double value;
        String unit;
        Double threshold;
        State previousState;
        State newState;
        int previousIntensity;
        int newIntensity;
        String action;
        String recovery;
    }

    static final class Decision {
        State state;
        int intensityPercent;
        String stopReason;
        final List<Event> events = new ArrayList<>();
        String trigger;
    }

    private static final class Candidate {
        final State state;
        final String trigger;
        final String sensor;
        final Double value;
        final Double threshold;
        final String unit;

        Candidate(State state, String trigger, String sensor, Double value, Double threshold, String unit) {
            this.state = state;
            this.trigger = trigger;
            this.sensor = sensor;
            this.value = value;
            this.threshold = threshold;
            this.unit = unit;
        }
    }

    private static final Candidate NONE = new Candidate(State.NORMAL, "none", null, null, null, null);

    private Config config;
    private State state = State.NORMAL;
    private Candidate active = NONE;
    private long recoverySince;
    private long unavailableSince;
    private boolean monitoringLost;
    private long lastEvalAt = -1;
    private final long[] millisInState = new long[State.values().length];
    private long lastBatteryTempOk = -1;
    private long lastBatteryPercentOk = -1;
    private long lastThermalOk = -1;
    private long lastCpuOk = -1;

    ProtectionEngine(Config config) {
        this.config = config;
    }

    Config config() {
        return config;
    }

    /** Applies updated user limits to a running session without resetting its state. */
    void reconfigure(Config updated) {
        config = updated;
    }

    State state() {
        return state;
    }

    int intensityPercent() {
        return state.intensityPercent;
    }

    String trigger() {
        return active.trigger;
    }

    long secondsIn(State which) {
        return millisInState[which.ordinal()] / 1000;
    }

    long recoveryRemainingMs(long nowMs) {
        if (state == State.NORMAL || state == State.CRITICAL || recoverySince == 0) return -1;
        return Math.max(0, RECOVERY_DELAY_MS - (nowMs - recoverySince));
    }

    /** Milliseconds since the source last returned a usable value, or -1 if it never has. */
    long ageMs(String source, long nowMs) {
        long at;
        switch (source) {
            case "batteryTemperature": at = lastBatteryTempOk; break;
            case "batteryPercent": at = lastBatteryPercentOk; break;
            case "thermalStatus": at = lastThermalOk; break;
            default: at = lastCpuOk;
        }
        return at < 0 ? -1 : Math.max(0, nowMs - at);
    }

    Decision evaluate(Input in) {
        Decision decision = new Decision();
        long now = in.nowMs;
        if (lastEvalAt >= 0) millisInState[state.ordinal()] += Math.max(0, now - lastEvalAt);
        lastEvalAt = now;
        if (state == State.CRITICAL) return finish(decision, now);

        trackFreshness(in);
        if (!sourcesMissing(in)) unavailableSince = 0;
        State before = state;
        Candidate raw = triggers(in, false);
        Candidate relaxed = triggers(in, true);

        if (raw.state.ordinal() > state.ordinal()) {
            escalate(decision, raw, now);
        } else if (relaxed.state.ordinal() < state.ordinal()) {
            if (recoverySince == 0) recoverySince = now;
            if (now - recoverySince >= RECOVERY_DELAY_MS) {
                State next = State.values()[state.ordinal() - 1];
                recover(decision, next, relaxed, now, in);
            }
        } else {
            recoverySince = 0;
            if (state != State.NORMAL && relaxed.state == state) active = relaxed;
        }

        if (monitoringLost && !sourcesMissing(in) && state != State.CRITICAL) {
            monitoringLost = false;
            decision.events.add(event(
                    "monitoring_restored", now, "sensor_unavailable", null, null, null, null,
                    state, state, state.intensityPercent, state.intensityPercent, "hold",
                    "recovered"));
        }
        if (state != before && state == State.CRITICAL) {
            decision.stopReason = stopReason(active);
        }
        return finish(decision, now);
    }

    private Decision finish(Decision decision, long now) {
        decision.state = state;
        decision.intensityPercent = state.intensityPercent;
        decision.trigger = active.trigger;
        return decision;
    }

    private void escalate(Decision decision, Candidate cause, long now) {
        State previous = state;
        state = cause.state;
        active = cause;
        recoverySince = 0;
        if (cause.trigger.startsWith("sensor_")) monitoringLost = true;
        String type =
                state == State.CRITICAL
                        ? "mining_stopped"
                        : cause.trigger.startsWith("sensor_")
                                ? "monitoring_unavailable"
                                : "intensity_reduced";
        decision.events.add(event(
                type, now, cause.trigger, cause.sensor, cause.value, cause.unit, cause.threshold,
                previous, state, previous.intensityPercent, state.intensityPercent,
                state == State.CRITICAL ? "stop" : "reduce",
                state == State.CRITICAL ? "manual_restart_required" : "pending"));
    }

    private void recover(Decision decision, State next, Candidate relaxed, long now, Input in) {
        State previous = state;
        state = next;
        recoverySince = next == State.NORMAL ? 0 : now;
        decision.events.add(event(
                "intensity_restored", now, active.trigger, active.sensor,
                readingFor(active.sensor, in), active.unit, active.threshold, previous, next, previous.intensityPercent,
                next.intensityPercent, "restore",
                next == State.NORMAL ? "recovered" : "recovering"));
        active = next == State.NORMAL ? NONE : relaxed;
    }

    private static Double readingFor(String sensor, Input in) {
        if (sensor == null) return null;
        switch (sensor) {
            case "batteryTemperature": return in.batteryTemperatureC;
            case "batteryPercent": return in.batteryPercent;
            case "androidThermalStatus": return in.thermalStatus == null ? null : (double) in.thermalStatus;
            case "cpuTemperature": return in.cpuTemperatureC;
            default: return null;
        }
    }

    private boolean sourcesMissing(Input in) {
        return (config.temperatureLimitC > 0 && !usable(in.batteryTemperatureC))
                || (config.batteryFloorPercent > 0 && !validPercent(in.batteryPercent));
    }

    private void trackFreshness(Input in) {
        if (in.batteryTemperatureC != null && Double.isFinite(in.batteryTemperatureC))
            lastBatteryTempOk = in.nowMs;
        if (validPercent(in.batteryPercent)) lastBatteryPercentOk = in.nowMs;
        if (in.thermalSupported && in.thermalStatus != null) lastThermalOk = in.nowMs;
        if (in.cpuTemperatureC != null && Double.isFinite(in.cpuTemperatureC)) lastCpuOk = in.nowMs;
    }

    private static boolean validPercent(Double value) {
        return value != null && Double.isFinite(value) && value >= 0 && value <= 100;
    }

    private static boolean usable(Double value) {
        return value != null && Double.isFinite(value);
    }

    private static Candidate worse(Candidate a, Candidate b) {
        return b.state.ordinal() > a.state.ordinal() ? b : a;
    }

    /** relaxed=true applies the hysteresis margins: the level the device must clear to recover. */
    private Candidate triggers(Input in, boolean relaxed) {
        Candidate worst = NONE;
        long now = in.nowMs;
        if (!relaxed) {
            if (in.thermalSupported && in.thermalStatus != null && in.thermalStatus >= 3)
                worst = worse(worst, new Candidate(State.CRITICAL, "thermal_status", "androidThermalStatus", (double) in.thermalStatus, 3.0, "level"));
            if (config.chargingOnly && !in.charging)
                worst = worse(worst, new Candidate(State.CRITICAL, "power_disconnected", "charging", 0.0, null, null));
            if (config.pauseOnScreenOff && !in.screenOn)
                worst = worse(worst, new Candidate(State.CRITICAL, "screen_off", "screen", 0.0, null, null));
        }
        if (config.temperatureLimitC > 0) {
            if (!usable(in.batteryTemperatureC)) {
                worst = worse(worst, unavailable("battery_temperature", "batteryTemperature", now, lastBatteryTempOk));
            } else {
                double limit = config.temperatureLimitC;
                double t = in.batteryTemperatureC;
                double margin = relaxed ? TEMP_HYSTERESIS_C : 0;
                if (!relaxed && t >= limit)
                    worst = worse(worst, new Candidate(State.CRITICAL, "battery_temperature", "batteryTemperature", t, limit, "°C"));
                else if (t >= limit - TEMP_THROTTLE_BELOW_LIMIT_C - margin)
                    worst = worse(worst, new Candidate(State.THROTTLED, "battery_temperature", "batteryTemperature", t, limit - TEMP_THROTTLE_BELOW_LIMIT_C, "°C"));
                else if (t >= limit - TEMP_CAUTION_BELOW_LIMIT_C - margin)
                    worst = worse(worst, new Candidate(State.CAUTION, "battery_temperature", "batteryTemperature", t, limit - TEMP_CAUTION_BELOW_LIMIT_C, "°C"));
            }
        }
        if (in.thermalSupported && in.thermalStatus != null) {
            if (in.thermalStatus == 2)
                worst = worse(worst, new Candidate(State.THROTTLED, "thermal_status", "androidThermalStatus", 2.0, 2.0, "level"));
            else if (in.thermalStatus == 1)
                worst = worse(worst, new Candidate(State.CAUTION, "thermal_status", "androidThermalStatus", 1.0, 1.0, "level"));
        }
        if (config.batteryFloorPercent > 0) {
            if (!validPercent(in.batteryPercent)) {
                worst = worse(worst, unavailable("battery_percent", "batteryPercent", now, lastBatteryPercentOk));
            } else {
                double floor = config.batteryFloorPercent;
                double p = in.batteryPercent;
                if (!relaxed && p <= floor)
                    worst = worse(worst, new Candidate(State.CRITICAL, "battery_level", "batteryPercent", p, floor, "%"));
                if (!in.charging) {
                    double margin = relaxed ? BATTERY_HYSTERESIS : 0;
                    if (p <= floor + BATTERY_THROTTLE_ABOVE_FLOOR + margin)
                        worst = worse(worst, new Candidate(State.THROTTLED, "battery_level", "batteryPercent", p, floor + BATTERY_THROTTLE_ABOVE_FLOOR, "%"));
                    else if (p <= floor + BATTERY_CAUTION_ABOVE_FLOOR + margin)
                        worst = worse(worst, new Candidate(State.CAUTION, "battery_level", "batteryPercent", p, floor + BATTERY_CAUTION_ABOVE_FLOOR, "%"));
                }
            }
        }
        if (usable(in.cpuTemperatureC)) {
            double c = in.cpuTemperatureC;
            double margin = relaxed ? CPU_HYSTERESIS_C : 0;
            if (!relaxed && c >= CPU_CRITICAL_C)
                worst = worse(worst, new Candidate(State.CRITICAL, "cpu_temperature", "cpuTemperature", c, CPU_CRITICAL_C, "°C"));
            else if (c >= CPU_THROTTLE_C - margin)
                worst = worse(worst, new Candidate(State.THROTTLED, "cpu_temperature", "cpuTemperature", c, CPU_THROTTLE_C, "°C"));
            else if (c >= CPU_CAUTION_C - margin)
                worst = worse(worst, new Candidate(State.CAUTION, "cpu_temperature", "cpuTemperature", c, CPU_CAUTION_C, "°C"));
        }
        return worst;
    }

    /**
     * A required source that stopped reporting holds at THROTTLED, and stops mining once it has
     * been gone for UNAVAILABLE_STOP_AFTER_MS. Protection never falls back to "no limit".
     */
    private Candidate unavailable(String trigger, String sensor, long now, long lastOk) {
        if (unavailableSince == 0) unavailableSince = now;
        boolean stale = lastOk >= 0 && now - lastOk < STALE_AFTER_MS;
        String code = lastOk >= 0 ? "sensor_stale" : "sensor_unavailable";
        if (stale) return new Candidate(State.CAUTION, code, sensor, null, null, null);
        State level =
                now - unavailableSince >= UNAVAILABLE_STOP_AFTER_MS
                        ? State.CRITICAL
                        : State.THROTTLED;
        return new Candidate(level, code, sensor, null, null, null);
    }

    private static Event event(
            String type, long at, String trigger, String sensor, Double value, String unit,
            Double threshold, State previous, State next, int previousIntensity,
            int newIntensity, String action, String recovery) {
        Event event = new Event();
        event.type = type;
        event.at = at;
        event.trigger = trigger;
        event.sensor = sensor;
        event.value = value;
        event.unit = unit;
        event.threshold = threshold;
        event.previousState = previous;
        event.newState = next;
        event.previousIntensity = previousIntensity;
        event.newIntensity = newIntensity;
        event.action = action;
        event.recovery = recovery;
        return event;
    }

    private static String stopReason(Candidate cause) {
        switch (cause.trigger) {
            case "thermal_status":
                return "Android reports severe thermal throttling. Let the device cool.";
            case "battery_temperature":
                return "Battery temperature limit reached ("
                        + Math.round(cause.threshold == null ? 0 : cause.threshold)
                        + " °C).";
            case "cpu_temperature":
                return "CPU temperature limit reached (" + Math.round(cause.threshold) + " °C).";
            case "battery_level":
                return "Battery reached the " + Math.round(cause.threshold) + "% stop limit.";
            case "power_disconnected":
                return "Charging-only mining stopped: power disconnected.";
            case "screen_off":
                return "Mining paused when the screen turned off.";
            default:
                return "Protection monitoring unavailable: a required sensor stopped reporting."
                        + " Mining stopped for protection.";
        }
    }
}
