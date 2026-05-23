import { Capacitor, registerPlugin } from '@capacitor/core';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { cryptocurrencies, getCryptocurrencyById } from '../data/miningCatalog';
import type {
  HistoryPoint,
  MiningApiTelemetry,
  MiningConfig,
  MiningProfile,
  MiningSessionHistoryItem,
  MiningState,
  MiningStats,
  MiningTelemetry,
  ProfilePreset,
  SavedMiningProfile
} from '../types/mining';

interface NativeMinerStats {
  hashrate?: number;
  acceptedShares?: number;
  rejectedShares?: number;
  activeThreads?: number;
  uptimeSeconds?: number;
}

interface NativeMinerStatus {
  available: boolean;
  running: boolean;
  message?: string;
  exitCode?: number | null;
  failureReason?: string;
  unexpectedExit?: boolean;
  stats?: NativeMinerStats;
  logs?: string[];
  apiTelemetry?: MiningApiTelemetry;
}

interface NativeMinerPlugin {
  start: (options: { config: MiningConfig }) => Promise<NativeMinerStatus>;
  pause: () => Promise<NativeMinerStatus>;
  stop: () => Promise<NativeMinerStatus>;
  status: () => Promise<NativeMinerStatus>;
}

export type MinerBackendState = 'checking' | 'ready' | 'missing' | 'web-unavailable' | 'error';

const NativeMiner = registerPlugin<NativeMinerPlugin>('NativeMiner');
const maxHistoryPoints = 26;
const maxSessionHistoryItems = 20;
const activeSessionKey = 'androminer-active-session';
const uptimeKey = 'androminer-uptime-seconds';
const sessionHistoryKey = 'androminer-session-history';

const initialConfig: MiningConfig = {
  coin: cryptocurrencies[0],
  algorithm: cryptocurrencies[0].algorithm,
  poolUrl: cryptocurrencies[0].defaultPoolUrl,
  poolPort: cryptocurrencies[0].defaultPort,
  protocol: cryptocurrencies[0].defaultProtocol,
  walletAddress: 'YOUR_XMR_WALLET_ADDRESS',
  workerName: 'android-phone',
  password: 'x',
  threadCount: 2,
  customThreadCount: 2,
  totalDetectedThreads: 8,
  affinity: 'auto',
  priority: 'normal',
  donateLevel: 1,
  donateOverProxy: 1,
  hugePagesSupported: false,
  hugePagesEnabled: false,
  batteryAwareMode: true,
  autoPauseOnBattery: false,
  autoPauseScreenOff: false,
  backgroundMining: true,
  thermalThreshold: 72,
  profile: 'balanced'
};

const initialStats: MiningStats = {
  hashrate: 0,
  acceptedShares: 0,
  rejectedShares: 0,
  cpuUsage: 4,
  temperature: 36,
  batteryLevel: 86,
  isCharging: false,
  activeThreads: 0,
  estimatedEarnings: 0,
  uptimeSeconds: 0
};

const defaultApiTelemetry = (): MiningApiTelemetry => ({
  available: false,
  source: 'stdout-fallback',
  host: '127.0.0.1',
  port: 0,
  lastUpdatedAt: null,
  message: 'XMRig API telemetry has not started.',
  threadHashrates: []
});

export const profilePresets: ProfilePreset[] = [
  {
    id: 'battery_saver',
    label: 'Battery Saver',
    description: 'Cooler CPU use for longer unplugged sessions',
    threads: 1,
    thermalLimit: 62,
    priority: 'low'
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Recommended for everyday Android mining',
    threads: 2,
    thermalLimit: 72,
    priority: 'low'
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Higher output with tighter thermal monitoring',
    threads: 4,
    thermalLimit: 78,
    priority: 'normal'
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Manual CPU and safety configuration',
    threads: 2,
    thermalLimit: 72,
    priority: 'low'
  }
];

const formatClockLabel = (): string =>
  new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());

const createEmptyHistory = (): HistoryPoint[] =>
  Array.from({ length: maxHistoryPoints }, (_, index) => ({
    label: `${index + 1}`,
    value: 0
  }));

const bounded = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatUptime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const chunk = (value: number): string => value.toString().padStart(2, '0');

  return `${chunk(hours)}:${chunk(minutes)}:${chunk(seconds)}`;
};

const readSessionHistory = (): MiningSessionHistoryItem[] => {
  try {
    const raw = localStorage.getItem(sessionHistoryKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as MiningSessionHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSessionHistory = (history: MiningSessionHistoryItem[]): void => {
  localStorage.setItem(sessionHistoryKey, JSON.stringify(history));
};

const cloneConfig = (config: MiningConfig): MiningConfig => ({
  ...config,
  coin: {
    ...config.coin,
    poolExamples: [...(config.coin.poolExamples || [])]
  }
});

export const useMiningController = () => {
  const isLoading = ref(true);
  const state = ref<MiningState>('idle');
  const connected = ref(false);
  const backendState = ref<MinerBackendState>('checking');
  const backendMessage = ref('Checking native miner backend...');
  const minerLogs = ref<string[]>([]);
  const config = reactive<MiningConfig>(cloneConfig(initialConfig));
  const stats = reactive<MiningStats>({ ...initialStats });
  const apiTelemetry = ref<MiningApiTelemetry>(defaultApiTelemetry());
  const hashrateHistory = ref<HistoryPoint[]>(createEmptyHistory());
  const temperatureHistory = ref<HistoryPoint[]>(createEmptyHistory());
  const sessionHistory = ref<MiningSessionHistoryItem[]>(readSessionHistory());
  let pollHandle = 0;
  let uiTickHandle = 0;
  let sessionStartedAt = 0;
  let sessionStartingAcceptedShares = 0;
  let sessionStartingRejectedShares = 0;
  let sessionHashrateTotal = 0;
  let sessionHashrateSamples = 0;
  let externalBatteryLevel: number | null = null;
  let externalCharging = false;
  let externalTemperature: number | null = null;

  const telemetry = computed<MiningTelemetry>(() => ({
    state: state.value,
    connected: connected.value,
    config,
    stats,
    hashrateHistory: hashrateHistory.value,
    temperatureHistory: temperatureHistory.value,
    logs: minerLogs.value,
    apiTelemetry: apiTelemetry.value,
    isLoading: isLoading.value
  }));

  const statusLabel = computed(() => {
    const labels: Record<MiningState, string> = {
      idle: 'Idle',
      starting: 'Starting',
      mining: 'Mining',
      paused: 'Paused'
    };

    return labels[state.value];
  });

  const uptimeLabel = computed(() => formatUptime(stats.uptimeSeconds));

  const resetActiveSession = (): void => {
    state.value = 'idle';
    connected.value = false;
    stats.uptimeSeconds = 0;
    stats.hashrate = 0;
    stats.activeThreads = 0;
    sessionStartedAt = 0;
    sessionHashrateTotal = 0;
    sessionHashrateSamples = 0;
  };

  const pushHistory = (series: HistoryPoint[], value: number): HistoryPoint[] => [
    ...series.slice(-(maxHistoryPoints - 1)),
    {
      label: formatClockLabel(),
      value: Number(value.toFixed(2))
    }
  ];

  const setBackendStatus = (status: NativeMinerStatus): void => {
    const wasActive = state.value === 'mining' || state.value === 'starting';
    const stoppedUnexpectedly = status.available && !status.running && wasActive;

    connected.value = status.available && status.running;
    backendState.value = status.available ? (stoppedUnexpectedly ? 'error' : 'ready') : 'missing';
    backendMessage.value =
      status.message ||
      (status.available
        ? 'Native miner backend is ready.'
        : 'Native miner backend is missing an Android XMRig binary.');
    minerLogs.value = Array.isArray(status.logs) ? status.logs : minerLogs.value;
    apiTelemetry.value = status.apiTelemetry || {
      ...apiTelemetry.value,
      available: false,
      source: 'stdout-fallback',
      message: status.running
        ? 'Using stdout fallback until XMRig API telemetry responds.'
        : 'XMRig API telemetry is inactive.'
    };

    if (stoppedUnexpectedly) {
      const exitCode = typeof status.exitCode === 'number' ? ` Exit code: ${status.exitCode}.` : '';
      const reason = status.failureReason || status.message || 'No miner error was reported.';
      backendMessage.value = `Native miner stopped unexpectedly.${exitCode} ${reason}`;
      recordSession();
      resetActiveSession();
      return;
    }

    if (status.running) {
      state.value = state.value === 'paused' ? 'paused' : 'mining';
    } else if (state.value !== 'idle') {
      state.value = 'idle';
    }
  };

  const applyNativeStats = (nativeStats?: NativeMinerStats): void => {
    if (!nativeStats) {
      return;
    }

    stats.hashrate = Number(nativeStats.hashrate ?? stats.hashrate);
    stats.acceptedShares = Number(nativeStats.acceptedShares ?? stats.acceptedShares);
    stats.rejectedShares = Number(nativeStats.rejectedShares ?? stats.rejectedShares);
    stats.activeThreads = Number(nativeStats.activeThreads ?? stats.activeThreads);
    const nativeUptimeSeconds = Number(nativeStats.uptimeSeconds ?? stats.uptimeSeconds);
    if ((state.value === 'mining' || state.value === 'starting') && nativeUptimeSeconds > 0) {
      if (sessionStartedAt <= 0) {
        sessionStartedAt = Date.now() - nativeUptimeSeconds * 1000;
      }
      stats.uptimeSeconds = Math.max(stats.uptimeSeconds, nativeUptimeSeconds);
    } else {
      stats.uptimeSeconds = nativeUptimeSeconds;
    }
    stats.cpuUsage =
      state.value === 'mining'
        ? bounded(config.threadCount * 11 + 18, 0, 100)
        : bounded(stats.cpuUsage * 0.75 + 4, 0, 100);
    stats.estimatedEarnings = 0;

    if (stats.hashrate > 0) {
      sessionHashrateTotal += stats.hashrate;
      sessionHashrateSamples += 1;
    }
  };

  const refreshLocalUptime = (): void => {
    if ((state.value !== 'mining' && state.value !== 'starting') || sessionStartedAt <= 0) {
      return;
    }

    stats.uptimeSeconds = Math.max(
      stats.uptimeSeconds,
      Math.floor((Date.now() - sessionStartedAt) / 1000)
    );
  };

  const refreshStatus = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
      connected.value = false;
      backendState.value = 'web-unavailable';
      backendMessage.value = 'Actual mining is only available in the Android app.';
      state.value = 'idle';
      return;
    }

    try {
      const status = await NativeMiner.status();
      setBackendStatus(status);
      applyNativeStats(status.stats);
    } catch (error) {
      connected.value = false;
      backendState.value = 'error';
      backendMessage.value = error instanceof Error ? error.message : 'Native miner status failed.';
      state.value = 'idle';
    }
  };

  const tickTelemetry = (): void => {
    stats.temperature = bounded(externalTemperature ?? stats.temperature - 0.35, 30, 100);
    stats.batteryLevel = bounded(
      externalBatteryLevel ??
        stats.batteryLevel + (externalCharging || state.value !== 'mining' ? 0.05 : -0.18),
      0,
      100
    );
    stats.isCharging = externalCharging;
    hashrateHistory.value = pushHistory(hashrateHistory.value, stats.hashrate);
    temperatureHistory.value = pushHistory(temperatureHistory.value, stats.temperature);
  };

  const startMining = async (): Promise<void> => {
    if (state.value !== 'idle') {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      backendState.value = 'web-unavailable';
      backendMessage.value = 'Build and run the Android app to start a real miner.';
      return;
    }

    stats.uptimeSeconds = 0;
    stats.hashrate = 0;
    stats.activeThreads = 0;
    apiTelemetry.value = defaultApiTelemetry();
    minerLogs.value = [];
    sessionStartedAt = Date.now();
    sessionStartingAcceptedShares = stats.acceptedShares;
    sessionStartingRejectedShares = stats.rejectedShares;
    sessionHashrateTotal = 0;
    sessionHashrateSamples = 0;
    state.value = 'starting';

    try {
      const nativeConfig = cloneConfig(config);
      nativeConfig.threadCount = bounded(
        nativeConfig.threadCount,
        1,
        nativeConfig.totalDetectedThreads
      );
      nativeConfig.customThreadCount = nativeConfig.threadCount;

      const status = await NativeMiner.start({ config: nativeConfig });
      setBackendStatus(status);
      applyNativeStats(status.stats);
      state.value = status.running ? 'mining' : 'idle';
    } catch (error) {
      state.value = 'idle';
      backendState.value = 'error';
      backendMessage.value =
        error instanceof Error ? error.message : 'Native miner failed to start.';
    }
  };

  const persistSessionHistory = (): void => {
    writeSessionHistory(sessionHistory.value);
  };

  const recordSession = (): void => {
    if (stats.uptimeSeconds <= 0 && sessionHashrateSamples === 0) {
      return;
    }

    const startedAt =
      sessionStartedAt > 0 ? sessionStartedAt : Date.now() - stats.uptimeSeconds * 1000;
    const acceptedShares = Math.max(0, stats.acceptedShares - sessionStartingAcceptedShares);
    const rejectedShares = Math.max(0, stats.rejectedShares - sessionStartingRejectedShares);
    const item: MiningSessionHistoryItem = {
      id: crypto.randomUUID(),
      title: `${config.coin.symbol} mining`,
      subtitle: `${config.algorithm} · ${config.threadCount} threads`,
      coinSymbol: config.coin.symbol,
      coinLogoText: config.coin.logoText,
      coinLogoClass: config.coin.logoClass,
      durationSeconds: stats.uptimeSeconds,
      acceptedShares,
      rejectedShares,
      averageHashrate:
        sessionHashrateSamples > 0
          ? Number((sessionHashrateTotal / sessionHashrateSamples).toFixed(2))
          : Number(stats.hashrate.toFixed(2)),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString()
    };

    sessionHistory.value = [item, ...sessionHistory.value].slice(0, maxSessionHistoryItems);
    persistSessionHistory();
  };

  const stopMining = async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeMiner.stop();
      } catch {
        backendState.value = 'error';
        backendMessage.value = 'Native miner stop request failed.';
      }
    }

    recordSession();
    resetActiveSession();
  };

  const pauseMining = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (state.value === 'paused') {
      state.value = 'idle';
      await startMining();
      return;
    }

    try {
      await NativeMiner.pause();
      state.value = 'paused';
      connected.value = false;
      stats.activeThreads = config.threadCount;
    } catch {
      backendState.value = 'error';
      backendMessage.value = 'Native miner pause request failed.';
    }
  };

  const updateProfile = (profile: MiningProfile): void => {
    const preset = profilePresets.find((item) => item.id === profile);

    if (!preset) {
      return;
    }

    config.profile = profile;
    config.threadCount = Math.min(config.totalDetectedThreads, preset.threads);
    config.customThreadCount = config.threadCount;
    config.thermalThreshold = preset.thermalLimit;
    config.priority = preset.priority;
  };

  const updateCoin = (coinId: string): void => {
    const coin = getCryptocurrencyById(coinId);

    if (!coin) {
      return;
    }

    config.coin = coin;
    config.algorithm = coin.algorithm;
    config.poolUrl = coin.defaultPoolUrl;
    config.poolPort = coin.defaultPort;
    config.protocol = coin.defaultProtocol;
  };

  const applySavedProfile = (profile: SavedMiningProfile): void => {
    Object.assign(config, cloneConfig(profile.config));
  };

  const deleteSessionHistoryItem = (id: string): void => {
    sessionHistory.value = sessionHistory.value.filter((item) => item.id !== id);
    persistSessionHistory();
  };

  const clearSessionHistory = (): void => {
    sessionHistory.value = [];
    persistSessionHistory();
  };

  const syncDeviceTelemetry = (
    batteryLevel: number,
    isCharging: boolean,
    temperatureC: number | null
  ): void => {
    externalBatteryLevel = bounded(batteryLevel, 0, 100);
    externalCharging = isCharging;
    externalTemperature = temperatureC === null ? null : bounded(temperatureC, 20, 100);
    stats.batteryLevel = externalBatteryLevel;
    stats.isCharging = isCharging;
    if (externalTemperature !== null) {
      stats.temperature = externalTemperature;
    }
  };

  onMounted(() => {
    const savedState = localStorage.getItem(activeSessionKey);
    const savedUptime = Number(localStorage.getItem(uptimeKey) || '0');

    if (savedState === 'mining' || savedState === 'paused' || savedState === 'starting') {
      state.value = savedState === 'starting' ? 'mining' : savedState;
      stats.uptimeSeconds = Number.isFinite(savedUptime) ? savedUptime : 0;
      sessionStartedAt = Date.now() - stats.uptimeSeconds * 1000;
    }

    void refreshStatus().finally(() => {
      isLoading.value = false;
    });

    pollHandle = window.setInterval(() => {
      void refreshStatus();
    }, 2000);

    uiTickHandle = window.setInterval(() => {
      refreshLocalUptime();
      tickTelemetry();
    }, 1000);
  });

  watch(state, (nextState) => {
    if (nextState === 'idle') {
      localStorage.removeItem(activeSessionKey);
      localStorage.removeItem(uptimeKey);
      return;
    }

    localStorage.setItem(activeSessionKey, nextState);
  });

  watch(
    () => stats.uptimeSeconds,
    (seconds) => {
      if (state.value !== 'idle') {
        localStorage.setItem(uptimeKey, String(seconds));
      }
    }
  );

  onUnmounted(() => {
    window.clearInterval(pollHandle);
    window.clearInterval(uiTickHandle);
  });

  return {
    telemetry,
    state,
    statusLabel,
    connected,
    backendState,
    backendMessage,
    minerLogs,
    apiTelemetry,
    config,
    stats,
    hashrateHistory,
    temperatureHistory,
    sessionHistory,
    uptimeLabel,
    isLoading,
    startMining,
    stopMining,
    pauseMining,
    updateProfile,
    updateCoin,
    applySavedProfile,
    deleteSessionHistoryItem,
    clearSessionHistory,
    syncDeviceTelemetry
  };
};
