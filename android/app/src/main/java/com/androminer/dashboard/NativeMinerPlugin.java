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
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeMiner")
public class NativeMinerPlugin extends Plugin {
  private static final Pattern SPEED_TABLE_PATTERN =
      Pattern.compile("\\bspeed\\s+\\S+\\s+([0-9]+(?:\\.[0-9]+)?)", Pattern.CASE_INSENSITIVE);
  private static final Pattern HASHRATE_PATTERN =
      Pattern.compile("speed.*?([0-9]+(?:\\.[0-9]+)?)\\s*H/s", Pattern.CASE_INSENSITIVE);
  private static final String[] BINARY_CANDIDATES = {
    "miners/libxmrig.so",
    "miners/xmrig",
    "miners/xmrig-aarch64",
    "libxmrig.so"
  };
  private static final String TLS_MINER_DOWNLOAD_URL =
      "https://raw.githubusercontent.com/Stawa/AndroMiner/miner-builder/lib/arm64-v8a/tls/libxmrig.so";
  private static final String NOTLS_MINER_DOWNLOAD_URL =
      "https://raw.githubusercontent.com/Stawa/AndroMiner/miner-builder/lib/arm64-v8a/notls/libxmrig.so";
  private static final String API_HOST = "127.0.0.1";
  private static final int DOWNLOAD_CONNECT_TIMEOUT_MS = 15000;
  private static final int DOWNLOAD_READ_TIMEOUT_MS = 45000;
  private static final long DOWNLOAD_PROGRESS_INTERVAL_MS = 250;
  private static final int API_CONNECT_TIMEOUT_MS = 350;
  private static final int API_READ_TIMEOUT_MS = 650;
  private static final int API_FALLBACK_PORT = 39089;
  private static final int MAX_LOG_LINES = 80;

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
  private int apiPort;
  private String apiToken = "";
  private boolean apiTelemetryAvailable;
  private long lastApiTelemetryAtMs;
  private String apiTelemetryMessage = "XMRig API telemetry has not started.";

  @PluginMethod
  public void status(PluginCall call) {
    call.resolve(createStatus());
  }

  @PluginMethod
  public void download(PluginCall call) {
    String variant = normalizeMinerVariant(call.getString("variant", "tls"));

    if (isRunning()) {
      call.reject("Stop the active miner before downloading a replacement binary.");
      return;
    }

    File existing = findMinerBinary();
    if (existing != null) {
      existing.setExecutable(true);
      synchronized (this) {
        lastMessage = "Miner binary is already installed.";
        appendLog(lastMessage);
      }
      call.resolve(createStatus());
      return;
    }

    outputExecutor.execute(
        () -> {
          synchronized (NativeMinerPlugin.this) {
            lastMessage = "Downloading " + formatMinerVariant(variant) + " Android miner binary.";
            lastFailureReason = "";
            appendLog(lastMessage);
          }

          try {
            File binary = downloadMinerBinary(variant);
            synchronized (NativeMinerPlugin.this) {
              lastMessage = formatMinerVariant(variant) + " miner binary downloaded and ready.";
              appendLog(lastMessage + " " + binary.getAbsolutePath());
            }
            call.resolve(createStatus());
          } catch (IOException exception) {
            synchronized (NativeMinerPlugin.this) {
              lastMessage = "Miner download failed: " + exception.getMessage();
              lastFailureReason = lastMessage;
              appendLog(lastMessage);
            }
            call.reject(lastMessage);
          }
        });
  }

  @PluginMethod
  public synchronized void start(PluginCall call) {
    if (isRunning()) {
      call.resolve(createStatus());
      return;
    }

    File binary = findMinerBinary();
    if (binary == null) {
      appendLog("Android miner binary is not installed.");
      call.reject(
          "Miner binary is not installed. Download the Android XMRig binary before starting.");
      return;
    }

    JSObject config = call.getObject("config", new JSObject());
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
      appendLog("XMRig API: http://" + API_HOST + ":" + apiPort + "/2/summary");
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
    apiTelemetryAvailable = false;
    lastApiTelemetryAtMs = 0;
    apiTelemetryMessage = "XMRig API telemetry stopped.";
    lastMessage = "Native miner stopped.";
    appendLog(lastMessage);
    call.resolve(createStatus());
  }

  private List<String> buildCommand(File binary, JSObject config, int apiPort, String apiToken) {
    String protocol = config.getString("protocol", "stratum+tcp");
    String poolUrl = config.getString("poolUrl", "");
    int poolPort = config.getInteger("poolPort", 3333);
    String walletAddress = config.getString("walletAddress", "");
    String workerName = config.getString("workerName", "android-phone");
    String password = config.getString("password", "x");
    int threadCount = Math.max(1, config.getInteger("threadCount", 1));
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

  private JSObject createStatus() {
    File binary = findMinerBinary();
    boolean running;
    String message;
    String failureReason;
    int exitCode;
    boolean unexpectedExit;
    double fallbackHashrate;
    int fallbackAcceptedShares;
    int fallbackRejectedShares;
    int fallbackActiveThreads;
    long fallbackUptimeSeconds;
    int telemetryPort;
    String telemetryToken;
    boolean telemetryAvailable;
    long telemetryUpdatedAt;
    String telemetryMessage;
    List<String> logSnapshot;

    synchronized (this) {
      running = isRunning();
      message =
          binary == null
              ? "Android miner download is required before the first mining session."
              : lastMessage;
      failureReason = lastFailureReason;
      exitCode = lastExitCode;
      unexpectedExit = lastExitCode != Integer.MIN_VALUE && !stopRequested;
      fallbackHashrate = hashrate;
      fallbackAcceptedShares = acceptedShares;
      fallbackRejectedShares = rejectedShares;
      fallbackActiveThreads = running ? activeThreads : 0;
      fallbackUptimeSeconds = running ? (System.currentTimeMillis() - startedAtMs) / 1000 : 0;
      telemetryPort = apiPort;
      telemetryToken = apiToken;
      telemetryAvailable = apiTelemetryAvailable;
      telemetryUpdatedAt = lastApiTelemetryAtMs;
      telemetryMessage = apiTelemetryMessage;
      logSnapshot = new ArrayList<>(recentLogs);
    }

    ApiTelemetry telemetry = null;
    if (running && telemetryPort > 0 && !telemetryToken.isBlank()) {
      telemetry = fetchApiTelemetry(telemetryPort, telemetryToken);

      synchronized (this) {
        apiTelemetryAvailable = telemetry.available;
        lastApiTelemetryAtMs = telemetry.available ? System.currentTimeMillis() : lastApiTelemetryAtMs;
        apiTelemetryMessage = telemetry.message;
        telemetryAvailable = apiTelemetryAvailable;
        telemetryUpdatedAt = lastApiTelemetryAtMs;
        telemetryMessage = apiTelemetryMessage;

        if (telemetry.available) {
          hashrate = telemetry.hashrate;
          acceptedShares = telemetry.acceptedShares;
          rejectedShares = telemetry.rejectedShares;
          activeThreads = telemetry.activeThreads > 0 ? telemetry.activeThreads : activeThreads;
          fallbackHashrate = hashrate;
          fallbackAcceptedShares = acceptedShares;
          fallbackRejectedShares = rejectedShares;
          fallbackActiveThreads = activeThreads;
          fallbackUptimeSeconds =
              telemetry.uptimeSeconds > 0 ? telemetry.uptimeSeconds : fallbackUptimeSeconds;
        }
      }
    }

    JSObject result = new JSObject();
    result.put("available", binary != null);
    result.put("running", running);
    result.put("message", message);

    JSObject stats = new JSObject();
    stats.put("hashrate", fallbackHashrate);
    stats.put("acceptedShares", fallbackAcceptedShares);
    stats.put("rejectedShares", fallbackRejectedShares);
    stats.put("activeThreads", running ? fallbackActiveThreads : 0);
    stats.put("uptimeSeconds", running ? fallbackUptimeSeconds : 0);
    result.put("stats", stats);
    result.put("exitCode", exitCode == Integer.MIN_VALUE ? null : exitCode);
    result.put("failureReason", failureReason);
    result.put("unexpectedExit", unexpectedExit);

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

      JSONObject backends = getApiJson(port, token, "/2/backends");
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

  private JSONObject getApiJson(int port, String token, String endpoint) throws IOException, JSONException {
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
              new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
        StringBuilder body = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
          body.append(line);
        }

        return new JSONObject(body.toString());
      }
    } finally {
      connection.disconnect();
    }
  }

  private double extractTotalHashrate(JSONObject summary) {
    JSONObject hashrateJson = summary.optJSONObject("hashrate");
    if (hashrateJson == null) {
      return hashrate;
    }

    JSONArray total = hashrateJson.optJSONArray("total");
    if (total == null) {
      return hashrateJson.optDouble("total", hashrate);
    }

    for (int index = 0; index < total.length(); index += 1) {
      double value = total.optDouble(index, 0);
      if (value > 0) {
        return value;
      }
    }

    return total.optDouble(0, hashrate);
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
    JSONObject connection = summary.optJSONObject("connection");
    if (connection != null) {
      long uptime = connection.optLong("uptime", 0);
      if (uptime > 0) {
        return uptime;
      }
    }

    return isRunning() ? (System.currentTimeMillis() - startedAtMs) / 1000 : 0;
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
    JSONArray summaryThreads = hashrateJson == null ? null : hashrateJson.optJSONArray("threads");

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
      // JSArray can throw for non-finite numbers; telemetry should keep flowing without them.
    }
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
    return "notls".equals(variant) ? NOTLS_MINER_DOWNLOAD_URL : TLS_MINER_DOWNLOAD_URL;
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
    connection.setConnectTimeout(DOWNLOAD_CONNECT_TIMEOUT_MS);
    connection.setReadTimeout(DOWNLOAD_READ_TIMEOUT_MS);
    connection.setRequestProperty("Accept", "application/octet-stream");

    try {
      int responseCode = connection.getResponseCode();
      if (responseCode < 200 || responseCode >= 300) {
        throw new IOException("GitHub returned HTTP " + responseCode + ".");
      }

      long totalBytes = connection.getContentLengthLong();
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
      }

      if (temp.length() <= 0) {
        throw new IOException("Downloaded miner binary was empty.");
      }

      if (target.exists() && !target.delete()) {
        throw new IOException("Could not replace existing miner binary.");
      }

      if (!temp.renameTo(target)) {
        throw new IOException("Could not install downloaded miner binary.");
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
    notifyListeners("downloadProgress", progress);
  }
}
