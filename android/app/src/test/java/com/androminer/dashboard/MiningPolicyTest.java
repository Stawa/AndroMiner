package com.androminer.dashboard;

import static org.junit.Assert.*;

import org.junit.Test;

public class MiningPolicyTest {
    @Test
    public void integrityRejectsCorruptionBeforeExecution() throws Exception {
        java.io.File file = java.io.File.createTempFile("miner-integrity", ".bin");
        try {
            java.nio.file.Files.write(
                    file.toPath(), "abc".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
            MinerIntegrity.verify(file, expected);
            java.nio.file.Files.write(
                    file.toPath(), "abd".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            assertThrows(java.io.IOException.class, () -> MinerIntegrity.verify(file, expected));
            java.nio.file.Files.write(file.toPath(), new byte[0]);
            assertThrows(java.io.IOException.class, () -> MinerIntegrity.verify(file, expected));
        } finally {
            file.delete();
        }
    }

    @Test
    public void orphanDetectionRequiresExactExecutableAndAppMarker() {
        assertTrue(
                OwnedMinerProcess.matches(
                        "/app/miner\u0000--api-id=androminer-android\u0000",
                        "/app/miner",
                        "/app/download"));
        assertFalse(
                OwnedMinerProcess.matches(
                        "/other/miner\u0000--api-id=androminer-android\u0000",
                        "/app/miner",
                        "/app/download"));
        assertFalse(
                OwnedMinerProcess.matches(
                        "/app/miner\u0000--user=androminer-android\u0000",
                        "/app/miner",
                        "/app/download"));
    }

    @Test
    public void mandatoryReadingsFailClosed() {
        for (Double temperature : new Double[] {null, Double.NaN, Double.POSITIVE_INFINITY})
            assertNotNull(MiningSafety.violation(temperature, 30.0, 80.0, true, 0, 42, 25, false));
        for (Double battery : new Double[] {null, Double.NaN, -1.0, 101.0})
            assertNotNull(MiningSafety.violation(30.0, 30.0, battery, true, 0, 42, 25, false));
    }

    @Test
    public void safetyBoundariesAreInclusive() {
        assertNull(MiningSafety.violation(41.9, 44.9, 25.1, true, 2, 42, 25, true));
        assertNotNull(MiningSafety.violation(42.0, 30.0, 80.0, true, 0, 42, 25, false));
        assertNotNull(MiningSafety.violation(30.0, 45.0, 80.0, true, 0, 42, 25, false));
        assertNotNull(MiningSafety.violation(30.0, 30.0, 25.0, true, 0, 42, 25, false));
        assertNotNull(MiningSafety.violation(30.0, 30.0, 80.0, false, 0, 42, 25, true));
        assertNotNull(MiningSafety.violation(30.0, 30.0, 80.0, true, 3, 42, 25, false));
    }

    @Test
    public void timerUsesElapsedTimeAndIncludesConnectionAndSleep() {
        SessionClock clock = new SessionClock();
        clock.start(500, 1);
        assertFalse(clock.expired(60499));
        assertTrue(clock.expired(60500));
        assertTrue(clock.expired(600000));
        assertEquals(Long.valueOf(0), clock.remainingSeconds(600000));
        clock.start(600000, 0);
        assertNull(clock.remainingSeconds(Long.MAX_VALUE));
        assertFalse(clock.expired(Long.MAX_VALUE));
    }

    @Test
    public void hashingTimeDoesNotIncludeUnobservedOrConnectingIntervals() {
        SessionClock clock = new SessionClock();
        clock.start(0, 0);
        clock.sample(10000, false);
        clock.sample(20000, true);
        clock.sample(22000, true);
        clock.sample(24000, false);
        assertEquals(4, clock.hashingSeconds());
        clock.sample(50000, true);
        clock.sample(500000, false);
        assertEquals(14, clock.hashingSeconds());
    }

    @Test
    public void stdoutWindowsAndUnitsStayDistinct() {
        assertNull(MinerOutput.currentSpeed("speed 10s/60s/15m n/a 20.0 30.0 H/s"));
        assertEquals(0, MinerOutput.currentSpeed("speed 10s/60s/15m 0.0 20.0 30.0 H/s"), 0);
        assertEquals(1200, MinerOutput.currentSpeed("speed 10s/60s/15m 1.2 1.0 1.0 kH/s"), 0);
    }
}
