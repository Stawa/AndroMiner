package com.androminer.dashboard;

import java.util.ArrayDeque;

/** When a crashed miner may be restarted automatically, and when it must stay stopped. */
final class CrashRestartPolicy {
    static final long DELAY_MS = 30_000;
    static final int MAX_RESTARTS = 3;
    static final long WINDOW_MS = 15 * 60_000L;

    private CrashRestartPolicy() {}

    /** Records a crash and returns how many crashes fall inside the window, including this one. */
    static int recordCrash(ArrayDeque<Long> crashTimes, long nowMs) {
        while (!crashTimes.isEmpty() && nowMs - crashTimes.peekFirst() > WINDOW_MS)
            crashTimes.pollFirst();
        crashTimes.addLast(nowMs);
        return crashTimes.size();
    }

    static boolean mayRestart(int crashesInWindow) {
        return crashesInWindow <= MAX_RESTARTS;
    }
}
