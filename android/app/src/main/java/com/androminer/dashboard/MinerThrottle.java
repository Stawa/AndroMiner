package com.androminer.dashboard;

import android.os.SystemClock;
import android.system.Os;
import android.system.OsConstants;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Enforces a mining intensity below 100% by pausing the owned miner process (SIGSTOP) for part of
 * every cycle and resuming it (SIGCONT) for the rest. XMRig cannot change its thread count at
 * runtime, and a restart would drop the pool connection and RandomX dataset. Measured intensity is
 * accumulated from the real signal timestamps, so the UI reports what was actually applied.
 */
final class MinerThrottle {
    static final long CYCLE_MS = 1000;

    interface Target {
        int pid();
    }

    private final Target target;
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(
                    runnable -> {
                        Thread thread = new Thread(runnable, "androminer-throttle");
                        thread.setDaemon(true);
                        return thread;
                    });
    private ScheduledFuture<?> cycle;
    private int percent = 100;
    private boolean stopped;
    private long windowStart;
    private long windowStoppedMs;
    private long stoppedAt;

    MinerThrottle(Target target) {
        this.target = target;
    }

    /** Active duration within one cycle for a given intensity. */
    static long activeMs(int percent) {
        return Math.max(0, Math.min(CYCLE_MS, CYCLE_MS * percent / 100));
    }

    synchronized void setIntensity(int newPercent) {
        percent = Math.max(0, Math.min(100, newPercent));
        if (percent >= 100) {
            cancelCycle();
            resume();
        } else if (cycle == null) {
            windowStart = SystemClock.elapsedRealtime();
            windowStoppedMs = 0;
            cycle = scheduler.scheduleWithFixedDelay(this::tick, 0, 1, TimeUnit.MILLISECONDS);
        }
    }

    private void tick() {
        try {
            int current;
            synchronized (this) {
                current = percent;
            }
            if (current >= 100) return;
            long active = activeMs(current);
            synchronized (this) {
                resume();
            }
            sleep(active);
            synchronized (this) {
                if (percent >= 100 || cycle == null) return;
                if (active < CYCLE_MS) pause();
            }
            sleep(CYCLE_MS - active);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException ignored) {
            synchronized (this) {
                resume();
            }
        }
    }

    private static void sleep(long ms) throws InterruptedException {
        if (ms > 0) Thread.sleep(ms);
    }

    private void pause() {
        int pid = target.pid();
        if (stopped || pid <= 0) return;
        try {
            Os.kill(pid, OsConstants.SIGSTOP);
            stopped = true;
            stoppedAt = SystemClock.elapsedRealtime();
        } catch (android.system.ErrnoException gone) {
            stopped = false;
        }
    }

    private void resume() {
        int pid = target.pid();
        if (stopped && pid > 0) {
            try {
                Os.kill(pid, OsConstants.SIGCONT);
            } catch (android.system.ErrnoException gone) {
                /* The process already exited. */
            }
        }
        if (stopped) {
            long span = SystemClock.elapsedRealtime() - stoppedAt;
            windowStoppedMs += span;
        }
        stopped = false;
    }

    private void cancelCycle() {
        if (cycle != null) cycle.cancel(false);
        cycle = null;
    }

    /** Resume the process and stop cycling. Always call before signalling the miner to exit. */
    synchronized void release() {
        percent = 100;
        cancelCycle();
        resume();
    }

    synchronized void shutdown() {
        release();
        scheduler.shutdownNow();
    }

    /** Share of wall time the miner process actually ran since the last call, 0-100. */
    synchronized int measuredPercent() {
        long now = SystemClock.elapsedRealtime();
        if (stopped) {
            long span = now - stoppedAt;
            windowStoppedMs += span;
            stoppedAt = now;
        }
        long elapsed = now - windowStart;
        int measured =
                elapsed <= 0
                        ? 100
                        : (int) Math.round(100.0 * (elapsed - windowStoppedMs) / elapsed);
        windowStart = now;
        windowStoppedMs = 0;
        return Math.max(0, Math.min(100, measured));
    }
}
