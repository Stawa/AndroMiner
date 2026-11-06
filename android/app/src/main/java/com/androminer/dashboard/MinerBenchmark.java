package com.androminer.dashboard;

import android.os.Build;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Measures this device's RandomX (rx/0) speed with the engine's own offline benchmark mode. The
 * miner is started without a pool, wallet or network access, left to warm up, and stopped once it
 * has printed enough speed readings. The result is their median.
 */
final class MinerBenchmark {
    /** Readings dropped while threads and caches settle. */
    static final int WARMUP_SAMPLES = 2;
    /** Readings the result is taken from; the miner prints one every two seconds. */
    static final int MEASURED_SAMPLES = 15;
    /** Covers dataset initialisation on slow phones; a longer run is treated as a failure. */
    static final int TIME_LIMIT_SECONDS = 300;

    private static final String END_OF_OUTPUT = new String("end");

    static final class Result {
        final double hashrate;
        final int samples;
        final int seconds;

        Result(double hashrate, int samples, int seconds) {
            this.hashrate = hashrate;
            this.samples = samples;
            this.seconds = seconds;
        }
    }

    /** Thrown when the caller cancelled the run; not a failure of the miner. */
    static final class Cancelled extends IOException {
        Cancelled() {
            super("Benchmark cancelled.");
        }
    }

    /**
     * The command line. `--api-id` is the marker OwnedMinerProcess uses to recognise and stop a
     * miner this app left behind, so an interrupted benchmark cannot keep running unnoticed.
     */
    static List<String> command(String executable, boolean lightMode) {
        List<String> command = new ArrayList<>();
        command.add(executable);
        command.add("--bench=1M");
        if (lightMode) command.add("--randomx-mode=light");
        command.add("--no-color");
        command.add("--print-time=2");
        command.add("--api-id=androminer-android");
        return command;
    }

    static double median(List<Double> values) {
        if (values.isEmpty()) throw new IllegalArgumentException("No samples.");
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int middle = sorted.size() / 2;
        return sorted.size() % 2 == 1
                ? sorted.get(middle)
                : (sorted.get(middle - 1) + sorted.get(middle)) / 2;
    }

    /** A short label the statistics service accepts: letters, digits and a few separators. */
    static String label(String value, int maxLength) {
        if (value == null) return "";
        String cleaned =
                value.replaceAll("[^\\p{L}\\p{N} ._+\\-/()]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength).trim() : cleaned;
    }

    static String deviceLabel(String manufacturer, String model) {
        String make = label(manufacturer, 24);
        String name = label(model, 64);
        if (name.isEmpty()) return make;
        if (make.isEmpty() || name.toLowerCase(java.util.Locale.ROOT).startsWith(make.toLowerCase(java.util.Locale.ROOT)))
            return label(name, 64);
        return label(make.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + make.substring(1) + " " + name, 64);
    }

    /** Receives each miner output line and how many speed readings have been taken so far. */
    interface Listener {
        void onLine(String line, int samples, int total);
    }

    static Result run(List<String> command, AtomicBoolean cancelled, Listener listener)
            throws IOException, InterruptedException {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.redirectErrorStream(true);
        Process process = builder.start();
        BlockingQueue<String> lines = new LinkedBlockingQueue<>();
        Thread reader =
                new Thread(
                        () -> {
                            try (BufferedReader input =
                                    new BufferedReader(
                                            new InputStreamReader(
                                                    process.getInputStream(),
                                                    StandardCharsets.UTF_8))) {
                                String line;
                                while ((line = input.readLine()) != null) lines.offer(line);
                            } catch (IOException ignored) {
                                /* The process ended; the loop below sees the end marker. */
                            } finally {
                                lines.offer(END_OF_OUTPUT);
                            }
                        },
                        "androminer-benchmark-output");
        reader.setDaemon(true);
        reader.start();

        long started = System.nanoTime();
        long measuringFrom = started;
        List<Double> samples = new ArrayList<>();
        try {
            while (samples.size() < WARMUP_SAMPLES + MEASURED_SAMPLES) {
                if (cancelled.get()) throw new Cancelled();
                if (System.nanoTime() - started > TIME_LIMIT_SECONDS * 1_000_000_000L)
                    throw new IOException("The benchmark took too long and was stopped.");
                String line = lines.poll(500, TimeUnit.MILLISECONDS);
                if (line == null) continue;
                if (line == END_OF_OUTPUT)
                    throw new IOException("The miner stopped before it reported a speed.");
                Double speed = MinerOutput.currentSpeed(line);
                if (speed != null && speed > 0) {
                    samples.add(speed);
                    if (samples.size() == WARMUP_SAMPLES) measuringFrom = System.nanoTime();
                }
                listener.onLine(line, samples.size(), WARMUP_SAMPLES + MEASURED_SAMPLES);
            }
        } finally {
            stop(process);
        }
        List<Double> measured = samples.subList(WARMUP_SAMPLES, samples.size());
        int seconds = (int) Math.max(1, (System.nanoTime() - measuringFrom) / 1_000_000_000L);
        return new Result(median(measured), measured.size(), seconds);
    }

    private static void stop(Process process) throws InterruptedException {
        process.destroy();
        if (!exited(process, 3000) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            process.destroyForcibly();
            exited(process, 2000);
        }
    }

    /** Process.waitFor(timeout) needs API 26, and the app supports API 24. */
    private static boolean exited(Process process, long timeoutMs) throws InterruptedException {
        long deadline = System.nanoTime() + timeoutMs * 1_000_000L;
        while (System.nanoTime() < deadline) {
            try {
                process.exitValue();
                return true;
            } catch (IllegalThreadStateException running) {
                Thread.sleep(25);
            }
        }
        return false;
    }
}
