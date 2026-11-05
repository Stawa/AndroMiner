import { mergeNativeHistory, type NativeSessionRecord } from '../utils/sessionHistory';
import { App } from '@capacitor/app';
import { useSettingsStore } from '../stores/settings';
import { formatDate, t } from '../i18n';
import { maxTemperatureLimitC, validateMiningSetup } from '../utils/configValidation';
import { useNativeMinerInfo } from './useNativeMinerInfo';
import { coinFitsEngine, engineForCoin, normalizeEngine } from '../utils/engines';
import { isFresh, nonNegative, readHashrates } from '../utils/miningTelemetry';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { cryptocurrencies, getCryptocurrencyById } from '../data/miningCatalog';
import type {
  CrashRestart,
  ProtectionEvent,
  ProtectionSnapshot,
  HistoryPoint,
  MiningApiTelemetry,
  MiningConfig,
  MiningHardwareMode,
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
  difficulty?: number | null;
  networkLatencyMs?: number | null;
  cpuUsage?: number | null;
  minerCpuUsage?: number | null;
  acceptedShares?: number;
  rejectedShares?: number;
  activeThreads?: number;
  uptimeSeconds?: number;
  remainingSeconds?: number | null;
  deadlineAt?: number | null;
}

interface NativeMinerStatus {
  sessions?: NativeSessionRecord[];
  session?: NativeSessionRecord;
  storageError?: string;
  available: boolean;
  running: boolean;
  paused?: boolean;
  stopRequested?: boolean;
  connected?: boolean;
  hashrateUpdatedAt?: number | null;
  activeConfig?: MiningConfig;
  message?: string;
  exitCode?: number | null;
  failureReason?: string;
  unexpectedExit?: boolean;
  stats?: NativeMinerStats;
  logs?: string[];
  apiTelemetry?: MiningApiTelemetry;
  crashRestart?: CrashRestart;
}

interface NativeMinerDownloadProgress {
  engine?: string;
  variant?: MinerBinaryVariant;
  percent?: number;
  downloadedBytes?: number;
  totalBytes?: number | null;
}

interface NativeMinerPlugin {
  start: (options: { config: MiningConfig }) => Promise<NativeMinerStatus>;
  download: (options: {
    variant: MinerBinaryVariant;
    engine?: string;
  }) => Promise<NativeMinerStatus>;
  addListener: (
    eventName: 'downloadProgress',
    listenerFunc: (progress: NativeMinerDownloadProgress) => void
  ) => Promise<PluginListenerHandle>;
  pause: () => Promise<NativeMinerStatus>;
  stop: () => Promise<NativeMinerStatus>;
  restartAfterCrash: () => Promise<NativeMinerStatus>;
  cancelRestartAfterCrash: () => Promise<NativeMinerStatus>;
  status: (options?: { engine: string }) => Promise<NativeMinerStatus>;
  deleteHistory: (options: { id?: string }) => Promise<NativeMinerStatus>;
  updateSafety: (options: {
    batteryFloor: number;
    chargingOnly: boolean;
    autoRestartOnCrash: boolean;
  }) => Promise<void>;
}

export type MinerBinaryVariant = 'tls' | 'notls';

export type MinerBackendState =
  'checking' | 'ready' | 'missing' | 'downloading' | 'web-unavailable' | 'error';

const NativeMiner = registerPlugin<NativeMinerPlugin>('NativeMiner');
const maxHistoryPoints = 26;
const maxSessionHistoryItems = 20;
const sessionHistoryKey = 'androminer-session-history';
const defaultCoin = getCryptocurrencyById('xmr') || cryptocurrencies[0];

const initialConfig: MiningConfig = {
  coin: defaultCoin,
  engine: 'xmrig',
  algorithm: defaultCoin.algorithm,
  poolUrl: defaultCoin.defaultPoolUrl,
  poolPort: defaultCoin.defaultPort,
  protocol: defaultCoin.defaultProtocol,
  walletAddress: 'YOUR_XMR_WALLET_ADDRESS',
  workerName: 'android-phone',
  password: '',
  threadCount: 2,
  customThreadCount: 2,
  totalDetectedThreads: 8,
  hardwareMode: 'cpu',
  affinity: 'auto',
  priority: 'normal',
  donateLevel: 0,
  donateOverProxy: 1,
  hugePagesSupported: false,
  hugePagesEnabled: false,
  batteryAwareMode: true,
  autoPauseOnBattery: false,
  autoPauseScreenOff: false,
  backgroundMining: true,
  thermalThreshold: 42,
  maxDurationMinutes: 0,
  profile: 'balanced'
};

const initialStats: MiningStats = {
  hashrate: 0,
  averageHashrate: null,
  peakHashrate: null,
  sampleState: 'inactive',
  difficulty: null,
  networkLatencyMs: null,
  acceptedShares: 0,
  rejectedShares: 0,
  cpuUsage: 0,
  minerCpuUsage: null,
  temperature: null,
  batteryLevel: null,
  isCharging: false,
  activeThreads: 0,
  estimatedEarnings: null,
  remainingSeconds: null,
  deadlineAt: null,
  uptimeSeconds: 0
};

const defaultApiTelemetry = (): MiningApiTelemetry => ({
  available: false,
  source: 'stdout-fallback',
  host: '127.0.0.1',
  port: 0,
  lastUpdatedAt: null,
  message: t('msg.apiNotStarted'),
  threadHashrates: []
});

export const profilePresets: ProfilePreset[] = [
  {
    id: 'battery_saver',
    threads: 1,
    affinity: 'little',
    thermalLimit: 40,
    priority: 'low'
  },
  {
    id: 'balanced',
    threads: 2,
    affinity: 'auto',
    thermalLimit: 42,
    priority: 'low'
  },
  {
    id: 'performance',
    threads: 4,
    affinity: 'big',
    thermalLimit: 44,
    priority: 'normal'
  },
  {
    id: 'custom',
    threads: 2,
    affinity: 'auto',
    thermalLimit: 42,
    priority: 'low'
  }
];

const formatClockLabel = (): string =>
  formatDate(Date.now(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const createEmptyHistory = (): HistoryPoint[] => [];

const bounded = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeHardwareMode = (_value: unknown): MiningHardwareMode => 'cpu';

const normalizeCpuAffinity = (value: unknown): MiningConfig['affinity'] =>
  value === 'little' || value === 'big' || value === 'custom' ? value : 'auto';

const hardwareModeLabel = (_mode: MiningHardwareMode): string => 'XMRig CPU';

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
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              typeof item.subtitle === 'string' &&
              typeof item.coinSymbol === 'string' &&
              typeof item.coinLogoText === 'string' &&
              typeof item.coinLogoClass === 'string' &&
              [item.durationSeconds, item.acceptedShares, item.rejectedShares].every(
                (value) => nonNegative(value) !== null
              ) &&
              (item.averageHashrate === null || nonNegative(item.averageHashrate) !== null) &&
              Number.isFinite(Date.parse(item.startedAt)) &&
              Number.isFinite(Date.parse(item.endedAt))
          )
          .slice(0, maxSessionHistoryItems)
      : [];
  } catch {
    return [];
  }
};

const writeSessionHistory = (history: MiningSessionHistoryItem[]): boolean => {
  try {
    localStorage.setItem(sessionHistoryKey, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
};

const emptyDownloadProgress = (): Required<NativeMinerDownloadProgress> => ({
  engine: 'xmrig',
  variant: 'tls',
  percent: 0,
  downloadedBytes: 0,
  totalBytes: null
});

const cloneConfig = (config: MiningConfig): MiningConfig => ({
  ...config,
  engine: normalizeEngine(config.engine),
  maxDurationMinutes: config.maxDurationMinutes ?? 0,
  hardwareMode: normalizeHardwareMode(config.hardwareMode),
  affinity: normalizeCpuAffinity(config.affinity),
  coin: {
    ...(getCryptocurrencyById(config.coin.id) || config.coin),
    poolExamples: [...((getCryptocurrencyById(config.coin.id) || config.coin).poolExamples || [])]
  }
});

export const useMiningController = () => {
  const settings = useSettingsStore();
  const { engines: engineInfo, refreshNativeMinerInfo } = useNativeMinerInfo();
  let stopAfterStart = false;
  const isLoading = ref(true);
  const state = ref<MiningState>('idle');
  const connected = ref(false);
  const backendState = ref<MinerBackendState>('checking');
  const backendMessage = ref(t('msg.checkingBackend'));
  const lastBackendError = ref('');
  const historySaveError = ref('');
  const downloadProgress = ref<Required<NativeMinerDownloadProgress>>(emptyDownloadProgress());
  const minerLogs = ref<string[]>([]);
  const config = reactive<MiningConfig>(cloneConfig(initialConfig));
  const stats = reactive<MiningStats>({ ...initialStats });
  const apiTelemetry = ref<MiningApiTelemetry>(defaultApiTelemetry());
  /** Live native protection reading; null unless a session is running. */
  const protection = ref<ProtectionSnapshot | null>(null);
  /** Protection events of the current or most recent native session. */
  const protectionEvents = ref<ProtectionEvent[]>([]);
  /** Set while the native layer is waiting to restart a crashed miner. */
  const crashRestart = ref<CrashRestart | null>(null);
  const hashrateHistory = ref<HistoryPoint[]>(createEmptyHistory());
  const temperatureHistory = ref<HistoryPoint[]>(createEmptyHistory());
  const sessionHistory = ref<MiningSessionHistoryItem[]>(readSessionHistory());
  let pollHandle = 0;
  let pollBusy = false;
  let actionBusy = false;
  let disposed = false;
  let appActive = true;
  let appListener: PluginListenerHandle | null = null;
  let lastSampleAt = 0;
  let hasConnectedThisRun = false;
  let uiTickHandle = 0;
  let sessionStartedAt = 0;
  let sessionStartingAcceptedShares = 0;
  let sessionStartingRejectedShares = 0;
  let sessionHashrateTotal = 0;
  let sessionHashrateSamples = 0;

  let externalBatteryLevel: number | null = null;
  let externalCharging = false;
  let externalTemperature: number | null = null;
  let downloadProgressHandle: PluginListenerHandle | null = null;

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
    return state.value === 'mining' ? t('state.miningShort') : t(`state.${state.value}`);
  });

  const uptimeLabel = computed(() => formatUptime(stats.uptimeSeconds));

  const resetActiveSession = (): void => {
    state.value = 'idle';
    hasConnectedThisRun = false;
    connected.value = false;
    stats.uptimeSeconds = 0;
    stats.hashrate = 0;
    stats.activeThreads = 0;
    stats.minerCpuUsage = null;
    stats.cpuUsage = 0;
    stats.difficulty = null;
    stats.networkLatencyMs = null;
    stats.averageHashrate = null;
    stats.peakHashrate = null;
    stats.sampleState = 'inactive';
    apiTelemetry.value = defaultApiTelemetry();
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

  const formatNativeFailureMessage = (status: NativeMinerStatus): string => {
    const exitCode =
      typeof status.exitCode === 'number' && Number.isFinite(status.exitCode)
        ? t('msg.exitCode', { code: status.exitCode })
        : '';
    const reason =
      status.session?.endReason || status.failureReason || status.message || t('msg.noMinerError');

    return t('msg.minerStopped', { exitCode, reason });
  };

  const setBackendError = (message: string): void => {
    lastBackendError.value = message;
    backendState.value = 'error';
    backendMessage.value = message;
  };

  const setBackendStatus = (status: NativeMinerStatus): void => {
    if (status.sessions) {
      sessionHistory.value = mergeNativeHistory(sessionHistory.value, status.sessions);
      historySaveError.value = status.storageError || '';
    }
    const wasActive = ['mining', 'starting', 'reconnecting'].includes(state.value);
    const stoppedUnexpectedly =
      status.available && !status.running && !status.paused && !status.stopRequested && wasActive;
    const unexpectedExit = Boolean(status.unexpectedExit || stoppedUnexpectedly);
    const nextMessage =
      status.storageError ||
      status.session?.endReason ||
      status.message ||
      (status.available ? t('msg.backendReady') : t('msg.downloadRequired'));

    connected.value = status.running && status.connected === true;
    crashRestart.value = status.crashRestart ?? null;
    protection.value = status.running ? (status.session?.protection ?? null) : null;
    protectionEvents.value = status.session?.protectionEvents ?? [];
    minerLogs.value = Array.isArray(status.logs) ? status.logs : minerLogs.value;
    apiTelemetry.value = status.apiTelemetry || {
      ...apiTelemetry.value,
      available: false,
      source: 'stdout-fallback',
      message: status.running ? t('msg.stdoutFallback') : t('msg.apiInactive')
    };

    if (unexpectedExit && !status.running) {
      setBackendError(formatNativeFailureMessage(status));
      if (stoppedUnexpectedly) {
        recordSession();
        resetActiveSession();
        state.value = 'error';
      } else {
        resetActiveSession();
        state.value = 'error';
      }
      return;
    }

    if (status.running) {
      lastBackendError.value = '';
      backendState.value = 'ready';
      backendMessage.value = nextMessage;
      if (connected.value) hasConnectedThisRun = true;
      state.value =
        status.session?.state === 'running'
          ? 'mining'
          : hasConnectedThisRun
            ? 'reconnecting'
            : 'starting';
      if (!sessionStartedAt)
        sessionStartedAt = Date.now() - (status.stats?.uptimeSeconds ?? 0) * 1000;
      return;
    }

    if (
      status.paused === true ||
      (status.paused === undefined && ['paused', 'pausing'].includes(state.value))
    ) {
      if (sessionStartedAt > 0) recordSession();
      sessionStartedAt = 0;
      sessionHashrateSamples = 0;
      lastBackendError.value = '';
      backendState.value = status.available ? 'ready' : 'missing';
      state.value = 'paused';
      backendMessage.value = status.available
        ? [nextMessage, historySaveError.value].filter(Boolean).join(' ')
        : nextMessage;
      connected.value = false;
      stats.hashrate = 0;
      stats.minerCpuUsage = null;
      stats.cpuUsage = 0;
      stats.activeThreads = 0;
      stats.sampleState = 'inactive';
      stats.averageHashrate = null;
      stats.peakHashrate = null;
      return;
    }

    if (wasActive && status.stopRequested && !status.running && sessionStartedAt > 0)
      recordSession();
    if (!status.available) {
      lastBackendError.value = '';
      backendState.value = 'missing';
      backendMessage.value = nextMessage;
    } else if (backendState.value === 'error' && lastBackendError.value) {
      backendMessage.value = lastBackendError.value;
    } else {
      backendState.value = 'ready';
      backendMessage.value = nextMessage;
    }

    resetActiveSession();
    if (backendState.value === 'error') state.value = 'error';
  };

  const applyNativeStats = (nativeStats?: NativeMinerStats, status?: NativeMinerStatus): void => {
    if (!nativeStats || !status?.running) return;
    const rates = readHashrates(status.apiTelemetry?.hashrate);
    const timestamp = status.apiTelemetry?.available
      ? status.apiTelemetry.lastUpdatedAt
      : status.hashrateUpdatedAt;
    const fresh = isFresh(timestamp, Date.now(), status.apiTelemetry?.available ? 10000 : 90000);
    const speed = status.apiTelemetry?.available
      ? rates.current
      : nonNegative(nativeStats.hashrate);
    stats.sampleState = fresh
      ? speed !== null
        ? 'live'
        : 'unavailable'
      : timestamp
        ? 'stale'
        : 'unavailable';
    stats.hashrate = stats.sampleState === 'live' ? (speed ?? 0) : 0;
    stats.averageHashrate = fresh ? rates.average : null;
    stats.peakHashrate = fresh ? rates.peak : null;
    stats.minerCpuUsage = nonNegative(nativeStats.minerCpuUsage);
    if (stats.minerCpuUsage !== null) stats.minerCpuUsage = bounded(stats.minerCpuUsage, 0, 100);
    stats.cpuUsage = stats.minerCpuUsage ?? 0;
    stats.difficulty = nonNegative(nativeStats.difficulty);
    stats.networkLatencyMs = nonNegative(nativeStats.networkLatencyMs);
    stats.acceptedShares = nonNegative(nativeStats.acceptedShares) ?? stats.acceptedShares;
    stats.rejectedShares = nonNegative(nativeStats.rejectedShares) ?? stats.rejectedShares;
    stats.activeThreads = nonNegative(nativeStats.activeThreads) ?? 0;
    stats.uptimeSeconds = nonNegative(nativeStats.uptimeSeconds) ?? 0;
    stats.remainingSeconds = nonNegative(nativeStats.remainingSeconds);
    stats.deadlineAt = nonNegative(nativeStats.deadlineAt);
    stats.estimatedEarnings = null;
    // Sample each native observation once, including valid zero speeds.
    if (stats.sampleState === 'live' && timestamp !== lastSampleAt) {
      lastSampleAt = timestamp ?? 0;
      sessionHashrateTotal += stats.hashrate;
      sessionHashrateSamples += 1;
      hashrateHistory.value = pushHistory(hashrateHistory.value, stats.hashrate);
    }
  };

  let lastUptimeTick = performance.now();
  const refreshLocalUptime = (): void => {
    const elapsed = Math.floor((performance.now() - lastUptimeTick) / 1000);
    lastUptimeTick = performance.now();
    if (!['mining', 'starting', 'reconnecting'].includes(state.value) || sessionStartedAt <= 0) {
      return;
    }

    stats.uptimeSeconds += Math.max(0, elapsed);
    if (stats.remainingSeconds !== null)
      stats.remainingSeconds = Math.max(0, stats.remainingSeconds - elapsed);
  };

  const refreshStatus = async (): Promise<void> => {
    if (disposed || pollBusy || actionBusy || !appActive || backendState.value === 'downloading') {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      connected.value = false;
      backendState.value = 'web-unavailable';
      backendMessage.value = t('msg.androidOnlyMining');
      state.value = 'idle';
      return;
    }

    pollBusy = true;
    try {
      const status = await NativeMiner.status({ engine: config.engine });
      if (disposed || actionBusy) return;
      if (status.running && status.activeConfig)
        Object.assign(config, cloneConfig(status.activeConfig));
      if (!status.running && sessionStartedAt > 0) {
        stats.uptimeSeconds = Math.max(
          stats.uptimeSeconds,
          nonNegative(status.stats?.uptimeSeconds) ?? 0
        );
        stats.acceptedShares = nonNegative(status.stats?.acceptedShares) ?? stats.acceptedShares;
        stats.rejectedShares = nonNegative(status.stats?.rejectedShares) ?? stats.rejectedShares;
      }
      setBackendStatus(status);
      applyNativeStats(status.stats, status);
    } catch (error) {
      connected.value = false;
      stats.sampleState = 'stale';
      stats.hashrate = 0;
      stats.averageHashrate = null;
      stats.peakHashrate = null;
      stats.minerCpuUsage = null;
      stats.difficulty = null;
      stats.networkLatencyMs = null;
      apiTelemetry.value = { ...defaultApiTelemetry(), message: t('msg.statusRetry') };
      backendMessage.value = error instanceof Error ? error.message : t('msg.statusRetry');
      if (['mining', 'starting', 'reconnecting'].includes(state.value))
        state.value = 'reconnecting';
    } finally {
      pollBusy = false;
    }
  };

  /**
   * Downloads engines one after another, in the given order. Every download is hash-checked by the
   * native layer before it is installed. Resolves to the failure messages, empty on full success,
   * so one failing engine never hides another's result or blocks the ones after it.
   */
  const downloadEngines = async (
    ids: readonly string[],
    variant: MinerBinaryVariant
  ): Promise<string[]> => {
    if (!Capacitor.isNativePlatform()) {
      backendState.value = 'web-unavailable';
      backendMessage.value = t('msg.buildToDownload');
      return [backendMessage.value];
    }
    if (backendState.value === 'downloading' || actionBusy) return [];

    const failures: string[] = [];
    backendState.value = 'downloading';
    for (const id of ids) {
      const name = engineInfo.value.find((engine) => engine.id === id)?.name ?? id;
      downloadProgress.value = { ...emptyDownloadProgress(), engine: id, variant };
      backendMessage.value = t('msg.downloadingEngine', {
        engine: name,
        variant: variant === 'tls' ? 'TLS' : 'no-TLS'
      });
      try {
        await NativeMiner.download({ engine: id, variant });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : t('msg.downloadFailed'));
      }
    }
    connected.value = false;
    backendState.value = 'checking';
    await refreshNativeMinerInfo().catch(() => undefined);
    await refreshStatus();
    if (failures.length) backendMessage.value = failures.join(' ');
    return failures;
  };

  const tickTelemetry = (): void => {
    stats.temperature = externalTemperature;
    stats.batteryLevel = externalBatteryLevel;
    stats.isCharging = externalCharging;
    if (externalTemperature !== null)
      temperatureHistory.value = pushHistory(temperatureHistory.value, externalTemperature);
  };

  const startMining = async (): Promise<void> => {
    if (actionBusy || !['idle', 'paused', 'error'].includes(state.value)) {
      return;
    }

    const temperatureLimit = Math.min(config.thermalThreshold, maxTemperatureLimitC);
    const batteryFloor = settings.batterySafety.stopBelowPercent;
    if (
      temperatureLimit > 0 &&
      externalTemperature !== null &&
      externalTemperature >= temperatureLimit
    ) {
      setBackendError(t('msg.tooHot'));
      return;
    }
    if (batteryFloor > 0 && externalBatteryLevel !== null && externalBatteryLevel <= batteryFloor) {
      setBackendError(t('msg.batteryLow', { percent: batteryFloor }));
      return;
    }
    if (
      !externalCharging &&
      (config.autoPauseOnBattery || settings.batterySafety.mineOnlyCharging)
    ) {
      setBackendError(t('msg.needCharger'));
      return;
    }
    if (!Capacitor.isNativePlatform()) {
      backendState.value = 'web-unavailable';
      backendMessage.value = t('msg.buildToStart');
      return;
    }

    if (backendState.value === 'missing') {
      backendMessage.value = t('msg.downloadBeforeStart');
      return;
    }

    if (config.coin.supportStatus !== 'bundled' || config.coin.miner !== 'xmrig') {
      backendState.value = 'error';
      backendMessage.value = t('msg.needsCustomMiner', {
        coin: config.coin.name,
        miner: config.coin.minerName || t('msg.customMiner')
      });
      return;
    }

    if (Object.values(validateMiningSetup(config)).some(Boolean)) {
      setBackendError(t('msg.incompleteSetup'));
      return;
    }
    actionBusy = true;
    stopAfterStart = false;
    stats.acceptedShares = 0;
    stats.rejectedShares = 0;
    stats.difficulty = null;
    stats.networkLatencyMs = null;
    stats.averageHashrate = null;
    stats.peakHashrate = null;
    stats.sampleState = 'unavailable';
    hashrateHistory.value = [];
    lastSampleAt = 0;
    hasConnectedThisRun = false;
    stats.uptimeSeconds = 0;
    stats.hashrate = 0;
    stats.activeThreads = 0;
    stats.cpuUsage = 0;
    stats.minerCpuUsage = null;
    apiTelemetry.value = defaultApiTelemetry();
    minerLogs.value = [];
    lastBackendError.value = '';
    sessionStartedAt = Date.now();

    sessionStartingAcceptedShares = stats.acceptedShares;
    sessionStartingRejectedShares = stats.rejectedShares;
    sessionHashrateTotal = 0;
    sessionHashrateSamples = 0;
    state.value = 'starting';

    try {
      const nativeConfig = cloneConfig(config);
      nativeConfig.walletAddress = nativeConfig.walletAddress.trim();
      nativeConfig.poolUrl = nativeConfig.poolUrl.trim();
      nativeConfig.workerName = nativeConfig.workerName.trim();
      nativeConfig.threadCount = bounded(
        nativeConfig.threadCount,
        1,
        nativeConfig.totalDetectedThreads
      );
      nativeConfig.customThreadCount = nativeConfig.threadCount;
      nativeConfig.hardwareMode = normalizeHardwareMode(nativeConfig.hardwareMode);

      await syncSafetySettings();
      if (stopAfterStart) return;
      const status = await NativeMiner.start({ config: nativeConfig });
      if (status.running && status.activeConfig)
        Object.assign(config, cloneConfig(status.activeConfig));
      if (!stopAfterStart) setBackendStatus(status);
      applyNativeStats(status.stats, status);
      if (!status.running) setBackendError(status.message || t('msg.didNotStart'));
    } catch (error) {
      resetActiveSession();
      state.value = 'error';
      setBackendError(error instanceof Error ? error.message : t('msg.startFailed'));
    } finally {
      actionBusy = false;
      if (stopAfterStart) {
        stopAfterStart = false;
        await stopMining();
      }
    }
  };

  const persistSessionHistory = (): void => {
    historySaveError.value = writeSessionHistory(sessionHistory.value)
      ? ''
      : t('msg.historyNotSaved');
  };

  const recordSession = (): void => {
    if (Capacitor.isNativePlatform()) return;
    if (sessionStartedAt <= 0 || (stats.uptimeSeconds <= 0 && sessionHashrateSamples === 0)) {
      return;
    }

    const startedAt =
      sessionStartedAt > 0 ? sessionStartedAt : Date.now() - stats.uptimeSeconds * 1000;
    const acceptedShares = Math.max(0, stats.acceptedShares - sessionStartingAcceptedShares);
    const rejectedShares = Math.max(0, stats.rejectedShares - sessionStartingRejectedShares);
    const item: MiningSessionHistoryItem = {
      id: crypto.randomUUID(),
      title: `${config.coin.symbol} mining`,
      subtitle: `${config.algorithm} · ${hardwareModeLabel(
        normalizeHardwareMode(config.hardwareMode)
      )} · ${config.threadCount} threads`,
      coinSymbol: config.coin.symbol,
      coinLogoText: config.coin.logoText,
      coinLogoClass: config.coin.logoClass,
      durationSeconds: stats.uptimeSeconds,
      acceptedShares,
      rejectedShares,
      averageHashrate:
        sessionHashrateSamples > 0
          ? Number((sessionHashrateTotal / sessionHashrateSamples).toFixed(2))
          : null,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString()
    };

    sessionHistory.value = [item, ...sessionHistory.value].slice(0, maxSessionHistoryItems);
    persistSessionHistory();
  };

  const restartAfterCrash = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      setBackendStatus(await NativeMiner.restartAfterCrash());
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelRestartAfterCrash = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    crashRestart.value = null;
    try {
      setBackendStatus(await NativeMiner.cancelRestartAfterCrash());
    } catch {
      /* The next status poll reports the real state. */
    }
  };

  const stopMining = async (): Promise<void> => {
    if (actionBusy) {
      if (state.value === 'starting') {
        stopAfterStart = true;
        state.value = 'stopping';
        backendMessage.value = t('msg.stopRequested');
      }
      return;
    }
    actionBusy = true;
    const previous = state.value;
    state.value = 'stopping';
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await NativeMiner.stop();
        if (status.running) throw new Error(t('msg.stillRunningStop'));
        if (status.sessions)
          sessionHistory.value = mergeNativeHistory(sessionHistory.value, status.sessions);
        historySaveError.value = status.storageError || '';
        minerLogs.value = status.logs ?? minerLogs.value;
        if (sessionStartedAt > 0) {
          stats.uptimeSeconds = Math.max(
            stats.uptimeSeconds,
            nonNegative(status.stats?.uptimeSeconds) ?? 0
          );
          stats.acceptedShares = nonNegative(status.stats?.acceptedShares) ?? stats.acceptedShares;
          stats.rejectedShares = nonNegative(status.stats?.rejectedShares) ?? stats.rejectedShares;
        }
      }
      recordSession();
      resetActiveSession();
      lastBackendError.value = '';
      backendState.value = Capacitor.isNativePlatform() ? 'ready' : 'web-unavailable';
      backendMessage.value = [t('msg.stopped'), historySaveError.value].filter(Boolean).join(' ');
    } catch (error) {
      state.value = previous;
      backendMessage.value = error instanceof Error ? error.message : t('msg.stopFailed');
    } finally {
      actionBusy = false;
    }
  };

  const pauseMining = async (): Promise<void> => {
    if (actionBusy || !Capacitor.isNativePlatform()) return;
    if (state.value === 'paused') {
      await startMining();
      return;
    }
    if (!['mining', 'reconnecting'].includes(state.value)) return;
    actionBusy = true;
    const previous = state.value;
    state.value = 'pausing';
    try {
      const status = await NativeMiner.pause();
      if (status.running) throw new Error(t('msg.stillRunningPause'));
      stats.acceptedShares = nonNegative(status.stats?.acceptedShares) ?? stats.acceptedShares;
      stats.rejectedShares = nonNegative(status.stats?.rejectedShares) ?? stats.rejectedShares;
      stats.uptimeSeconds = Math.max(
        stats.uptimeSeconds,
        nonNegative(status.stats?.uptimeSeconds) ?? 0
      );
      recordSession(); // Native pause ends the process; resume starts a new run.
      sessionStartedAt = 0;
      sessionHashrateSamples = 0;
      setBackendStatus(status);
      stats.sampleState = 'inactive';
      stats.uptimeSeconds = 0;
      stats.averageHashrate = null;
      stats.peakHashrate = null;
    } catch (error) {
      state.value = previous;
      backendMessage.value = error instanceof Error ? error.message : t('msg.pauseFailed');
    } finally {
      actionBusy = false;
    }
  };

  const updateProfileConfig = (profile: MiningProfile): void => {
    if (profile === 'custom') {
      config.profile = 'custom';
      config.threadCount = bounded(
        config.customThreadCount || config.threadCount,
        1,
        config.totalDetectedThreads
      );
      config.customThreadCount = config.threadCount;
      return;
    }

    const preset = profilePresets.find((item) => item.id === profile);

    if (!preset) {
      return;
    }

    config.profile = profile;
    config.threadCount = Math.min(config.totalDetectedThreads, preset.threads);
    config.customThreadCount = config.threadCount;
    config.affinity = preset.affinity;
    config.thermalThreshold = preset.thermalLimit;
    config.priority = preset.priority;
  };

  const updateProfile = async (profile: MiningProfile): Promise<void> => {
    if (actionBusy) return;
    const wasRunning = ['mining', 'reconnecting'].includes(state.value);
    if (wasRunning) {
      await pauseMining();
      if (state.value !== 'paused') return;
    }
    updateProfileConfig(profile);
    if (wasRunning) backendMessage.value = t('msg.profileChanged');
  };

  const updateCoin = (coinId: string): void => {
    const coin = getCryptocurrencyById(coinId);

    if (!coin || coin.supportStatus !== 'bundled') {
      return;
    }

    const placeholderWallet = /^YOUR_[A-Z0-9]+_WALLET_ADDRESS$/;

    config.coin = coin;
    /* The coin picks its engine. A custom engine the user chose stays only while it can still mine
       the new coin. */
    const previousEngine = config.engine;
    if (!coinFitsEngine(coin, config.engine, engineInfo.value)) {
      config.engine = engineForCoin(coin, engineInfo.value);
    }
    if (config.engine !== previousEngine) void refreshStatus();
    config.algorithm = coin.algorithm;
    config.poolUrl = coin.defaultPoolUrl;
    config.poolPort = coin.defaultPort;
    config.protocol = coin.defaultProtocol;
    if (config.password === 'x') {
      config.password = '';
    }

    if (!config.walletAddress || placeholderWallet.test(config.walletAddress)) {
      config.walletAddress = `YOUR_${coin.symbol}_WALLET_ADDRESS`;
    }
  };

  const updateEngine = (engineId: string): void => {
    const engine = normalizeEngine(engineId);
    if (!coinFitsEngine(config.coin, engine, engineInfo.value)) return;
    config.engine = engine;
    void refreshStatus();
  };

  const applySavedProfile = (profile: SavedMiningProfile): void => {
    Object.assign(config, cloneConfig(profile.config));
  };

  const deleteSessionHistoryItem = async (id: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) await NativeMiner.deleteHistory({ id });
      sessionHistory.value = sessionHistory.value.filter((item) => item.id !== id);
      persistSessionHistory();
    } catch {
      backendMessage.value = t('msg.deleteFailed');
    }
  };

  const clearSessionHistory = async (): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) await NativeMiner.deleteHistory({});
      sessionHistory.value = [];
      persistSessionHistory();
    } catch {
      backendMessage.value = t('msg.clearFailed');
    }
  };

  const syncDeviceTelemetry = (
    batteryLevel: number | null,
    isCharging: boolean,
    temperatureC: number | null
  ): void => {
    externalBatteryLevel = batteryLevel === null ? null : bounded(batteryLevel, 0, 100);
    externalCharging = isCharging;
    externalTemperature =
      temperatureC !== null && Number.isFinite(temperatureC) ? temperatureC : null;
    stats.batteryLevel = externalBatteryLevel;
    stats.isCharging = isCharging;
    stats.temperature = externalTemperature;
  };

  const syncSafetySettings = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await NativeMiner.updateSafety({
      batteryFloor: settings.batterySafety.stopBelowPercent,
      chargingOnly: settings.batterySafety.mineOnlyCharging,
      autoRestartOnCrash: settings.autoRestartOnCrash
    });
  };

  onMounted(() => {
    void refreshStatus().finally(() => {
      isLoading.value = false;
    });

    if (Capacitor.isNativePlatform()) {
      void NativeMiner.addListener('downloadProgress', (progress) => {
        downloadProgress.value = {
          engine: progress.engine ?? 'xmrig',
          variant: progress.variant === 'notls' ? 'notls' : 'tls',
          percent: bounded(Number(progress.percent ?? 0), 0, 100),
          downloadedBytes: Math.max(0, Number(progress.downloadedBytes ?? 0)),
          totalBytes:
            typeof progress.totalBytes === 'number' && progress.totalBytes > 0
              ? progress.totalBytes
              : null
        };
      }).then((handle) => {
        if (disposed) void handle.remove();
        else downloadProgressHandle = handle;
      });
    }

    const poll = async (): Promise<void> => {
      await refreshStatus();
      if (!disposed) pollHandle = window.setTimeout(poll, 2000);
    };
    pollHandle = window.setTimeout(poll, 2000);
    if (Capacitor.isNativePlatform())
      void App.addListener('appStateChange', ({ isActive }) => {
        appActive = isActive;
        if (isActive) void refreshStatus();
        else if (!config.backgroundMining || config.autoPauseScreenOff) void pauseMining();
      }).then((handle) => {
        if (disposed) void handle.remove();
        else appListener = handle;
      });

    uiTickHandle = window.setInterval(() => {
      if (appActive) {
        refreshLocalUptime();
        tickTelemetry();
      }
    }, 1000);
  });

  onUnmounted(() => {
    disposed = true;
    window.clearTimeout(pollHandle);
    void appListener?.remove();
    window.clearInterval(uiTickHandle);
    void downloadProgressHandle?.remove();
  });

  return {
    telemetry,
    state,
    statusLabel,
    connected,
    backendState,
    backendMessage,
    downloadProgress,
    minerLogs,
    apiTelemetry,
    protection,
    protectionEvents,
    crashRestart,
    restartAfterCrash,
    cancelRestartAfterCrash,
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
    updateEngine,
    applySavedProfile,
    deleteSessionHistoryItem,
    clearSessionHistory,
    syncDeviceTelemetry,
    downloadEngines,
    refreshStatus,
    syncSafetySettings
  };
};
