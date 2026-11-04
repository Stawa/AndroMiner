package com.androminer.dashboard;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class NativeMiningRuntime {
    private final Context context;
    private final SessionJournal journal;
    private final SessionClock sessionClock = new SessionClock();
    private JSObject sessionRecord;
    private String storageError = "";
    private long lastCheckpoint;
    private double sampleTotal;
    private int sampleCount;
    private String verifiedPath = "";
    private long verifiedLength;
    private long verifiedModified;
    private volatile java.util.function.Consumer<JSObject> progressListener;
    private final java.util.concurrent.atomic.AtomicBoolean probing =
            new java.util.concurrent.atomic.AtomicBoolean();

    void testPool(PluginCall call) {
        if (!probing.compareAndSet(false, true)) {
            call.reject("A connection test is already running.");
            return;
        }
        metadataExecutor.execute(
                () -> {
                    try {
                        JSArray stages = new JSArray();
                        for (PoolProbe.Stage stage :
                                PoolProbe.run(
                                        call.getString("host", ""),
                                        call.getInt("port", 0),
                                        call.getBoolean("tls", false))) {
                            JSObject item = new JSObject();
                            item.put("stage", stage.stage);
                            item.put("passed", stage.passed);
                            item.put("detail", stage.detail);
                            stages.put(item);
                        }
                        JSObject result = new JSObject();
                        result.put("stages", stages);
                        result.put("checkedAt", System.currentTimeMillis());
                        call.resolve(result);
                    } catch (RuntimeException failure) {
                        call.reject("Connection test could not finish. Try again.");
                    } finally {
                        probing.set(false);
                    }
                });
    }

    NativeMiningRuntime(Context context) {
        this.context = context.getApplicationContext();
        journal = new SessionJournal(this.context);
        controlExecutor.execute(
                () -> {
                    synchronized (this) {
                        try {
                            OwnedMinerProcess.stopOrphans(this.context);
                            journal.recoverInterrupted();
                            sessionRecord = journal.latest();
                            if (sessionRecord != null) {
                                lastMessage =
                                        sessionRecord.optString("endReason", "Session ended.");
                            }
                        } catch (RuntimeException | IOException failure) {
                            storageError =
                                    "Native session history is unavailable. Free storage and reopen the app.";
                        }
                    }
                });
    }

    private Context getContext() {
        return context;
    }

    void setProgressListener(java.util.function.Consumer<JSObject> listener) {
        progressListener = listener;
    }

    void setVisible(boolean visible) {
        activityVisible = visible;
        if (!visible)
            controlExecutor.execute(
                    () -> {
                        synchronized (this) {
                            if (activeConfig != null
                                    && isRunning()
                                    && (!activeConfig.optBoolean("backgroundMining", true)
                                            || activeConfig.optBoolean(
                                                    "autoPauseScreenOff", false)))
                                stopForProtection(
                                        "Mining paused when the app entered the background.",
                                        sessionGeneration);
                        }
                    });
    }

    private static final Pattern DIFFICULTY_PATTERN =
            Pattern.compile(
                    "\\bdiff\\s+([0-9]+(?:\\.[0-9]+)?)([kKmMgG]?)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LATENCY_PATTERN =
            Pattern.compile("\\(([0-9]+)\\s*ms\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern XMRIG_VERSION_PATTERN =
            Pattern.compile("\\bXMRig\\s+([^\\s]+)", Pattern.CASE_INSENSITIVE);
    private static final String[] BINARY_CANDIDATES = {
        "miners/libxmrig.so", "miners/xmrig", "miners/xmrig-aarch64", "libxmrig.so"
    };
    private static final String MINER_DOWNLOAD_URL_FORMAT =
            "https://raw.githubusercontent.com/Stawa/AndroMiner/"
                    + MinerIntegrity.REVISION
                    + "/lib/%s/%s/libxmrig.so";
    private static final String DEVICE_ABI = MinerAbi.select(Build.SUPPORTED_ABIS);
    private static final String API_HOST = "127.0.0.1";
    private static final int DOWNLOAD_CONNECT_TIMEOUT_MS = 15000;
    private static final int DOWNLOAD_READ_TIMEOUT_MS = 45000;
    private static final long DOWNLOAD_PROGRESS_INTERVAL_MS = 250;
    private static final int API_CONNECT_TIMEOUT_MS = 350;
    private static final int API_READ_TIMEOUT_MS = 650;
    private static final int API_FALLBACK_PORT = 39089;
    private static final int MAX_LOG_LINES = 80;
    private static final String PREFS_NAME = "androminer_native_miner";
    private static final String PREF_MINER_VARIANT = "miner_variant";
    private static final double PERFORMANCE_CORE_FREQ_RATIO = 0.90D;

    private static class ApiTelemetry {

        boolean available;
        double hashrate;
        int acceptedShares;
        int rejectedShares;
        int activeThreads;
        long uptimeSeconds;
        String message = "XMRig HTTP API telemetry unavailable.";
        JSObject summary;
        JSObject backends;
        JSObject hashrateJson;
        JSObject resultsJson;
        JSObject connectionJson;
        JSArray threadHashrates = new JSArray();
    }

    private static class CpuAffinityPlan {

        final String mode;
        final long mask;
        final List<Integer> cores;
        final int threadCount;

        CpuAffinityPlan(String mode, long mask, List<Integer> cores, int threadCount) {
            this.mode = mode;
            this.mask = mask;
            this.cores = cores;
            this.threadCount = threadCount;
        }

        static CpuAffinityPlan none(String mode) {
            return new CpuAffinityPlan(mode, 0, new ArrayList<>(), 0);
        }

        boolean hasMask() {
            return mask > 0 && !cores.isEmpty();
        }

        String tasksetMask() {
            return Long.toHexString(mask);
        }

        String displayMaskHex() {
            return "0x" + Long.toHexString(mask);
        }

        String describe() {
            if (!hasMask()) {
                if ("custom".equals(mode)) {
                    return "custom affinity is not configured; using Android scheduler";
                }

                return "Android scheduler";
            }

            String label = "big".equals(mode) ? "performance cores" : "efficiency cores";
            return label
                    + " "
                    + formatCoreList()
                    + " (mask "
                    + displayMaskHex()
                    + ", "
                    + threadCount
                    + " threads)";
        }

        private String formatCoreList() {
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < cores.size(); index += 1) {
                if (index > 0) {
                    builder.append(",");
                }
                builder.append(cores.get(index));
            }

            return builder.toString();
        }
    }

    private static class CpuCoreInfo {

        final int index;
        final long maxFrequencyKhz;

        CpuCoreInfo(int index, long maxFrequencyKhz) {
            this.index = index;
            this.maxFrequencyKhz = maxFrequencyKhz;
        }
    }

    private final ExecutorService outputExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService controlExecutor = Executors.newSingleThreadExecutor();
    private JSObject activeConfig;
    private boolean paused;
    private boolean poolConnected;
    private long lastStdoutHashrateAtMs;
    private long lastStdoutHashrateElapsed;
    private double stdoutHashrate;
    private final ExecutorService metadataExecutor = Executors.newSingleThreadExecutor();
    private final List<String> recentLogs = new ArrayList<>();
    private final SimpleDateFormat logTimeFormat = new SimpleDateFormat("HH:mm:ss", Locale.US);
    private Process minerProcess;
    private long startedAtMs;
    private long stoppedUptimeSeconds;
    private double hashrate;
    private long difficulty;
    private int networkLatencyMs;
    private double minerCpuUsage;
    private boolean minerCpuUsageAvailable;
    private long lastMinerCpuJiffies;
    private long lastCpuSampleAtMs;
    private volatile int minerPid = -1;
    private ProtectionEngine protection;
    private MinerThrottle throttle;
    private volatile int measuredIntensity = 100;
    private final ScheduledExecutorService restartTimer =
            Executors.newSingleThreadScheduledExecutor(
                    runnable -> {
                        Thread thread = new Thread(runnable, "androminer-crash-restart");
                        thread.setDaemon(true);
                        return thread;
                    });
    private ScheduledFuture<?> restartTask;
    private JSObject crashConfig;
    private JSObject crashRestart;
    private final ArrayDeque<Long> crashTimes = new ArrayDeque<>();
    private int acceptedShares;
    private int rejectedShares;
    private int activeThreads;
    private String lastMessage = "Native miner has not started.";
    private String lastFailureReason = "";
    private int lastExitCode = Integer.MIN_VALUE;
    private boolean stopRequested;
    private String activeHardwareMode = "cpu";
    private int apiPort;
    private String apiToken = "";
    private boolean apiTelemetryAvailable;
    private long lastApiTelemetryAtMs;
    private String apiTelemetryMessage = "XMRig API telemetry has not started.";
    private volatile int batteryFloor = 25;
    private volatile boolean chargingOnly;
    private volatile boolean autoRestartOnCrash = true;
    private volatile boolean activityVisible = true;
    private long sessionGeneration;

    public void updateSafety(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    batteryFloor = MiningSafety.clampBatteryFloor(call.getInt("batteryFloor", 25));
                    chargingOnly = call.getBoolean("chargingOnly", false);
                    autoRestartOnCrash = call.getBoolean("autoRestartOnCrash", true);
                    if (!autoRestartOnCrash) cancelCrashRestart();
                    synchronized (NativeMiningRuntime.this) {
                        if (protection != null && activeConfig != null)
                            protection.reconfigure(protectionConfig(activeConfig));
                    }
                    if (isRunning() && activeConfig != null) {
                        String reason =
                                DeviceStatusPlugin.safetyViolation(
                                        getContext(),
                                        activeConfig,
                                        batteryFloor,
                                        chargingOnly
                                                || activeConfig.optBoolean(
                                                        "autoPauseOnBattery", false));
                        if (reason != null) stopForProtection(reason, sessionGeneration);
                    }
                    call.resolve();
                });
    }

    /**
     * After an unexpected exit, offer a restart that happens by itself if nobody answers. The
     * native layer owns the timer so it still fires while the WebView is suspended. A miner that
     * keeps crashing is not restarted again after CrashRestartPolicy.MAX_RESTARTS crashes in CrashRestartPolicy.WINDOW_MS.
     */
    private synchronized void scheduleCrashRestart(int exitCode) {
        cancelCrashRestart();
        if (activeConfig == null || !autoRestartOnCrash) return;
        int attempt = CrashRestartPolicy.recordCrash(crashTimes, SystemClock.elapsedRealtime());
        JSObject state = new JSObject();
        state.put("exitCode", exitCode == Integer.MIN_VALUE ? JSONObject.NULL : exitCode);
        state.put("attempt", attempt);
        state.put("maxAttempts", CrashRestartPolicy.MAX_RESTARTS);
        if (!CrashRestartPolicy.mayRestart(attempt)) {
            state.put("pending", false);
            state.put("exhausted", true);
            crashRestart = state;
            appendLog("Miner crashed repeatedly; automatic restart is off for this run.");
            return;
        }
        crashConfig = activeConfig;
        state.put("pending", true);
        state.put("deadlineAt", System.currentTimeMillis() + CrashRestartPolicy.DELAY_MS);
        crashRestart = state;
        appendLog("Miner crashed. Restarting in " + CrashRestartPolicy.DELAY_MS / 1000 + " s unless cancelled.");
        restartTask =
                restartTimer.schedule(
                        () -> {
                            if (!controlExecutor.isShutdown())
                                controlExecutor.execute(this::runCrashRestart);
                        },
                        CrashRestartPolicy.DELAY_MS,
                        TimeUnit.MILLISECONDS);
    }

    private synchronized void cancelCrashRestart() {
        if (restartTask != null) restartTask.cancel(false);
        restartTask = null;
        crashConfig = null;
        crashRestart = null;
    }

    /** Runs when the countdown ends or the user taps Restart now. Starts the same setup again. */
    private synchronized void runCrashRestart() {
        if (crashRestart == null || !crashRestart.optBoolean("pending") || crashConfig == null)
            return;
        JSObject config = crashConfig;
        JSObject attempt = crashRestart;
        if (restartTask != null) restartTask.cancel(false);
        restartTask = null;
        startOnWorker(
                config,
                true,
                new StartResult() {
                    public void resolve() {
                        crashRestart = null;
                        crashConfig = null;
                        appendLog("Miner restarted after a crash.");
                    }

                    public void reject(String message) {
                        attempt.put("pending", false);
                        attempt.put("failed", true);
                        attempt.put("message", message);
                        crashRestart = attempt;
                        lastMessage = "Automatic restart failed: " + message;
                        appendLog(lastMessage);
                    }
                });
    }

    public void restartAfterCrash(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    try {
                        runCrashRestart();
                        call.resolve(createStatus());
                    } catch (RuntimeException failure) {
                        call.reject(failure.getMessage(), failure);
                    }
                });
    }

    public void cancelRestartAfterCrash(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    cancelCrashRestart();
                    call.resolve(createStatus());
                });
    }

    private ProtectionEngine.Config protectionConfig(JSObject config) {
        return new ProtectionEngine.Config(
                config.optInt("thermalThreshold", 42),
                batteryFloor,
                chargingOnly || config.optBoolean("autoPauseOnBattery", false),
                config.optBoolean("autoPauseScreenOff", false));
    }

    private synchronized void stopForProtection(String reason, long generation) {
        if (generation != sessionGeneration || !isRunning()) return;
        try {
            transition("stopping", reasonCode(reason));
            stopMinerProcess();
            finishRecord(reasonCode(reason), reason, false);
            paused = !reason.startsWith("Stopped from the mining notification");
            poolConnected = false;
            apiTelemetryAvailable = false;
            lastMessage = reason + " Resume manually after checking the device.";
            appendLog(lastMessage);
        } catch (RuntimeException failure) {
            lastMessage = "Protection stop failed: " + failure.getMessage();
            appendLog(lastMessage);
        }
    }

    public void status(PluginCall call) {
        controlExecutor.execute(() -> call.resolve(createStatus()));
    }

    public void info(PluginCall call) {
        metadataExecutor.execute(() -> call.resolve(createInfo()));
    }

    public void download(PluginCall call) {
        String variant = normalizeMinerVariant(call.getString("variant", "tls"));

        if (!MinerIntegrity.hasApprovedDownload(DEVICE_ABI)) {
            call.reject(
                    "No approved miner download exists for this device ("
                            + (DEVICE_ABI == null ? Build.SUPPORTED_ABIS[0] : DEVICE_ABI)
                            + "). Use an APK that bundles the miner.");
            return;
        }

        if (isRunning()) {
            call.reject("Stop the active miner before downloading a replacement binary.");
            return;
        }

        File existing = findMinerBinary();
        boolean verified = false;
        if (existing != null) {
            try {
                verifyInstalledBinary(existing);
                verified = true;
            } catch (IOException ignored) {
                /* Keep the old file until a verified replacement is ready. */
            }
        }
        if (verified) {
            existing.setExecutable(true);
            synchronized (this) {
                lastMessage = "Miner binary is already installed.";
                appendLog(lastMessage);
            }
            call.resolve(createStatus());
            return;
        }

        controlExecutor.execute(
                () -> {
                    if (isRunning()) {
                        call.reject(
                                "Stop the active miner before downloading a replacement binary.");
                        return;
                    }
                    synchronized (NativeMiningRuntime.this) {
                        lastMessage =
                                "Downloading "
                                        + formatMinerVariant(variant)
                                        + " Android miner binary.";
                        lastFailureReason = "";
                        appendLog(lastMessage);
                    }

                    try {
                        File binary = downloadMinerBinary(variant);
                        saveInstalledMinerVariant(variant);
                        synchronized (NativeMiningRuntime.this) {
                            lastMessage =
                                    formatMinerVariant(variant)
                                            + " miner binary downloaded and ready.";
                            appendLog(lastMessage + " " + binary.getAbsolutePath());
                        }
                        call.resolve(createStatus());
                    } catch (IOException exception) {
                        synchronized (NativeMiningRuntime.this) {
                            lastMessage = "Miner download failed: " + exception.getMessage();
                            lastFailureReason = lastMessage;
                            appendLog(lastMessage);
                        }
                        call.reject(lastMessage);
                    }
                });
    }

    public void start(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    try {
                        cancelCrashRestart();
                        startOnWorker(
                                call.getObject("config", new JSObject()),
                                false,
                                new StartResult() {
                                    public void resolve() {
                                        call.resolve();
                                    }

                                    public void reject(String message) {
                                        call.reject(message);
                                    }
                                });
                    } catch (RuntimeException exception) {
                        call.reject(exception.getMessage(), exception);
                    }
                });
    }

    /** Receives the outcome of a start attempt, whether user- or crash-recovery-initiated. */
    private interface StartResult {
        void resolve();

        void reject(String message);
    }

    private synchronized void startOnWorker(
            JSObject config, boolean automatic, StartResult call) {
        if (isRunning()) {
            call.resolve();
            return;
        }

        File binary = findMinerBinary();
        if (binary == null) {
            appendLog("Android miner binary is not installed.");
            call.reject(
                    "Miner binary is not installed. Download the Android XMRig binary before starting.");
            return;
        }

        try {
            OwnedMinerProcess.stopOrphans(getContext());
            verifyInstalledBinary(binary);
        } catch (IOException failure) {
            call.reject(failure.getMessage());
            return;
        }
        if (MinerAbi.ARM32.equals(DEVICE_ABI) && !MinerAbi.cpuInfoHasNeon(readCpuInfo())) {
            call.reject(
                    "This 32-bit ARM CPU does not report NEON, which the armeabi-v7a miner requires.");
            return;
        }
        String wallet = config.getString("walletAddress", "").trim();
        String host = config.getString("poolUrl", "").trim();
        int port = config.getInteger("poolPort", 0);
        if (wallet.isEmpty()
                || wallet.toUpperCase(Locale.ROOT).startsWith("YOUR_")
                || host.isEmpty()
                || host.matches(".*\\s.*")
                || port < 1
                || port > 65535) {
            call.reject("Enter a wallet or pool username, host, and valid port before mining.");
            return;
        }
        if (!activityVisible && !automatic) {
            call.reject("Open AndroMiner before starting a mining session.");
            return;
        }
        if (!MiningGuardService.notificationsEnabled(getContext())
                || (Build.VERSION.SDK_INT >= 33
                        && ContextCompat.checkSelfPermission(
                                        getContext(), Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED)) {
            call.reject(
                    "Allow AndroMiner notifications in Android settings before mining. The session requires a visible Stop control.");
            return;
        }
        String safetyReason =
                DeviceStatusPlugin.safetyViolation(
                        getContext(),
                        config,
                        batteryFloor,
                        chargingOnly || config.optBoolean("autoPauseOnBattery", false));
        if (safetyReason != null) {
            call.reject(safetyReason);
            return;
        }
        int duration = config.optInt("maxDurationMinutes", 0);
        if (duration < 0 || duration > 1440) {
            call.reject("Session duration must be 0–1440 minutes.");
            return;
        }
        if (usesTls(normalizeProtocol(config.getString("protocol", "stratum+tcp")))
                && "notls"
                        .equals(
                                resolveInstalledMinerVariant(
                                        resolveMinerSource(binary),
                                        normalizeApkVariant(BuildConfig.ANDROMINER_APK_VARIANT),
                                        ""))) {
            call.reject(
                    "This miner does not support TLS. Install the TLS variant; encryption will not be disabled.");
            return;
        }
        activeConfig = config;
        String hardwareMode = normalizeHardwareMode(config.getString("hardwareMode", "cpu"));
        int requestedThreads =
                bounded(
                        config.getInteger(
                                "threadCount", Runtime.getRuntime().availableProcessors()),
                        1,
                        Math.max(1, Runtime.getRuntime().availableProcessors()));
        CpuAffinityPlan affinityPlan =
                resolveCpuAffinity(config.getString("affinity", "auto"), requestedThreads);

        apiPort = findAvailableApiPort();
        apiToken = "androminer-" + UUID.randomUUID();
        apiTelemetryAvailable = false;
        lastApiTelemetryAtMs = 0;
        apiTelemetryMessage = "Waiting for XMRig HTTP API telemetry.";
        String poolEndpoint =
                buildPoolEndpoint(
                        config.getString("protocol", "stratum+tcp"),
                        config.getString("poolUrl", ""),
                        config.getInteger("poolPort", 3333));
        List<String> command = buildCommand(binary, config, apiPort, apiToken);

        try {
            beginRecord(config);
            final long generation = ++sessionGeneration;
            MiningGuardService.begin(
                    getContext(),
                    new MiningGuardService.Session() {
                        public String check() {
                            return checkSession(config, generation);
                        }

                        public String label() {
                            return sessionLabel();
                        }

                        public void stop(String reason) {
                            if (!controlExecutor.isShutdown())
                                controlExecutor.execute(
                                        () -> stopForProtection(reason, generation));
                        }
                    });
            binary.setExecutable(true);
            File pidFile = new File(getContext().getCacheDir(), "androminer-miner.pid");
            if (pidFile.exists()) {
                pidFile.delete();
            }

            ProcessBuilder builder =
                    new ProcessBuilder(buildShellLaunchCommand(command, pidFile, affinityPlan));
            builder.redirectErrorStream(true);
            builder.directory(binary.getParentFile());
            minerProcess = builder.start();
            minerPid = readPidFile(pidFile);
            if (minerPid <= 0) {
                minerPid = resolveProcessPid(minerProcess);
            }
            protection = new ProtectionEngine(protectionConfig(config));
            if (throttle != null) throttle.shutdown();
            throttle = new MinerThrottle(() -> minerPid);
            measuredIntensity = 100;
            stoppedUptimeSeconds = 0;
            hashrate = 0;
            difficulty = 0;
            networkLatencyMs = 0;
            resetCpuUsageSampling();
            acceptedShares = 0;
            rejectedShares = 0;
            activeThreads = 0;
            activeHardwareMode = hardwareMode;
            lastMessage = "Native miner process started.";
            lastFailureReason = "";
            lastExitCode = Integer.MIN_VALUE;
            stopRequested = false;
            paused = false;
            poolConnected = false;
            lastStdoutHashrateAtMs = 0;
            stdoutHashrate = 0;
            clearLogs();
            appendLog(lastMessage);
            appendLog("Pool endpoint: " + poolEndpoint);
            appendLog("XMRig API: http://" + API_HOST + ":" + apiPort + "/2/summary");
            appendLog("CPU affinity: " + affinityPlan.describe());
            appendLog(
                    "Hardware mode: "
                            + formatHardwareMode(hardwareMode)
                            + ", threads: "
                            + requestedThreads
                            + ", priority: "
                            + config.getString("priority", "low"));
            transition("connecting", "process_started");
            checkpoint(true);
            Process startedProcess = minerProcess;
            outputExecutor.execute(() -> readMinerOutput(startedProcess));
            call.resolve();
        } catch (Exception exception) {
            stopMinerProcess();
            MiningGuardService.end(getContext());
            lastMessage = exception.getMessage();
            finishRecord("start_failed", "Native miner could not start.", true);
            appendLog("Failed to start native miner: " + exception.getMessage());
            call.reject("Failed to start native miner: " + exception.getMessage());
        }
    }

    public void pause(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    try {
                        pauseOnWorker(call);
                    } catch (RuntimeException exception) {
                        call.reject(exception.getMessage(), exception);
                    }
                });
    }

    private synchronized void pauseOnWorker(PluginCall call) {
        cancelCrashRestart();
        transition("stopping", "manual_pause");
        stopMinerProcess();
        finishRecord("manual_pause", "Paused by the user; resume requires a new start.", false);
        hashrate = 0;
        activeThreads = 0;
        minerPid = -1;
        activeHardwareMode = "cpu";
        resetCpuUsageSampling();
        paused = true;
        poolConnected = false;
        apiTelemetryAvailable = false;
        lastMessage = "Native miner paused.";
        appendLog(lastMessage);
        call.resolve(createStatus());
    }

    public void stop(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    try {
                        stopOnWorker(call);
                    } catch (RuntimeException exception) {
                        call.reject(exception.getMessage(), exception);
                    }
                });
    }

    private synchronized void stopOnWorker(PluginCall call) {
        cancelCrashRestart();
        transition("stopping", "manual_stop");
        stopMinerProcess();
        finishRecord("manual_stop", "Stopped by the user.", false);
        hashrate = 0;
        minerPid = -1;
        resetCpuUsageSampling();
        activeThreads = 0;
        activeHardwareMode = "cpu";
        apiTelemetryAvailable = false;
        lastApiTelemetryAtMs = 0;
        apiTelemetryMessage = "XMRig API telemetry stopped.";
        paused = false;
        poolConnected = false;
        lastMessage = "Native miner stopped.";
        appendLog(lastMessage);
        call.resolve(createStatus());
    }

    void deleteHistory(PluginCall call) {
        controlExecutor.execute(
                () -> {
                    try {
                        journal.delete(call.getString("id"));
                        call.resolve(createStatus());
                    } catch (RuntimeException failure) {
                        call.reject("Could not delete native session history.");
                    }
                });
    }

    private synchronized void beginRecord(JSObject config) {
        long now = System.currentTimeMillis();
        JSObject coin = config.getJSObject("coin");
        if (coin == null) coin = new JSObject();
        sessionRecord = new JSObject();
        sessionRecord.put("id", UUID.randomUUID().toString());
        sessionRecord.put("startedAt", now);
        sessionRecord.put("updatedAt", now);
        sessionRecord.put("endedAt", JSONObject.NULL);
        sessionRecord.put("coinId", coin.optString("id"));
        sessionRecord.put("coinSymbol", coin.optString("symbol"));
        sessionRecord.put("algorithm", coin.optString("xmrigAlgo"));
        sessionRecord.put("pool", config.optString("poolUrl") + ":" + config.optInt("poolPort"));
        sessionRecord.put("requestedThreads", config.optInt("threadCount"));
        sessionRecord.put("priority", config.optString("priority"));
        sessionRecord.put("affinity", config.optString("affinity"));
        String version = parseMinerVersion(readMinerVersionOutput(findMinerBinary()));
        sessionRecord.put("minerVersion", version.isEmpty() ? JSONObject.NULL : version);
        sessionRecord.put("appVersion", BuildConfig.VERSION_NAME);
        sessionRecord.put("apkVariant", BuildConfig.ANDROMINER_APK_VARIANT);
        sessionRecord.put("sampleSource", "xmrig-stdout-10s");
        sessionRecord.put("sampleWindowSeconds", 10);
        sessionRecord.put("durationSeconds", 0);
        sessionRecord.put("hashingSeconds", 0);
        sessionRecord.put("averageHashrate", JSONObject.NULL);
        sessionRecord.put("acceptedShares", 0);
        sessionRecord.put("rejectedShares", 0);
        sessionRecord.put("events", new JSArray());
        int minutes = config.optInt("maxDurationMinutes", 0);
        sessionRecord.put("deadlineAt", minutes == 0 ? JSONObject.NULL : now + minutes * 60_000L);
        sampleTotal = 0;
        sampleCount = 0;
        stoppedUptimeSeconds = 0;
        acceptedShares = 0;
        rejectedShares = 0;
        startedAtMs = SystemClock.elapsedRealtime();
        sessionClock.start(startedAtMs, minutes);
        transition("starting", "user_start");
        journal.save(sessionRecord);
        storageError = "";
    }

    private synchronized void transition(String state, String reason) {
        if (sessionRecord == null
                || !sessionRecord.isNull("endedAt")
                || state.equals(sessionRecord.optString("state"))) return;
        long now = System.currentTimeMillis();
        sessionRecord.put("state", state);
        sessionRecord.put("stateChangedAt", now);
        sessionRecord.put("reasonCode", reason);
        JSONArray events = sessionRecord.optJSONArray("events");
        JSArray bounded = new JSArray();
        if (events != null)
            for (int i = Math.max(0, events.length() - 49); i < events.length(); i++)
                bounded.put(events.opt(i));
        JSObject event = new JSObject();
        event.put("at", now);
        event.put("state", state);
        event.put("reasonCode", reason);
        bounded.put(event);
        sessionRecord.put("events", bounded);
    }

    private synchronized void checkpoint(boolean force) {
        if (sessionRecord == null || !sessionRecord.isNull("endedAt")) return;
        long now = SystemClock.elapsedRealtime();
        sessionRecord.put("updatedAt", System.currentTimeMillis());
        sessionRecord.put(
                "durationSeconds",
                isRunning() ? sessionClock.uptimeSeconds(now) : stoppedUptimeSeconds);
        sessionRecord.put("hashingSeconds", sessionClock.hashingSeconds());
        sessionRecord.put("acceptedShares", acceptedShares);
        sessionRecord.put("rejectedShares", rejectedShares);
        sessionRecord.put("effectiveThreads", activeThreads > 0 ? activeThreads : JSONObject.NULL);
        sessionRecord.put("sampleCount", sampleCount);
        sessionRecord.put(
                "averageHashrate", sampleCount > 0 ? sampleTotal / sampleCount : JSONObject.NULL);
        if (force || now - lastCheckpoint >= 10_000) {
            journal.save(sessionRecord);
            lastCheckpoint = now;
        }
    }

    private synchronized void finishRecord(String code, String reason, boolean failed) {
        if (sessionRecord == null || !sessionRecord.isNull("endedAt")) return;
        try {
            sessionClock.sample(SystemClock.elapsedRealtime(), false);
            checkpoint(false);
            transition(failed ? "failed" : "stopped", code);
            sessionRecord.put("endedAt", System.currentTimeMillis());
            sessionRecord.put("endReason", reason);
            journal.save(sessionRecord);
            storageError = "";
        } catch (RuntimeException failure) {
            storageError =
                    "The final session record could not be saved. The last checkpoint is retained.";
        }
    }

    private synchronized String checkSession(JSObject config, long generation) {
        if (generation != sessionGeneration || !isRunning()) return null;
        if (!MiningGuardService.notificationsEnabled(getContext()))
            return "Mining notifications were disabled.";
        String stopReason = applyProtection(config);
        if (stopReason != null) return stopReason;
        long now = SystemClock.elapsedRealtime();
        sessionClock.sample(
                now,
                poolConnected && stdoutHashrate > 0 && now - lastStdoutHashrateElapsed <= 10_000);
        if (sessionClock.expired(now)) return "Session duration limit reached.";
        transition(
                poolConnected && stdoutHashrate > 0 && now - lastStdoutHashrateElapsed <= 10_000
                        ? "running"
                        : "connecting",
                "watchdog");
        try {
            checkpoint(false);
        } catch (RuntimeException failure) {
            storageError =
                    "Session history could not be saved. Mining stopped to preserve a recoverable record.";
            return storageError;
        }
        return null;
    }

    private static final int MAX_PROTECTION_EVENTS = 30;

    /**
     * Reads the device, runs the policy, enforces the resulting intensity on the real process and
     * records every change. Returns a stop reason when the policy reaches Critical. A failed read
     * throws: the watchdog treats that as a monitoring failure and stops mining.
     */
    private synchronized String applyProtection(JSObject config) {
        if (protection == null || sessionRecord == null) return null;
        ProtectionEngine.Input input = DeviceStatusPlugin.readProtectionInput(getContext());
        ProtectionEngine.Decision decision = protection.evaluate(input);
        if (decision.state != ProtectionEngine.State.CRITICAL && throttle != null) {
            throttle.setIntensity(decision.intensityPercent);
            measuredIntensity = throttle.measuredPercent();
        }
        JSONArray log = sessionRecord.optJSONArray("protectionEvents");
        JSArray events = new JSArray();
        if (log != null)
            for (int i = Math.max(0, log.length() - (MAX_PROTECTION_EVENTS - 1)); i < log.length(); i++)
                events.put(log.opt(i));
        for (ProtectionEngine.Event event : decision.events) {
            events.put(protectionEventJson(event));
            appendLog(
                    "Protection "
                            + event.type
                            + ": "
                            + event.previousState
                            + " -> "
                            + event.newState
                            + " ("
                            + event.trigger
                            + ")");
        }
        sessionRecord.put("protectionEvents", events);
        JSObject seconds = new JSObject();
        seconds.put("caution", protection.secondsIn(ProtectionEngine.State.CAUTION));
        seconds.put("throttled", protection.secondsIn(ProtectionEngine.State.THROTTLED));
        sessionRecord.put("protectionSeconds", seconds);
        JSObject snapshot = protectionSnapshot(input, decision);
        sessionRecord.put("protection", snapshot);
        if (!snapshot.isNull("batteryTemperatureC") && !snapshot.isNull("batteryPercent"))
            sessionRecord.put("lastValidProtection", snapshot);
        if (!decision.events.isEmpty()) checkpoint(true);
        return decision.stopReason;
    }

    private static Object nullable(Object value) {
        return value == null ? JSONObject.NULL : value;
    }

    private JSObject protectionEventJson(ProtectionEngine.Event event) {
        JSObject json = new JSObject();
        json.put("type", event.type);
        json.put("at", System.currentTimeMillis());
        json.put("trigger", event.trigger);
        json.put("sensor", nullable(event.sensor));
        json.put("value", nullable(event.value));
        json.put("unit", nullable(event.unit));
        json.put("threshold", nullable(event.threshold));
        json.put("previousState", event.previousState.name().toLowerCase(Locale.US));
        json.put("newState", event.newState.name().toLowerCase(Locale.US));
        json.put("previousIntensity", event.previousIntensity);
        json.put("newIntensity", event.newIntensity);
        json.put("action", event.action);
        json.put("recovery", event.recovery);
        return json;
    }

    /** Current readings with their freshness. Contains no wallet, pool or credential data. */
    private JSObject protectionSnapshot(
            ProtectionEngine.Input input, ProtectionEngine.Decision decision) {
        JSObject json = new JSObject();
        long now = input.nowMs;
        json.put("at", System.currentTimeMillis());
        json.put("state", decision.state.name().toLowerCase(Locale.US));
        json.put("trigger", decision.trigger);
        json.put("configuredIntensity", 100);
        json.put("targetIntensity", decision.intensityPercent);
        json.put("measuredIntensity", measuredIntensity);
        json.put("recoveryRemainingMs", protection.recoveryRemainingMs(now));
        json.put("batteryTemperatureC", nullable(input.batteryTemperatureC));
        json.put("batteryPercent", nullable(input.batteryPercent));
        json.put("charging", input.charging);
        json.put("androidThermalLevel", nullable(input.thermalStatus));
        json.put("androidThermalSupported", input.thermalSupported);
        json.put("cpuTemperatureC", nullable(input.cpuTemperatureC));
        JSObject age = new JSObject();
        age.put("batteryTemperature", protection.ageMs("batteryTemperature", now));
        age.put("batteryPercent", protection.ageMs("batteryPercent", now));
        age.put("androidThermalStatus", protection.ageMs("thermalStatus", now));
        age.put("cpuTemperature", protection.ageMs("cpuTemperature", now));
        json.put("ageMs", age);
        json.put("staleAfterMs", ProtectionEngine.STALE_AFTER_MS);
        json.put("temperatureLimitC", protection.config().temperatureLimitC);
        json.put("batteryFloorPercent", protection.config().batteryFloorPercent);
        return json;
    }

    private synchronized String sessionLabel() {
        String state =
                sessionRecord == null ? "starting" : sessionRecord.optString("state", "starting");
        return "running".equals(state)
                ? "Hashing"
                : "connecting".equals(state)
                        ? "Connecting / waiting for work"
                        : "stopping".equals(state) ? "Stopping" : "Starting";
    }

    private static String reasonCode(String reason) {
        if (reason.startsWith("Stopped from")) return "manual_stop";
        if (reason.startsWith("Session duration")) return "timer";
        if (reason.contains("history")) return "storage_failure";
        if (reason.contains("notification")) return "notification_unavailable";
        if (reason.contains("service") || reason.contains("recent apps")) return "service_ended";
        if (reason.contains("screen") || reason.contains("background")) return "background_policy";
        return "protection";
    }

    private List<String> buildCommand(File binary, JSObject config, int apiPort, String apiToken) {
        String protocol = config.getString("protocol", "stratum+tcp");
        String poolUrl = config.getString("poolUrl", "");
        int poolPort = config.getInteger("poolPort", 3333);
        String walletAddress = config.getString("walletAddress", "").trim();
        String workerName = config.getString("workerName", "android-phone").trim();
        String password = config.getString("password", "x");
        int threadCount =
                bounded(
                        config.getInteger("threadCount", 1),
                        1,
                        Math.max(1, Runtime.getRuntime().availableProcessors()));
        int donateLevel = bounded(config.getInteger("donateLevel", 0), 0, 99);
        int donateOverProxy = bounded(config.getInteger("donateOverProxy", 1), 0, 2);
        String priority = config.getString("priority", "low");
        JSObject coin = config.getJSObject("coin");
        String algo = coin == null ? "rx/0" : coin.getString("xmrigAlgo", "rx/0");
        String user = walletAddress;

        if (!workerName.isBlank() && !walletAddress.contains(".")) {
            user = walletAddress + "." + workerName;
        }

        List<String> command = new ArrayList<>();
        command.add(binary.getAbsolutePath());
        command.add("--algo=" + algo);
        command.add("--url=" + buildPoolEndpoint(protocol, poolUrl, poolPort));
        command.add("--user=" + user);
        command.add("--pass=" + password);
        command.add("--threads=" + threadCount);
        command.add("--cpu-priority=" + mapCpuPriority(priority));
        command.add("--donate-level=" + donateLevel);
        command.add("--donate-over-proxy=" + donateOverProxy);
        if (MinerAbi.ARM32.equals(DEVICE_ABI)) {
            /* 32-bit: the 2 GB RandomX dataset does not fit reliably in the address space. */
            command.add("--randomx-mode=light");
        }
        command.add("--no-color");
        command.add("--print-time=2");
        command.add("--api-id=androminer-android");
        command.add("--api-worker-id=" + (workerName.isBlank() ? "android-phone" : workerName));
        command.add("--http-host=" + API_HOST);
        command.add("--http-port=" + apiPort);
        command.add("--http-access-token=" + apiToken);

        String normalizedProtocol = normalizeProtocol(protocol);

        if (usesDaemonMode(normalizedProtocol)) {
            command.add("--daemon");
        }

        if ("nicehash".equals(normalizedProtocol)) {
            command.add("--nicehash");
        }

        if (usesTls(normalizedProtocol)) {
            command.add("--tls");
        }

        return command;
    }

    private int mapCpuPriority(String priority) {
        String normalized = priority == null ? "low" : priority.toLowerCase(Locale.US);
        switch (normalized) {
            case "high":
                return 2;
            case "normal":
                return 1;
            default:
                return 0;
        }
    }

    private int bounded(int value, int min, int max) {
        return Math.min(max, Math.max(min, value));
    }

    private double bounded(double value, double min, double max) {
        return Math.min(max, Math.max(min, value));
    }

    private String buildPoolEndpoint(String protocol, String host, int port) {
        String normalizedProtocol = normalizeProtocol(protocol);
        String normalizedHost = host == null ? "" : host.trim();

        if (normalizedHost.contains("://")) {
            return hasExplicitPort(normalizedHost) ? normalizedHost : normalizedHost + ":" + port;
        }

        if (normalizedProtocol.isBlank()
                || normalizedProtocol.equals("stratum")
                || normalizedProtocol.equals("stratum+tcp")) {
            return normalizedHost + ":" + port;
        }

        if (normalizedProtocol.equals("http") || normalizedProtocol.equals("https")) {
            return normalizedProtocol + "://" + normalizedHost + ":" + port;
        }

        return normalizedHost + ":" + port;
    }

    private String normalizeProtocol(String protocol) {
        return protocol == null ? "" : protocol.trim().toLowerCase(Locale.US);
    }

    private boolean usesTls(String protocol) {
        return protocol.contains("ssl") || protocol.contains("tls") || protocol.equals("https");
    }

    private boolean usesDaemonMode(String protocol) {
        return protocol.equals("daemon")
                || protocol.equals("daemon+ssl")
                || protocol.equals("solo")
                || protocol.equals("http")
                || protocol.equals("https");
    }

    private boolean hasExplicitPort(String endpoint) {
        int slashIndex = endpoint.indexOf("://");
        String hostAndPath = slashIndex >= 0 ? endpoint.substring(slashIndex + 3) : endpoint;
        int pathIndex = hostAndPath.indexOf("/");
        String host = pathIndex >= 0 ? hostAndPath.substring(0, pathIndex) : hostAndPath;
        return host.matches(".*:[0-9]+$");
    }

    private List<String> buildShellLaunchCommand(
            List<String> command, File pidFile, CpuAffinityPlan affinityPlan) {
        List<String> shellCommand = new ArrayList<>();
        StringBuilder script = new StringBuilder();
        script.append("echo $$ > ").append(shellQuote(pidFile.getAbsolutePath())).append("; ");

        if (affinityPlan != null && affinityPlan.hasMask()) {
            List<String> tasksetProbe = new ArrayList<>();
            tasksetProbe.add("taskset");
            tasksetProbe.add(affinityPlan.tasksetMask());
            tasksetProbe.add("/system/bin/sh");
            tasksetProbe.add("-c");
            tasksetProbe.add(":");

            List<String> tasksetCommand = new ArrayList<>();
            tasksetCommand.add("taskset");
            tasksetCommand.add(affinityPlan.tasksetMask());
            tasksetCommand.addAll(command);

            script.append("if command -v taskset >/dev/null 2>&1 &&");
            appendShellArguments(script, tasksetProbe);
            script.append(" >/dev/null 2>&1; then exec");
            appendShellArguments(script, tasksetCommand);
            script.append("; else echo 'CPU affinity unavailable; using Android scheduler'; fi; ");
        }

        script.append("exec");
        appendShellArguments(script, command);

        shellCommand.add("/system/bin/sh");
        shellCommand.add("-c");
        shellCommand.add(script.toString());
        return shellCommand;
    }

    private void appendShellArguments(StringBuilder script, List<String> arguments) {
        for (String part : arguments) {
            script.append(" ").append(shellQuote(part));
        }
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private CpuAffinityPlan resolveCpuAffinity(String affinity, int threadCount) {
        String normalized = normalizeCpuAffinity(affinity);
        if (!normalized.equals("big") && !normalized.equals("little")) {
            return CpuAffinityPlan.none(normalized);
        }

        int cpuCount = Math.max(1, Runtime.getRuntime().availableProcessors());
        List<CpuCoreInfo> cores = readCpuCoreInfo(cpuCount);
        List<Integer> selectedCores = selectCoresByFrequency(normalized, cores);
        if (selectedCores.isEmpty()) {
            selectedCores = selectCoresByIndex(normalized, cpuCount);
        }

        long mask = createCpuMask(selectedCores);
        if (mask <= 0) {
            return CpuAffinityPlan.none(normalized);
        }

        return new CpuAffinityPlan(normalized, mask, selectedCores, threadCount);
    }

    private String normalizeCpuAffinity(String affinity) {
        if (affinity == null) {
            return "auto";
        }

        String normalized = affinity.trim().toLowerCase(Locale.US);
        if (normalized.equals("little")
                || normalized.equals("big")
                || normalized.equals("custom")) {
            return normalized;
        }

        return "auto";
    }

    private List<CpuCoreInfo> readCpuCoreInfo(int cpuCount) {
        List<CpuCoreInfo> cores = new ArrayList<>();
        for (int index = 0; index < cpuCount; index += 1) {
            cores.add(new CpuCoreInfo(index, readCpuMaxFrequencyKhz(index)));
        }

        return cores;
    }

    private long readCpuMaxFrequencyKhz(int cpuIndex) {
        File cpuDirectory = new File("/sys/devices/system/cpu/cpu" + cpuIndex);
        File[] candidates = {
            new File(cpuDirectory, "cpufreq/cpuinfo_max_freq"),
            new File(cpuDirectory, "cpufreq/scaling_max_freq"),
            new File(cpuDirectory, "cpufreq/scaling_cur_freq")
        };

        long best = -1;
        for (File candidate : candidates) {
            Long value = readLong(candidate);
            if (value != null && value > best) {
                best = value;
            }
        }

        return best;
    }

    private Long readLong(File file) {
        String raw = readFirstLine(file);
        if (raw == null) {
            return null;
        }

        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String readFirstLine(File file) {
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            return reader.readLine();
        } catch (IOException exception) {
            return null;
        }
    }

    private List<Integer> selectCoresByFrequency(String affinity, List<CpuCoreInfo> cores) {
        List<Integer> selected = new ArrayList<>();
        long fastestKhz = 0;
        for (CpuCoreInfo core : cores) {
            fastestKhz = Math.max(fastestKhz, core.maxFrequencyKhz);
        }

        if (fastestKhz <= 0) {
            return selected;
        }

        double performanceThreshold = fastestKhz * PERFORMANCE_CORE_FREQ_RATIO;
        for (CpuCoreInfo core : cores) {
            if (core.maxFrequencyKhz <= 0) {
                continue;
            }

            boolean isPerformanceCore = core.maxFrequencyKhz >= performanceThreshold;
            if ((affinity.equals("big") && isPerformanceCore)
                    || (affinity.equals("little") && !isPerformanceCore)) {
                selected.add(core.index);
            }
        }

        return selected;
    }

    private List<Integer> selectCoresByIndex(String affinity, int cpuCount) {
        List<Integer> selected = new ArrayList<>();
        int splitIndex = Math.max(1, cpuCount / 2);
        for (int index = 0; index < cpuCount; index += 1) {
            if ((affinity.equals("big") && index >= splitIndex)
                    || (affinity.equals("little") && index < splitIndex)) {
                selected.add(index);
            }
        }

        return selected;
    }

    private long createCpuMask(List<Integer> cores) {
        long mask = 0;
        for (int core : cores) {
            if (core >= 0 && core < Long.SIZE - 1) {
                mask |= 1L << core;
            }
        }

        return mask;
    }

    private int readPidFile(File pidFile) {
        for (int attempt = 0; attempt < 10; attempt += 1) {
            if (pidFile.exists()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(pidFile))) {
                    String line = reader.readLine();
                    if (line != null) {
                        int pid = Integer.parseInt(line.trim());
                        if (pid > 0) {
                            return pid;
                        }
                    }
                } catch (IOException | NumberFormatException ignored) {
                    // Retry briefly; the shell may still be writing the pid file.
                }
            }

            try {
                Thread.sleep(20);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return -1;
            }
        }

        return -1;
    }

    private int resolveProcessPid(Process process) {
        if (process == null) {
            return -1;
        }

        try {
            Method pidMethod = Process.class.getMethod("pid");
            Object value = pidMethod.invoke(process);
            if (value instanceof Long) {
                long pid = (Long) value;
                return pid > 0 && pid <= Integer.MAX_VALUE ? (int) pid : -1;
            }
        } catch (Exception ignored) {
            // Android API levels before Java 9 may not expose Process.pid().
        }

        try {
            Field pidField = process.getClass().getDeclaredField("pid");
            pidField.setAccessible(true);
            Object value = pidField.get(process);
            if (value instanceof Integer) {
                return (Integer) value;
            }
            if (value instanceof Long) {
                long pid = (Long) value;
                return pid > 0 && pid <= Integer.MAX_VALUE ? (int) pid : -1;
            }
        } catch (Exception ignored) {
            // If Android blocks reflective PID access, CPU telemetry remains unavailable.
        }

        return -1;
    }

    private void resetCpuUsageSampling() {
        minerCpuUsage = 0;
        minerCpuUsageAvailable = false;
        lastMinerCpuJiffies = 0;
        lastCpuSampleAtMs = 0;
    }

    private void updateCpuUsageSampling() {
        long nowMs = System.currentTimeMillis();
        long minerJiffies = minerPid > 0 ? readProcessCpuJiffies(minerPid) : -1;

        if (lastCpuSampleAtMs > 0) {
            long elapsedMs = Math.max(1, nowMs - lastCpuSampleAtMs);

            if (minerJiffies >= 0
                    && lastMinerCpuJiffies >= 0
                    && minerJiffies >= lastMinerCpuJiffies) {
                long minerDelta = minerJiffies - lastMinerCpuJiffies;
                double capacityJiffies =
                        (elapsedMs / 1000.0)
                                * 100.0
                                * Math.max(1, Runtime.getRuntime().availableProcessors());
                if (capacityJiffies > 0) {
                    minerCpuUsage = bounded((minerDelta * 100.0) / capacityJiffies, 0, 100);
                    minerCpuUsageAvailable = true;
                }
            }
        }

        if (minerJiffies >= 0) {
            lastMinerCpuJiffies = minerJiffies;
        }

        lastCpuSampleAtMs = nowMs;
    }

    private long readProcessCpuJiffies(int pid) {
        if (pid <= 0) {
            return -1;
        }

        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/" + pid + "/stat"))) {
            String line = reader.readLine();
            if (line == null) {
                return -1;
            }

            int commandEnd = line.lastIndexOf(')');
            if (commandEnd < 0 || commandEnd + 2 >= line.length()) {
                return -1;
            }

            String[] parts = line.substring(commandEnd + 2).trim().split("\\s+");
            if (parts.length <= 12) {
                return -1;
            }

            long userJiffies = Long.parseLong(parts[11]);
            long systemJiffies = Long.parseLong(parts[12]);
            return userJiffies + systemJiffies;
        } catch (IOException | NumberFormatException exception) {
            return -1;
        }
    }

    private JSObject createInfo() {
        File binary = findMinerBinary();
        String apkVariant = normalizeApkVariant(BuildConfig.ANDROMINER_APK_VARIANT);

        JSObject result = new JSObject();
        result.put("apkVariant", apkVariant);
        result.put("apkVariantLabel", formatApkVariant(apkVariant));
        result.put("miner", createMinerInfo(binary, apkVariant));
        return result;
    }

    private JSObject createMinerInfo(File binary, String apkVariant) {
        JSObject miner = new JSObject();
        boolean installed = binary != null;
        String source = resolveMinerSource(binary);
        String versionOutput = installed ? readMinerVersionOutput(binary) : "";
        String version = parseMinerVersion(versionOutput);
        String variant = resolveInstalledMinerVariant(source, apkVariant, versionOutput);

        miner.put("installed", installed);
        miner.put("version", version);
        miner.put("versionOutput", versionOutput);
        miner.put("variant", variant);
        miner.put("variantLabel", formatInstalledMinerVariant(variant));
        miner.put("source", source);
        miner.put("sourceLabel", formatMinerSource(source));
        miner.put("abi", DEVICE_ABI == null ? "unsupported" : DEVICE_ABI);
        miner.put("fileName", installed ? binary.getName() : "libxmrig.so");
        miner.put("path", installed ? binary.getAbsolutePath() : "");
        miner.put("sizeBytes", installed ? binary.length() : null);
        miner.put("lastModifiedAt", installed ? binary.lastModified() : null);
        miner.put("targetSdkVersion", getContext().getApplicationInfo().targetSdkVersion);

        JSObject capabilities = new JSObject();
        capabilities.put("cpu", installed);
        capabilities.put("cuda", false);
        miner.put("capabilities", capabilities);

        return miner;
    }

    private JSObject createStatus() {
        File binary = findMinerBinary();
        boolean trusted = binary != null;
        if (trusted && !isRunning()) {
            try {
                if (!binary.getAbsolutePath().equals(verifiedPath)
                        || binary.length() != verifiedLength
                        || binary.lastModified() != verifiedModified) verifyInstalledBinary(binary);
            } catch (IOException failure) {
                trusted = false;
                lastMessage = failure.getMessage();
            }
        }
        boolean running;
        String message;
        String failureReason;
        int exitCode;
        boolean unexpectedExit;
        double fallbackHashrate;
        long fallbackDifficulty;
        int fallbackNetworkLatencyMs;
        double fallbackMinerCpuUsage;
        boolean fallbackMinerCpuUsageAvailable;
        int fallbackAcceptedShares;
        int fallbackRejectedShares;
        int fallbackActiveThreads;
        long fallbackUptimeSeconds;
        int telemetryPort;
        String telemetryToken;
        boolean telemetryAvailable;
        long telemetryUpdatedAt;
        String telemetryMessage;
        String hardwareModeSnapshot;
        List<String> logSnapshot;

        synchronized (this) {
            running = isRunning();
            message =
                    binary == null
                            ? "Android miner download is required before the first mining session."
                            : lastMessage;
            failureReason = lastFailureReason;
            exitCode = lastExitCode;
            unexpectedExit =
                    (lastExitCode != Integer.MIN_VALUE && !stopRequested)
                            || (sessionRecord != null
                                    && "failed".equals(sessionRecord.optString("state")));
            fallbackHashrate = running ? stdoutHashrate : 0;
            fallbackDifficulty = difficulty;
            fallbackNetworkLatencyMs = networkLatencyMs;
            if (running) {
                updateCpuUsageSampling();
            } else {
                resetCpuUsageSampling();
            }
            fallbackMinerCpuUsage = running ? minerCpuUsage : 0;
            fallbackMinerCpuUsageAvailable = running && minerCpuUsageAvailable;
            fallbackAcceptedShares = acceptedShares;
            fallbackRejectedShares = rejectedShares;
            fallbackActiveThreads = running ? activeThreads : 0;
            fallbackUptimeSeconds =
                    running
                            ? (SystemClock.elapsedRealtime() - startedAtMs) / 1000
                            : stoppedUptimeSeconds;
            telemetryPort = apiPort;
            telemetryToken = apiToken;
            telemetryAvailable = apiTelemetryAvailable;
            telemetryUpdatedAt = lastApiTelemetryAtMs;
            telemetryMessage = apiTelemetryMessage;
            hardwareModeSnapshot = activeHardwareMode;
            logSnapshot = new ArrayList<>(recentLogs);
        }

        ApiTelemetry telemetry = null;
        if (running && telemetryPort > 0 && !telemetryToken.isBlank()) {
            telemetry = fetchApiTelemetry(telemetryPort, telemetryToken);

            synchronized (this) {
                apiTelemetryAvailable = telemetry.available;
                lastApiTelemetryAtMs =
                        telemetry.available ? System.currentTimeMillis() : lastApiTelemetryAtMs;
                apiTelemetryMessage = telemetry.message;
                telemetryAvailable = apiTelemetryAvailable;
                telemetryUpdatedAt = lastApiTelemetryAtMs;
                telemetryMessage = apiTelemetryMessage;

                if (telemetry.available) {
                    hashrate = telemetry.hashrate;
                    poolConnected =
                            telemetry.connectionJson != null
                                    && telemetry.connectionJson.optLong(
                                                    "uptime_ms",
                                                    telemetry.connectionJson.optLong("uptime", 0)
                                                            * 1000)
                                            > 0;
                    acceptedShares = telemetry.acceptedShares;
                    rejectedShares = telemetry.rejectedShares;
                    activeThreads =
                            telemetry.activeThreads > 0 ? telemetry.activeThreads : activeThreads;
                    fallbackHashrate = hashrate;
                    fallbackDifficulty =
                            extractDifficulty(
                                    telemetry.resultsJson,
                                    telemetry.connectionJson,
                                    fallbackDifficulty);
                    fallbackNetworkLatencyMs =
                            extractNetworkLatency(
                                    telemetry.connectionJson,
                                    telemetry.resultsJson,
                                    fallbackNetworkLatencyMs);
                    fallbackAcceptedShares = acceptedShares;
                    fallbackRejectedShares = rejectedShares;
                    fallbackActiveThreads = activeThreads;
                    fallbackUptimeSeconds =
                            telemetry.uptimeSeconds > 0
                                    ? telemetry.uptimeSeconds
                                    : fallbackUptimeSeconds;
                }
            }
        }

        JSObject result = new JSObject();
        result.put("available", trusted);
        result.put("running", running);
        synchronized (this) {
            result.put("session", sessionRecord);
            try {
                result.put("sessions", journal.records());
            } catch (RuntimeException failure) {
                storageError = "Native session history could not be read.";
            }
            result.put("storageError", storageError);
        }
        if (running && activeConfig != null) result.put("activeConfig", activeConfig);
        result.put("paused", !running && paused);
        result.put("stopRequested", stopRequested);
        result.put("connected", running && poolConnected);
        result.put("hashrateUpdatedAt", lastStdoutHashrateAtMs > 0 ? lastStdoutHashrateAtMs : null);
        result.put("message", message);
        result.put("hardwareMode", running ? hardwareModeSnapshot : "cpu");

        JSObject stats = new JSObject();
        stats.put("hashrate", fallbackHashrate);
        stats.put("difficulty", fallbackDifficulty > 0 ? fallbackDifficulty : null);
        stats.put(
                "networkLatencyMs", fallbackNetworkLatencyMs > 0 ? fallbackNetworkLatencyMs : null);
        stats.put("minerCpuUsage", fallbackMinerCpuUsageAvailable ? fallbackMinerCpuUsage : null);
        stats.put("cpuUsage", fallbackMinerCpuUsageAvailable ? fallbackMinerCpuUsage : null);
        stats.put("acceptedShares", fallbackAcceptedShares);
        stats.put("rejectedShares", fallbackRejectedShares);
        stats.put("activeThreads", running ? fallbackActiveThreads : 0);
        stats.put("uptimeSeconds", fallbackUptimeSeconds);
        stats.put(
                "remainingSeconds",
                running ? sessionClock.remainingSeconds(SystemClock.elapsedRealtime()) : null);
        stats.put(
                "deadlineAt",
                running && sessionRecord != null ? sessionRecord.opt("deadlineAt") : null);
        result.put("stats", stats);
        result.put("exitCode", exitCode == Integer.MIN_VALUE ? null : exitCode);
        result.put("failureReason", failureReason);
        result.put("unexpectedExit", unexpectedExit);
        synchronized (this) {
            if (crashRestart != null) result.put("crashRestart", crashRestart);
        }

        JSObject api = new JSObject();
        api.put("available", running && telemetryAvailable);
        api.put("source", running && telemetryAvailable ? "xmrig-http-api" : "stdout-fallback");
        api.put("host", API_HOST);
        api.put("port", telemetryPort);
        api.put("lastUpdatedAt", telemetryUpdatedAt > 0 ? telemetryUpdatedAt : null);
        api.put("message", telemetryMessage);

        if (telemetry != null && telemetry.available) {
            api.put("summary", telemetry.summary);
            api.put("backends", telemetry.backends);
            api.put("hashrate", telemetry.hashrateJson);
            api.put("results", telemetry.resultsJson);
            api.put("connection", telemetry.connectionJson);
            api.put("threadHashrates", telemetry.threadHashrates);
        }

        result.put("apiTelemetry", api);

        JSArray logs = new JSArray();
        for (String logLine : logSnapshot) {
            logs.put(logLine);
        }
        result.put("logs", logs);

        return result;
    }

    private ApiTelemetry fetchApiTelemetry(int port, String token) {
        ApiTelemetry telemetry = new ApiTelemetry();
        try {
            JSONObject summary = getApiJson(port, token, "/2/summary");
            if (summary == null) {
                summary = getApiJson(port, token, "/1/summary");
            }

            if (summary == null) {
                telemetry.message = "XMRig HTTP API has not returned summary telemetry yet.";
                return telemetry;
            }

            JSONObject backends = null;
            try {
                backends = getApiJson(port, token, "/2/backends");
            } catch (IOException | JSONException ignored) {
                // Summary metrics remain valid without optional per-thread data.
            }
            telemetry.summary = toJSObject(summary);
            telemetry.backends = backends == null ? null : toJSObject(backends);
            telemetry.hashrateJson = toJSObject(summary.optJSONObject("hashrate"));
            telemetry.resultsJson = toJSObject(summary.optJSONObject("results"));
            telemetry.connectionJson = toJSObject(summary.optJSONObject("connection"));
            telemetry.threadHashrates = extractThreadHashrates(summary, backends);
            telemetry.hashrate = extractTotalHashrate(summary);
            telemetry.acceptedShares = extractAcceptedShares(summary);
            telemetry.rejectedShares = extractRejectedShares(summary);
            telemetry.activeThreads = extractActiveThreads(summary, backends);
            telemetry.uptimeSeconds = extractUptimeSeconds(summary);
            telemetry.available = true;
            telemetry.message = "XMRig HTTP API telemetry active.";
            return telemetry;
        } catch (IOException | JSONException exception) {
            telemetry.message = "XMRig HTTP API telemetry unavailable: " + exception.getMessage();
            return telemetry;
        }
    }

    private JSONObject getApiJson(int port, String token, String endpoint)
            throws IOException, JSONException {
        URL url = new URL("http://" + API_HOST + ":" + port + endpoint);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(API_CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(API_READ_TIMEOUT_MS);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + token);

        try {
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                return null;
            }

            try (BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    body.append(line);
                }

                String json = body.toString().trim();
                return json.startsWith("[")
                        ? new JSONObject().put("backends", new JSONArray(json))
                        : new JSONObject(json);
            }
        } finally {
            connection.disconnect();
        }
    }

    private double extractTotalHashrate(JSONObject summary) {
        JSONObject rates = summary.optJSONObject("hashrate");
        JSONArray total = rates == null ? null : rates.optJSONArray("total");
        // Do not replace a valid zero 10s speed with an older 60s or 15m average.
        return total == null || total.isNull(0) ? 0 : Math.max(0, total.optDouble(0, 0));
    }

    private int extractAcceptedShares(JSONObject summary) {
        JSONObject results = summary.optJSONObject("results");
        if (results == null) {
            return acceptedShares;
        }

        return results.optInt("shares_good", acceptedShares);
    }

    private int extractRejectedShares(JSONObject summary) {
        JSONObject results = summary.optJSONObject("results");
        if (results == null) {
            return rejectedShares;
        }

        int totalShares = results.optInt("shares_total", acceptedShares + rejectedShares);
        int goodShares = results.optInt("shares_good", acceptedShares);
        return Math.max(0, totalShares - goodShares);
    }

    private long extractUptimeSeconds(JSONObject summary) {
        // Pool connection uptime resets on reconnect; process uptime does not.
        return isRunning() ? Math.max(0, (SystemClock.elapsedRealtime() - startedAtMs) / 1000) : 0;
    }

    private int extractActiveThreads(JSONObject summary, JSONObject backends) {
        JSONObject hashrateJson = summary.optJSONObject("hashrate");
        if (hashrateJson != null) {
            JSONArray threads = hashrateJson.optJSONArray("threads");
            if (threads != null && threads.length() > 0) {
                return threads.length();
            }
        }

        int backendThreads = countBackendThreads(backends);
        return backendThreads > 0 ? backendThreads : activeThreads;
    }

    private JSArray extractThreadHashrates(JSONObject summary, JSONObject backends) {
        JSArray threadRates = new JSArray();
        JSONObject hashrateJson = summary.optJSONObject("hashrate");
        JSONArray summaryThreads =
                hashrateJson == null ? null : hashrateJson.optJSONArray("threads");

        if (summaryThreads != null) {
            for (int index = 0; index < summaryThreads.length(); index += 1) {
                Object item = summaryThreads.opt(index);
                if (item instanceof JSONArray) {
                    JSONArray windows = (JSONArray) item;
                    putNumber(threadRates, windows.optDouble(0, 0));
                } else if (item instanceof Number) {
                    putNumber(threadRates, ((Number) item).doubleValue());
                }
            }
        }

        if (threadRates.length() > 0) {
            return threadRates;
        }

        collectBackendThreadHashrates(backends, threadRates);
        return threadRates;
    }

    private int countBackendThreads(JSONObject backends) {
        JSArray rates = new JSArray();
        collectBackendThreadHashrates(backends, rates);
        return rates.length();
    }

    private void collectBackendThreadHashrates(Object value, JSArray rates) {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            JSONArray threads = object.optJSONArray("threads");
            if (threads != null) {
                for (int index = 0; index < threads.length(); index += 1) {
                    Object thread = threads.opt(index);
                    if (thread instanceof JSONObject) {
                        JSONObject threadObject = (JSONObject) thread;
                        JSONArray hashrateArray = threadObject.optJSONArray("hashrate");
                        if (hashrateArray != null) {
                            putNumber(rates, hashrateArray.optDouble(0, 0));
                        } else {
                            putNumber(rates, threadObject.optDouble("hashrate", 0));
                        }
                    } else if (thread instanceof JSONArray) {
                        putNumber(rates, ((JSONArray) thread).optDouble(0, 0));
                    }
                }
            }

            JSONArray keys = object.names();
            if (keys == null) {
                return;
            }

            for (int index = 0; index < keys.length(); index += 1) {
                collectBackendThreadHashrates(object.opt(keys.optString(index)), rates);
            }
            return;
        }

        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            for (int index = 0; index < array.length(); index += 1) {
                collectBackendThreadHashrates(array.opt(index), rates);
            }
        }
    }

    private int findAvailableApiPort() {
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getByName(API_HOST))) {
            socket.setReuseAddress(true);
            return socket.getLocalPort();
        } catch (IOException exception) {
            return API_FALLBACK_PORT;
        }
    }

    private JSObject toJSObject(JSONObject object) throws JSONException {
        if (object == null) {
            return null;
        }

        return new JSObject(object.toString());
    }

    private void putNumber(JSArray array, double value) {
        try {
            array.put(value);
        } catch (JSONException ignored) {

        }
    }

    private void readMinerOutput(Process process) {
        try (BufferedReader reader =
                new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                synchronized (this) {
                    if (minerProcess == process) parseMinerLine(line);
                }
            }
        } catch (IOException exception) {
            synchronized (this) {
                lastMessage = exception.getMessage();
                appendLog("Miner output read failed: " + exception.getMessage());
            }
        } finally {
            synchronized (this) {
                if (minerProcess == process) {
                    int exitCode = Integer.MIN_VALUE;
                    try {
                        exitCode = process.waitFor();
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                    }

                    stoppedUptimeSeconds =
                            Math.max(0, (SystemClock.elapsedRealtime() - startedAtMs) / 1000);
                    minerProcess = null;
                    MiningGuardService.end(getContext());
                    hashrate = 0;
                    activeThreads = 0;
                    activeHardwareMode = "cpu";
                    minerPid = -1;
                    resetCpuUsageSampling();
                    lastExitCode = exitCode;

                    if (stopRequested) {
                        lastMessage = "Native miner stopped.";
                    } else {
                        String codeLabel =
                                exitCode == Integer.MIN_VALUE
                                        ? "unknown"
                                        : String.valueOf(exitCode);
                        String reason =
                                lastFailureReason.isBlank() ? lastMessage : lastFailureReason;
                        lastMessage =
                                "Native miner exited unexpectedly with code "
                                        + codeLabel
                                        + (reason == null || reason.isBlank()
                                                ? "."
                                                : ". Last output: " + reason);
                        appendLog(lastMessage);
                        finishRecord(
                                "native_crash",
                                "Native miner exited unexpectedly (code " + codeLabel + ").",
                                true);
                        scheduleCrashRestart(exitCode);
                    }
                }
            }
        }
    }

    private synchronized void parseMinerLine(String line) {
        line = MinerOutput.clean(line);
        lastMessage = line;
        appendLog(line);
        Double currentSpeed = MinerOutput.currentSpeed(line);
        if (currentSpeed != null) {
            hashrate = currentSpeed;
            stdoutHashrate = currentSpeed;
            lastStdoutHashrateAtMs = System.currentTimeMillis();
            lastStdoutHashrateElapsed = SystemClock.elapsedRealtime();
            sampleTotal += currentSpeed;
            sampleCount++;
        } else if (line.contains("speed 10s/60s/15m")) {
            stdoutHashrate = 0;
            lastStdoutHashrateAtMs = 0;
        }

        String normalized = line.toLowerCase(Locale.US);
        Matcher readyThreads =
                Pattern.compile("\\bREADY\\s+threads\\s+(\\d+)", Pattern.CASE_INSENSITIVE)
                        .matcher(line);
        if (readyThreads.find()) activeThreads = Integer.parseInt(readyThreads.group(1));
        if (normalized.contains("new job from")) poolConnected = true;
        if (normalized.contains("no active pools")
                || normalized.contains("connect error")
                || normalized.contains("connection refused")
                || normalized.contains("end of file")
                || normalized.contains("read error")) poolConnected = false;
        if (normalized.contains("accepted")) {
            acceptedShares += 1;
        }
        if (normalized.contains("rejected")) {
            rejectedShares += 1;
        }
        if (isRunning())
            transition(
                    poolConnected && stdoutHashrate > 0 ? "running" : "connecting", "miner_output");
        if (looksLikeFailure(normalized)) {
            lastFailureReason = line;
        }

        Matcher difficultyMatcher = DIFFICULTY_PATTERN.matcher(line);
        if (difficultyMatcher.find()) {
            difficulty = parseScaledLong(difficultyMatcher.group(1), difficultyMatcher.group(2));
        }

        Matcher latencyMatcher = LATENCY_PATTERN.matcher(line);
        if (latencyMatcher.find()) {
            networkLatencyMs = Integer.parseInt(latencyMatcher.group(1));
        }
    }

    private long extractDifficulty(JSObject results, JSObject connection, long fallback) {
        long resultDifficulty = getPositiveLong(results, "diff_current");
        if (resultDifficulty > 0) {
            return resultDifficulty;
        }

        long connectionDifficulty = getPositiveLong(connection, "diff");
        return connectionDifficulty > 0 ? connectionDifficulty : fallback;
    }

    private int extractNetworkLatency(JSObject connection, JSObject results, int fallback) {
        int ping = getPositiveInt(connection, "ping");
        if (ping > 0) {
            return ping;
        }

        int averageShareTime = getPositiveInt(results, "avg_time_ms");
        return averageShareTime > 0 ? averageShareTime : fallback;
    }

    private long getPositiveLong(JSObject object, String key) {
        if (object == null) {
            return 0;
        }

        Object value = object.opt(key);
        if (value instanceof Number) {
            long number = ((Number) value).longValue();
            return number > 0 ? number : 0;
        }

        return 0;
    }

    private int getPositiveInt(JSObject object, String key) {
        long value = getPositiveLong(object, key);
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) value;
    }

    private long parseScaledLong(String rawValue, String rawScale) {
        double value = Double.parseDouble(rawValue);
        String scale = rawScale == null ? "" : rawScale.toLowerCase(Locale.US);

        switch (scale) {
            case "g":
                value *= 1_000_000_000D;
                break;
            case "m":
                value *= 1_000_000D;
                break;
            case "k":
                value *= 1_000D;
                break;
            default:
                break;
        }

        return Math.max(0, Math.round(value));
    }

    private boolean looksLikeFailure(String normalizedLine) {
        return normalizedLine.contains("error")
                || normalizedLine.contains("failed")
                || normalizedLine.contains("failure")
                || normalizedLine.contains("invalid")
                || normalizedLine.contains("unauthorized")
                || normalizedLine.contains("bad mask")
                || normalizedLine.contains("taskset")
                || normalizedLine.contains("connection refused")
                || normalizedLine.contains("connect error")
                || normalizedLine.contains("dns error")
                || normalizedLine.contains("tls error")
                || normalizedLine.contains("ssl error")
                || normalizedLine.contains("socket")
                || normalizedLine.contains("closed");
    }

    private synchronized void clearLogs() {
        recentLogs.clear();
    }

    private synchronized void appendLog(String line) {
        if (line == null || line.isBlank()) {
            return;
        }

        recentLogs.add(logTimeFormat.format(new Date()) + "  " + line.trim());
        while (recentLogs.size() > MAX_LOG_LINES) {
            recentLogs.remove(0);
        }
    }

    private synchronized boolean isRunning() {
        return minerProcess != null && isProcessAlive(minerProcess);
    }

    private synchronized void stopMinerProcess() {
        if (minerProcess == null) {
            MiningGuardService.end(getContext());
            return;
        }

        stoppedUptimeSeconds = Math.max(0, (SystemClock.elapsedRealtime() - startedAtMs) / 1000);
        stopRequested = true;
        /* A paused process cannot act on SIGTERM; always resume it first. */
        if (throttle != null) throttle.release();
        minerProcess.destroy();
        try {
            if (!waitForProcess(minerProcess, 3)) {
                appendLog("Native miner did not stop in time; forcing shutdown.");
                forceStopProcess(minerProcess);
                if (!waitForProcess(minerProcess, 2)) {
                    throw new IllegalStateException(
                            "Miner is still running after shutdown. Retry Stop.");
                }
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            forceStopProcess(minerProcess);
        } finally {
            if (minerProcess != null && !isProcessAlive(minerProcess)) {
                lastExitCode = getExitCode(minerProcess);
                minerProcess = null;
            }
            if (minerProcess == null) {
                if (throttle != null) throttle.shutdown();
                throttle = null;
                MiningGuardService.end(getContext());
                minerPid = -1;
                resetCpuUsageSampling();
            }
        }
        if (isRunning()) throw new IllegalStateException("Miner is still running. Retry Stop.");
    }

    private boolean isProcessAlive(Process process) {
        if (process == null) return false;
        try {
            process.exitValue();
            return false;
        } catch (IllegalThreadStateException alive) {
            return true;
        }
    }

    private boolean waitForProcess(Process process, int timeoutSeconds)
            throws InterruptedException {
        long deadline = System.nanoTime() + timeoutSeconds * 1000000000L;
        while (isProcessAlive(process) && System.nanoTime() < deadline) Thread.sleep(25);
        return !isProcessAlive(process);
    }

    private void forceStopProcess(Process process) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            process.destroyForcibly();
        } else {
            // Android 6/7 lack Process.destroyForcibly. Kill only this owned child PID.
            int pid =
                    process == minerProcess && minerPid > 0 ? minerPid : resolveProcessPid(process);
            if (pid > 0 && isProcessAlive(process)) android.os.Process.killProcess(pid);
            else process.destroy();
        }
    }

    private int getExitCode(Process process) {
        try {
            return process.exitValue();
        } catch (IllegalThreadStateException exception) {
            return Integer.MIN_VALUE;
        }
    }

    private File findMinerBinary() {
        Context context = getContext();
        ApplicationInfo info = context.getApplicationInfo();

        for (String candidate : BINARY_CANDIDATES) {
            File file = new File(info.nativeLibraryDir, candidate);
            if (file.exists()) {
                return file;
            }
        }

        for (String candidate : BINARY_CANDIDATES) {
            File file = new File(context.getFilesDir(), candidate);
            if (file.exists()) {
                return file;
            }
        }

        return null;
    }

    private String resolveMinerSource(File binary) {
        if (binary == null) {
            return "missing";
        }

        String path = binary.getAbsolutePath();
        String nativeLibraryDir = getContext().getApplicationInfo().nativeLibraryDir;
        if (nativeLibraryDir != null
                && path.startsWith(new File(nativeLibraryDir).getAbsolutePath())) {
            return "bundled";
        }

        if (path.startsWith(getContext().getFilesDir().getAbsolutePath())) {
            return "downloaded";
        }

        return "custom";
    }

    private String formatMinerSource(String source) {
        switch (source) {
            case "bundled":
                return "Bundled in this APK";
            case "downloaded":
                return "Downloaded from GitHub miner-builder";
            case "custom":
                return "Installed in app storage";
            default:
                return "Not installed";
        }
    }

    private String resolveInstalledMinerVariant(
            String source, String apkVariant, String versionOutput) {
        if ("bundled".equals(source)) {
            return "notls".equals(apkVariant) ? "notls" : "tls";
        }

        if ("downloaded".equals(source)) {
            String savedVariant = readInstalledMinerVariant();
            return "unknown".equals(savedVariant)
                    ? inferMinerVariantFromVersionOutput(versionOutput)
                    : savedVariant;
        }

        if ("custom".equals(source)) {
            return inferMinerVariantFromVersionOutput(versionOutput);
        }

        return "unknown";
    }

    private String inferMinerVariantFromVersionOutput(String versionOutput) {
        if (versionOutput == null || versionOutput.isBlank()) {
            return "unknown";
        }

        return versionOutput.toLowerCase(Locale.US).contains("openssl") ? "tls" : "notls";
    }

    private String readCpuInfo() {
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line).append('\n');
        } catch (IOException unreadable) {
            return "";
        }
        return text.toString();
    }

    private String readMinerVersionOutput(File binary) {
        return readMinerCommandOutput(binary, "--version", 2);
    }

    private String readMinerCommandOutput(File binary, String argument, int timeoutSeconds) {
        if (binary == null || !binary.exists()) {
            return "";
        }

        try {
            verifyInstalledBinary(binary);
            binary.setExecutable(true);
            ProcessBuilder builder = new ProcessBuilder(binary.getAbsolutePath(), argument);
            builder.redirectErrorStream(true);
            Process process = builder.start();
            boolean finished = waitForProcess(process, timeoutSeconds);
            if (!finished) {
                forceStopProcess(process);
                return "";
            }

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (output.length() > 0) {
                        output.append('\n');
                    }
                    output.append(line);
                }
            }

            return output.toString().trim();
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return "";
        }
    }

    private String parseMinerVersion(String versionOutput) {
        if (versionOutput == null || versionOutput.isBlank()) {
            return "";
        }

        Matcher matcher = XMRIG_VERSION_PATTERN.matcher(versionOutput);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String normalizeHardwareMode(String mode) {
        return "cpu";
    }

    private String formatHardwareMode(String mode) {
        return "Native XMRig";
    }

    private String normalizeApkVariant(String variant) {
        if (variant == null) {
            return "download";
        }

        String normalized = variant.trim().toLowerCase(Locale.US);
        if (normalized.equals("notls") || normalized.equals("no-tls")) {
            return "notls";
        }

        if (normalized.equals("tls")) {
            return "tls";
        }

        return "download";
    }

    private String formatApkVariant(String variant) {
        switch (normalizeApkVariant(variant)) {
            case "tls":
                return "TLS";
            case "notls":
                return "No-TLS";
            default:
                return "Download";
        }
    }

    private String formatInstalledMinerVariant(String variant) {
        if ("tls".equals(variant)) {
            return "TLS";
        }

        if ("notls".equals(variant)) {
            return "No-TLS";
        }

        return "Unknown";
    }

    private SharedPreferences getMinerPreferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String readInstalledMinerVariant() {
        String variant = getMinerPreferences().getString(PREF_MINER_VARIANT, "unknown");
        String normalized = variant == null ? "unknown" : variant.trim().toLowerCase(Locale.US);
        if (normalized.equals("notls") || normalized.equals("no-tls")) {
            return "notls";
        }

        if (normalized.equals("tls")) {
            return "tls";
        }

        return "unknown";
    }

    private void saveInstalledMinerVariant(String variant) {
        getMinerPreferences()
                .edit()
                .putString(PREF_MINER_VARIANT, normalizeMinerVariant(variant))
                .apply();
    }

    private String normalizeMinerVariant(String variant) {
        if (variant == null) {
            return "tls";
        }

        String normalized = variant.trim().toLowerCase(Locale.US);
        return normalized.equals("notls") || normalized.equals("no-tls") ? "notls" : "tls";
    }

    private String formatMinerVariant(String variant) {
        return "notls".equals(variant) ? "No-TLS" : "TLS";
    }

    private String getMinerDownloadUrl(String variant) {
        return String.format(MINER_DOWNLOAD_URL_FORMAT, DEVICE_ABI, variant);
    }

    private void verifyInstalledBinary(File binary) throws IOException {
        if ("downloaded".equals(resolveMinerSource(binary))) {
            String variant = readInstalledMinerVariant();
            if (!"tls".equals(variant) && !"notls".equals(variant))
                throw new IOException(
                        "Installed miner has no verified variant. Download the approved miner again.");
            MinerIntegrity.verify(binary, MinerIntegrity.expectedHash(DEVICE_ABI, variant));
        }
        verifiedPath = binary.getAbsolutePath();
        verifiedLength = binary.length();
        verifiedModified = binary.lastModified();
    }

    private File downloadMinerBinary(String variant) throws IOException {
        File minersDir = new File(getContext().getFilesDir(), "miners");
        if (!minersDir.exists() && !minersDir.mkdirs()) {
            throw new IOException("Could not create miner storage directory.");
        }

        File target = new File(minersDir, "libxmrig.so");
        File temp = new File(minersDir, "libxmrig.so.download");
        HttpURLConnection connection =
                (HttpURLConnection) new URL(getMinerDownloadUrl(variant)).openConnection();
        connection.setRequestMethod("GET");
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(DOWNLOAD_CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(DOWNLOAD_READ_TIMEOUT_MS);
        connection.setRequestProperty("Accept", "application/octet-stream");

        try {
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException("GitHub returned HTTP " + responseCode + ".");
            }

            long totalBytes = -1;
            try {
                totalBytes = Long.parseLong(connection.getHeaderField("Content-Length"));
            } catch (NumberFormatException ignored) {
            }
            long downloadedBytes = 0;
            long lastProgressAtMs = 0;
            notifyDownloadProgress(variant, 0, downloadedBytes, totalBytes);

            try (InputStream input = connection.getInputStream();
                    FileOutputStream output = new FileOutputStream(temp, false)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    downloadedBytes += read;
                    if (downloadedBytes > MinerIntegrity.MAX_BYTES)
                        throw new IOException("Miner download exceeds the size limit.");

                    long now = System.currentTimeMillis();
                    if (now - lastProgressAtMs >= DOWNLOAD_PROGRESS_INTERVAL_MS) {
                        notifyDownloadProgress(
                                variant,
                                calculateDownloadPercent(downloadedBytes, totalBytes),
                                downloadedBytes,
                                totalBytes);
                        lastProgressAtMs = now;
                    }
                }
                output.getFD().sync();
            }

            if (temp.length() <= 0) {
                throw new IOException("Downloaded miner binary was empty.");
            }

            if (totalBytes > 0 && downloadedBytes != totalBytes)
                throw new IOException("Miner download was interrupted.");
            MinerIntegrity.verify(temp, MinerIntegrity.expectedHash(DEVICE_ABI, variant));
            // POSIX rename replaces the old file atomically, without a delete-before-install gap.
            try {
                android.system.Os.rename(temp.getAbsolutePath(), target.getAbsolutePath());
            } catch (android.system.ErrnoException failure) {
                throw new IOException("Could not install verified miner.", failure);
            }
            target.setReadable(true, true);
            target.setExecutable(true, true);
            notifyDownloadProgress(
                    variant, 100, target.length(), totalBytes > 0 ? totalBytes : target.length());
            return target;
        } finally {
            connection.disconnect();
            if (temp.exists()) {
                temp.delete();
            }
        }
    }

    private int calculateDownloadPercent(long downloadedBytes, long totalBytes) {
        if (totalBytes <= 0) {
            return 0;
        }

        return Math.min(99, Math.max(0, (int) ((downloadedBytes * 100) / totalBytes)));
    }

    private void notifyDownloadProgress(
            String variant, int percent, long downloadedBytes, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("variant", variant);
        progress.put("percent", percent);
        progress.put("downloadedBytes", downloadedBytes);
        progress.put("totalBytes", totalBytes > 0 ? totalBytes : null);
        java.util.function.Consumer<JSObject> listener = progressListener;
        if (listener != null) listener.accept(progress);
    }
}
