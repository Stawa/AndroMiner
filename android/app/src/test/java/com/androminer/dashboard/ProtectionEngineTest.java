package com.androminer.dashboard;

import static org.junit.Assert.*;

import org.junit.Test;

public class ProtectionEngineTest {
    private static final long SEC = 1000;

    private static ProtectionEngine engine() {
        return new ProtectionEngine(new ProtectionEngine.Config(42, 25, false, false));
    }

    private static ProtectionEngine.Input input(long nowMs, Double temp, Double battery) {
        ProtectionEngine.Input in = new ProtectionEngine.Input();
        in.nowMs = nowMs;
        in.batteryTemperatureC = temp;
        in.batteryPercent = battery;
        in.charging = false;
        in.thermalSupported = true;
        in.thermalStatus = 0;
        return in;
    }

    @Test
    public void staysNormalWhenCool() {
        ProtectionEngine e = engine();
        ProtectionEngine.Decision d = e.evaluate(input(1000, 30.0, 80.0));
        assertEquals(ProtectionEngine.State.NORMAL, d.state);
        assertEquals(100, d.intensityPercent);
        assertTrue(d.events.isEmpty());
        assertNull(d.stopReason);
    }

    @Test
    public void temperatureWalksThroughCautionThrottledCritical() {
        ProtectionEngine e = engine();
        e.evaluate(input(1000, 30.0, 80.0));
        ProtectionEngine.Decision caution = e.evaluate(input(3000, 38.5, 80.0));
        assertEquals(ProtectionEngine.State.CAUTION, caution.state);
        assertEquals(75, caution.intensityPercent);
        ProtectionEngine.Event event = caution.events.get(0);
        assertEquals("intensity_reduced", event.type);
        assertEquals("battery_temperature", event.trigger);
        assertEquals(38.0, event.threshold, 0.001);
        assertEquals(38.5, event.value, 0.001);
        assertEquals(100, event.previousIntensity);
        assertEquals(75, event.newIntensity);
        assertEquals("reduce", event.action);

        ProtectionEngine.Decision throttled = e.evaluate(input(5000, 40.2, 80.0));
        assertEquals(ProtectionEngine.State.THROTTLED, throttled.state);
        assertEquals(40, throttled.intensityPercent);

        ProtectionEngine.Decision critical = e.evaluate(input(7000, 42.0, 80.0));
        assertEquals(ProtectionEngine.State.CRITICAL, critical.state);
        assertEquals(0, critical.intensityPercent);
        assertNotNull(critical.stopReason);
        assertEquals("mining_stopped", critical.events.get(0).type);
        assertEquals("stop", critical.events.get(0).action);
    }

    @Test
    public void criticalIsTerminalAndEmitsOneStop() {
        ProtectionEngine e = engine();
        e.evaluate(input(1000, 43.0, 80.0));
        ProtectionEngine.Decision again = e.evaluate(input(3000, 30.0, 80.0));
        assertEquals(ProtectionEngine.State.CRITICAL, again.state);
        assertTrue(again.events.isEmpty());
        assertNull(again.stopReason);
    }

    @Test
    public void recoveryNeedsMarginAndDelayAndSteps() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        e.evaluate(input(2 * SEC, 40.5, 80.0));
        assertEquals(ProtectionEngine.State.THROTTLED, e.state());

        /* Below the throttle line (40) but inside the 2 degree margin: no recovery clock. */
        long t = 4 * SEC;
        for (; t < 120 * SEC; t += 2 * SEC)
            assertEquals(
                    ProtectionEngine.State.THROTTLED,
                    e.evaluate(input(t, 39.0, 80.0)).state);

        /* Cleared the margin: the delay starts, intensity must not change before it elapses. */
        long clear = t;
        assertEquals(ProtectionEngine.State.THROTTLED, e.evaluate(input(clear, 35.0, 80.0)).state);
        assertEquals(
                ProtectionEngine.State.THROTTLED,
                e.evaluate(input(clear + 28 * SEC, 35.0, 80.0)).state);
        ProtectionEngine.Decision step = e.evaluate(input(clear + 30 * SEC, 35.0, 80.0));
        assertEquals(ProtectionEngine.State.CAUTION, step.state);
        assertEquals("intensity_restored", step.events.get(0).type);
        assertEquals("recovering", step.events.get(0).recovery);
        assertEquals(40, step.events.get(0).previousIntensity);
        assertEquals(75, step.events.get(0).newIntensity);

        /* The second step needs a fresh delay: restore is gradual, never 40 to 100. */
        assertEquals(
                ProtectionEngine.State.CAUTION,
                e.evaluate(input(clear + 40 * SEC, 33.0, 80.0)).state);
        ProtectionEngine.Decision full = e.evaluate(input(clear + 60 * SEC, 33.0, 80.0));
        assertEquals(ProtectionEngine.State.NORMAL, full.state);
        assertEquals("recovered", full.events.get(0).recovery);
    }

    @Test
    public void reheatDuringRecoveryResetsTheClock() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        e.evaluate(input(SEC, 40.5, 80.0));
        e.evaluate(input(2 * SEC, 35.0, 80.0));
        e.evaluate(input(20 * SEC, 39.5, 80.0));
        assertEquals(ProtectionEngine.State.THROTTLED, e.state());
        /* 35 C again at 22s restarts the 30s delay, so 40s must not restore. */
        e.evaluate(input(22 * SEC, 35.0, 80.0));
        assertEquals(
                ProtectionEngine.State.THROTTLED,
                e.evaluate(input(50 * SEC, 35.0, 80.0)).state);
        assertEquals(
                ProtectionEngine.State.CAUTION,
                e.evaluate(input(52 * SEC, 35.0, 80.0)).state);
    }

    @Test
    public void oscillatingAroundAThresholdDoesNotFlap() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        int events = 0;
        for (long t = 2 * SEC; t < 300 * SEC; t += 2 * SEC) {
            double temp = (t / (2 * SEC)) % 2 == 0 ? 38.2 : 37.2;
            events += e.evaluate(input(t, temp, 80.0)).events.size();
        }
        assertEquals("one reduction and nothing else", 1, events);
        assertEquals(ProtectionEngine.State.CAUTION, e.state());
    }

    @Test
    public void androidThermalStatusDrivesStates() {
        ProtectionEngine e = engine();
        ProtectionEngine.Input in = input(1000, 30.0, 80.0);
        in.thermalStatus = 1;
        assertEquals(ProtectionEngine.State.CAUTION, e.evaluate(in).state);
        in = input(3000, 30.0, 80.0);
        in.thermalStatus = 2;
        assertEquals(ProtectionEngine.State.THROTTLED, e.evaluate(in).state);
        in = input(5000, 30.0, 80.0);
        in.thermalStatus = 3;
        ProtectionEngine.Decision d = e.evaluate(in);
        assertEquals(ProtectionEngine.State.CRITICAL, d.state);
        assertEquals("thermal_status", d.events.get(0).trigger);
    }

    @Test
    public void unsupportedThermalStatusIsNotAFailure() {
        ProtectionEngine e = engine();
        ProtectionEngine.Input in = input(1000, 30.0, 80.0);
        in.thermalSupported = false;
        in.thermalStatus = null;
        assertEquals(ProtectionEngine.State.NORMAL, e.evaluate(in).state);
    }

    @Test
    public void batteryLevelThrottlesOnlyWhenDischarging() {
        ProtectionEngine e = engine();
        ProtectionEngine.Decision discharging = e.evaluate(input(1000, 30.0, 32.0));
        assertEquals(ProtectionEngine.State.CAUTION, discharging.state);
        ProtectionEngine charging = engine();
        ProtectionEngine.Input in = input(1000, 30.0, 32.0);
        in.charging = true;
        assertEquals(ProtectionEngine.State.NORMAL, charging.evaluate(in).state);
        ProtectionEngine floor = engine();
        ProtectionEngine.Decision stop = floor.evaluate(input(1000, 30.0, 25.0));
        assertEquals(ProtectionEngine.State.CRITICAL, stop.state);
        assertTrue(stop.stopReason.contains("25%"));
    }

    @Test
    public void missingSensorHoldsThrottledThenStopsNeverDisables() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        ProtectionEngine.Decision first = e.evaluate(input(2 * SEC, null, 80.0));
        assertEquals("a brief gap holds at caution", ProtectionEngine.State.CAUTION, first.state);
        assertEquals("monitoring_unavailable", first.events.get(0).type);
        assertEquals("sensor_stale", first.events.get(0).trigger);

        ProtectionEngine.Decision gone = e.evaluate(input(13 * SEC, null, 80.0));
        assertEquals(ProtectionEngine.State.THROTTLED, gone.state);
        assertNull(gone.stopReason);

        ProtectionEngine.Decision stopped = e.evaluate(input(23 * SEC, null, 80.0));
        assertEquals(ProtectionEngine.State.CRITICAL, stopped.state);
        assertTrue(stopped.stopReason.contains("monitoring unavailable"));
    }

    @Test
    public void sensorThatNeverReportedHoldsThrottledImmediately() {
        ProtectionEngine e = engine();
        ProtectionEngine.Decision d = e.evaluate(input(0, null, 80.0));
        assertEquals(ProtectionEngine.State.THROTTLED, d.state);
        assertEquals("sensor_unavailable", d.events.get(0).trigger);
    }

    @Test
    public void nonFiniteReadingsAreUnusable() {
        ProtectionEngine e = engine();
        assertEquals(
                ProtectionEngine.State.THROTTLED,
                e.evaluate(input(0, Double.NaN, 80.0)).state);
    }

    @Test
    public void restoredSensorsReportRecoveryThenStepBack() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        e.evaluate(input(2 * SEC, null, 80.0));
        ProtectionEngine.Decision back = e.evaluate(input(4 * SEC, 30.0, 80.0));
        assertEquals("monitoring_restored", back.events.get(back.events.size() - 1).type);
        assertEquals(ProtectionEngine.State.CAUTION, back.state);
        assertEquals(
                ProtectionEngine.State.NORMAL,
                e.evaluate(input(40 * SEC, 30.0, 80.0)).state);
    }

    @Test
    public void disabledLimitsDoNotRequireTheirSensors() {
        ProtectionEngine e =
                new ProtectionEngine(new ProtectionEngine.Config(0, 0, false, false));
        assertEquals(
                ProtectionEngine.State.NORMAL, e.evaluate(input(0, null, null)).state);
    }

    @Test
    public void powerAndScreenPoliciesStop() {
        ProtectionEngine chargingOnly =
                new ProtectionEngine(new ProtectionEngine.Config(42, 25, true, false));
        assertEquals(
                ProtectionEngine.State.CRITICAL,
                chargingOnly.evaluate(input(0, 30.0, 80.0)).state);
        ProtectionEngine screen =
                new ProtectionEngine(new ProtectionEngine.Config(42, 25, false, true));
        ProtectionEngine.Input off = input(0, 30.0, 80.0);
        off.screenOn = false;
        assertEquals(ProtectionEngine.State.CRITICAL, screen.evaluate(off).state);
    }

    @Test
    public void cpuTemperatureOnlyActsWhenProvided() {
        ProtectionEngine e = engine();
        ProtectionEngine.Input in = input(0, 30.0, 80.0);
        in.cpuTemperatureC = 88.0;
        ProtectionEngine.Decision d = e.evaluate(in);
        assertEquals(ProtectionEngine.State.THROTTLED, d.state);
        assertEquals("cpu_temperature", d.events.get(0).trigger);
        ProtectionEngine none = engine();
        assertEquals(
                ProtectionEngine.State.NORMAL, none.evaluate(input(0, 30.0, 80.0)).state);
    }

    @Test
    public void reportsTimeSpentInEachState() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 30.0, 80.0));
        e.evaluate(input(2 * SEC, 38.5, 80.0));
        e.evaluate(input(12 * SEC, 38.5, 80.0));
        assertEquals(10, e.secondsIn(ProtectionEngine.State.CAUTION));
        assertEquals(2, e.secondsIn(ProtectionEngine.State.NORMAL));
    }

    @Test
    public void reconfigureAppliesNewLimitsWithoutResettingState() {
        ProtectionEngine e = engine();
        e.evaluate(input(0, 38.5, 80.0));
        assertEquals(ProtectionEngine.State.CAUTION, e.state());
        e.reconfigure(new ProtectionEngine.Config(50, 25, false, false));
        assertEquals(ProtectionEngine.State.CAUTION, e.state());
    }

    @Test
    public void dutyCycleActiveTimeMatchesIntensity() {
        assertEquals(1000, MinerThrottle.activeMs(100));
        assertEquals(750, MinerThrottle.activeMs(75));
        assertEquals(400, MinerThrottle.activeMs(40));
        assertEquals(0, MinerThrottle.activeMs(0));
        assertEquals(1000, MinerThrottle.activeMs(250));
        assertEquals(0, MinerThrottle.activeMs(-5));
    }
}
