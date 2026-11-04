package com.androminer.dashboard;

import static org.junit.Assert.*;

import java.util.ArrayDeque;
import org.junit.Test;

public class CrashRestartPolicyTest {
    @Test
    public void restartsUpToTheLimitThenStaysStopped() {
        ArrayDeque<Long> times = new ArrayDeque<>();
        for (int i = 1; i <= CrashRestartPolicy.MAX_RESTARTS; i++)
            assertTrue(CrashRestartPolicy.mayRestart(CrashRestartPolicy.recordCrash(times, i * 60_000L)));
        assertFalse(
                CrashRestartPolicy.mayRestart(
                        CrashRestartPolicy.recordCrash(times, (CrashRestartPolicy.MAX_RESTARTS + 1) * 60_000L)));
    }

    @Test
    public void oldCrashesAgeOutOfTheWindow() {
        ArrayDeque<Long> times = new ArrayDeque<>();
        CrashRestartPolicy.recordCrash(times, 0);
        CrashRestartPolicy.recordCrash(times, 1_000);
        CrashRestartPolicy.recordCrash(times, 2_000);
        int later = CrashRestartPolicy.recordCrash(times, CrashRestartPolicy.WINDOW_MS + 10_000);
        assertEquals(1, later);
        assertTrue(CrashRestartPolicy.mayRestart(later));
    }

    @Test
    public void userHasThirtySecondsToAnswer() {
        assertEquals(30_000, CrashRestartPolicy.DELAY_MS);
    }
}
