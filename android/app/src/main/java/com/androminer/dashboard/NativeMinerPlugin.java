package com.androminer.dashboard;

import android.content.Context;
import android.content.pm.ApplicationInfo;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeMiner")
public class NativeMinerPlugin extends Plugin {
  private static final Pattern SPEED_TABLE_PATTERN =
      Pattern.compile("\\bspeed\\s+\\S+\\s+([0-9]+(?:\\.[0-9]+)?)", Pattern.CASE_INSENSITIVE);
  private static final Pattern HASHRATE_PATTERN =
      Pattern.compile("speed.*?([0-9]+(?:\\.[0-9]+)?)\\s*H/s", Pattern.CASE_INSENSITIVE);
  private static final String[] BINARY_CANDIDATES = {
    "miners/xmrig",
    "miners/xmrig-aarch64",
    "libxmrig.so"
  };
  private static final int MAX_LOG_LINES = 80;

  private final ExecutorService outputExecutor = Executors.newSingleThreadExecutor();
  private final List<String> recentLogs = new ArrayList<>();
  private final SimpleDateFormat logTimeFormat = new SimpleDateFormat("HH:mm:ss", Locale.US);
  private Process minerProcess;
  private long startedAtMs;
  private double hashrate;
  private int acceptedShares;
  private int rejectedShares;
  private int activeThreads;
  private String lastMessage = "Native miner has not started.";
  private String lastFailureReason = "";
  private int lastExitCode = Integer.MIN_VALUE;
  private boolean stopRequested;

  @PluginMethod
  public void status(PluginCall call) {
    call.resolve(createStatus());
  }

  @PluginMethod
  public synchronized void start(PluginCall call) {
    if (isRunning()) {
      call.resolve(createStatus());
      return;
    }

    File binary = findMinerBinary();
    if (binary == null) {
      appendLog("No packaged Android miner binary found.");
      call.reject(
          "No packaged XMRig-compatible Android binary found. Build it for Android with the NDK and package it as libxmrig.so.");
      return;
    }

    JSObject config = call.getObject("config", new JSObject());
    String poolEndpoint =
        buildPoolEndpoint(
            config.getString("protocol", "stratum+tcp"),
            config.getString("poolUrl", ""),
            config.getInteger("poolPort", 3333));
    List<String> command = buildCommand(binary, config);

    try {
      binary.setExecutable(true);
      ProcessBuilder builder = new ProcessBuilder(command);
      builder.redirectErrorStream(true);
      builder.directory(binary.getParentFile());
      minerProcess = builder.start();
      startedAtMs = System.currentTimeMillis();
      hashrate = 0;
      acceptedShares = 0;
      rejectedShares = 0;
      activeThreads = config.getInteger("threadCount", Runtime.getRuntime().availableProcessors());
      lastMessage = "Native miner process started.";
      lastFailureReason = "";
      lastExitCode = Integer.MIN_VALUE;
      stopRequested = false;
      clearLogs();
      appendLog(lastMessage);
      appendLog("Pool endpoint: " + poolEndpoint);
      appendLog(
          "Threads: "
              + activeThreads
              + ", priority: "
              + config.getString("priority", "low"));
      outputExecutor.execute(this::readMinerOutput);
      call.resolve(createStatus());
    } catch (IOException exception) {
      minerProcess = null;
      lastMessage = exception.getMessage();
      appendLog("Failed to start native miner: " + exception.getMessage());
      call.reject("Failed to start native miner: " + exception.getMessage());
    }
  }

  @PluginMethod
  public synchronized void pause(PluginCall call) {
    stopMinerProcess();
    lastMessage = "Native miner paused.";
    appendLog(lastMessage);
    call.resolve(createStatus());
  }

  @PluginMethod
  public synchronized void stop(PluginCall call) {
    stopMinerProcess();
    hashrate = 0;
    activeThreads = 0;
    lastMessage = "Native miner stopped.";
    appendLog(lastMessage);
    call.resolve(createStatus());
  }

  private List<String> buildCommand(File binary, JSObject config) {
    String protocol = config.getString("protocol", "stratum+tcp");
    String poolUrl = config.getString("poolUrl", "");
    int poolPort = config.getInteger("poolPort", 3333);
    String walletAddress = config.getString("walletAddress", "");
    String workerName = config.getString("workerName", "android-phone");
    String password = config.getString("password", "x");
    int threadCount = Math.max(1, config.getInteger("threadCount", 1));
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
    command.add("--no-color");
    command.add("--print-time=2");

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

  private synchronized JSObject createStatus() {
    File binary = findMinerBinary();
    JSObject result = new JSObject();
    result.put("available", binary != null);
    result.put("running", isRunning());
    result.put(
        "message",
        binary == null
            ? "No packaged Android miner binary found. Official XMRig does not publish Android binaries; build one for Android and package it with the APK."
            : lastMessage);

    JSObject stats = new JSObject();
    stats.put("hashrate", hashrate);
    stats.put("acceptedShares", acceptedShares);
    stats.put("rejectedShares", rejectedShares);
    stats.put("activeThreads", isRunning() ? activeThreads : 0);
    stats.put("uptimeSeconds", isRunning() ? (System.currentTimeMillis() - startedAtMs) / 1000 : 0);
    result.put("stats", stats);
    result.put("exitCode", lastExitCode == Integer.MIN_VALUE ? null : lastExitCode);
    result.put("failureReason", lastFailureReason);
    result.put("unexpectedExit", lastExitCode != Integer.MIN_VALUE && !stopRequested);

    JSArray logs = new JSArray();
    for (String logLine : recentLogs) {
      logs.put(logLine);
    }
    result.put("logs", logs);

    return result;
  }

  private void readMinerOutput() {
    Process process;
    synchronized (this) {
      process = minerProcess;
    }

    if (process == null) {
      return;
    }

    try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
      String line;
      while ((line = reader.readLine()) != null) {
        parseMinerLine(line);
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

          minerProcess = null;
          hashrate = 0;
          activeThreads = 0;
          lastExitCode = exitCode;

          if (stopRequested) {
            lastMessage = "Native miner stopped.";
          } else {
            String codeLabel = exitCode == Integer.MIN_VALUE ? "unknown" : String.valueOf(exitCode);
            String reason =
                lastFailureReason.isBlank()
                    ? lastMessage
                    : lastFailureReason;
            lastMessage =
                "Native miner exited unexpectedly with code "
                    + codeLabel
                    + (reason == null || reason.isBlank() ? "." : ". Last output: " + reason);
            appendLog(lastMessage);
          }
        }
      }
    }
  }

  private synchronized void parseMinerLine(String line) {
    lastMessage = line;
    appendLog(line);
    Matcher speedTableMatcher = SPEED_TABLE_PATTERN.matcher(line);
    if (speedTableMatcher.find()) {
      hashrate = Double.parseDouble(speedTableMatcher.group(1));
    } else {
      Matcher hashMatcher = HASHRATE_PATTERN.matcher(line);
      if (hashMatcher.find()) {
        hashrate = Double.parseDouble(hashMatcher.group(1));
      }
    }

    String normalized = line.toLowerCase(Locale.US);
    if (normalized.contains("accepted")) {
      acceptedShares += 1;
    }
    if (normalized.contains("rejected")) {
      rejectedShares += 1;
    }
    if (looksLikeFailure(normalized)) {
      lastFailureReason = line;
    }
  }

  private boolean looksLikeFailure(String normalizedLine) {
    return normalizedLine.contains("error")
        || normalizedLine.contains("failed")
        || normalizedLine.contains("failure")
        || normalizedLine.contains("invalid")
        || normalizedLine.contains("unauthorized")
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
    return minerProcess != null && minerProcess.isAlive();
  }

  private synchronized void stopMinerProcess() {
    if (minerProcess == null) {
      return;
    }

    stopRequested = true;
    minerProcess.destroy();
    try {
      if (!minerProcess.waitFor(3, TimeUnit.SECONDS)) {
        appendLog("Native miner did not stop in time; forcing shutdown.");
        minerProcess.destroyForcibly();
        minerProcess.waitFor(2, TimeUnit.SECONDS);
      }
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      minerProcess.destroyForcibly();
    } finally {
      lastExitCode = getExitCode(minerProcess);
      minerProcess = null;
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
    for (String candidate : BINARY_CANDIDATES) {
      File file = new File(context.getFilesDir(), candidate);
      if (file.exists()) {
        return file;
      }
    }

    ApplicationInfo info = context.getApplicationInfo();
    for (String candidate : BINARY_CANDIDATES) {
      File file = new File(info.nativeLibraryDir, candidate);
      if (file.exists()) {
        return file;
      }
    }

    return null;
  }
}
