package com.androminer.dashboard;

/** All enforcement uses elapsed realtime, including time spent asleep or connecting. */
final class SessionClock {
    private long startedAt;
    private long deadline;
    private long sampledAt;
    private long hashingMillis;
    private boolean hashing;

    void start(long now, int minutes) {
        if (minutes < 0 || minutes > 1440)
            throw new IllegalArgumentException("Session duration must be 0–1440 minutes.");
        startedAt = now;
        deadline = minutes == 0 ? 0 : now + minutes * 60_000L;
        sampledAt = now;
        hashingMillis = 0;
        hashing = false;
    }

    void sample(long now, boolean measuredHashing) {
        // Never count an unobserved long gap as hashing time.
        if (hashing) hashingMillis += Math.min(10_000, Math.max(0, now - sampledAt));
        sampledAt = now;
        hashing = measuredHashing;
    }

    boolean expired(long now) {
        return deadline > 0 && now >= deadline;
    }

    Long remainingSeconds(long now) {
        return deadline == 0 ? null : Math.max(0, (deadline - now + 999) / 1000);
    }

    long uptimeSeconds(long now) {
        return Math.max(0, (now - startedAt) / 1000);
    }

    long hashingSeconds() {
        return hashingMillis / 1000;
    }
}
