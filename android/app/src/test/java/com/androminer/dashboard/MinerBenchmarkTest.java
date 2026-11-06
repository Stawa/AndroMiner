package com.androminer.dashboard;

import static org.junit.Assert.*;

import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class MinerBenchmarkTest {
    @Test
    public void medianIgnoresOutliers() {
        assertEquals(3.0, MinerBenchmark.median(Arrays.asList(1.0, 100.0, 3.0)), 0);
        assertEquals(2.5, MinerBenchmark.median(Arrays.asList(4.0, 1.0, 2.0, 3.0)), 0);
        assertEquals(7.0, MinerBenchmark.median(Arrays.asList(7.0)), 0);
    }

    @Test(expected = IllegalArgumentException.class)
    public void medianNeedsSamples() {
        MinerBenchmark.median(Arrays.<Double>asList());
    }

    @Test
    public void commandIsOfflineAndMarkedAsOwned() {
        List<String> command = MinerBenchmark.command("/lib/libxmrig.so", false);
        assertEquals("/lib/libxmrig.so", command.get(0));
        assertTrue(command.contains("--bench=1M"));
        assertTrue(command.contains("--api-id=androminer-android"));
        assertFalse(command.contains("--randomx-mode=light"));
        for (String argument : command) {
            assertFalse(argument, argument.startsWith("--url"));
            assertFalse(argument, argument.startsWith("--user"));
            assertFalse(argument, argument.startsWith("--submit"));
        }
        assertTrue(MinerBenchmark.command("/lib/libxmrig.so", true).contains("--randomx-mode=light"));
    }

    @Test
    public void commandIsRecognisedAsAnOwnedMinerSoOrphansAreStopped() {
        String joined = String.join("\u0000", MinerBenchmark.command("/lib/libxmrig.so", false));
        assertTrue(OwnedMinerProcess.matches(joined, "/lib/libxmrig.so"));
    }

    @Test
    public void speedLinesFeedTheMedian() {
        assertNull(MinerOutput.currentSpeed("[2026-11-06 10:00:02] speed 10s/60s/15m n/a n/a n/a H/s"));
        assertEquals(
                812.4,
                MinerOutput.currentSpeed("[2026-11-06 10:00:12] speed 10s/60s/15m 812.4 n/a n/a H/s"),
                0);
    }

    @Test
    public void labelsKeepOnlyWhatTheServiceAccepts() {
        assertEquals("Pixel 8 Pro", MinerBenchmark.label("Pixel 8 <Pro>", 64));
        assertEquals("abc", MinerBenchmark.label("abcdef", 3));
        assertEquals("", MinerBenchmark.label(null, 64));
        assertEquals("Google Pixel 8", MinerBenchmark.deviceLabel("Google", "Pixel 8"));
        assertEquals("Samsung SM-A135F", MinerBenchmark.deviceLabel("samsung", "SM-A135F"));
        assertEquals("Xiaomi 23021RAA2Y", MinerBenchmark.deviceLabel("Xiaomi", "Xiaomi 23021RAA2Y"));
    }
}
