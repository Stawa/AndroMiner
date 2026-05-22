import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type {
  Cryptocurrency,
  HistoryPoint,
  MiningConfig,
  MiningSessionHistoryItem,
  MiningProfile,
  MiningState,
  MiningStats,
  MiningTelemetry,
  ProfilePreset,
  SavedMiningProfile
} from '../types/mining';

const maxHistoryPoints = 26;
const maxSessionHistoryItems = 20;
const activeSessionKey = 'androminer-active-session';
const uptimeKey = 'androminer-uptime-seconds';
const sessionHistoryKey = 'androminer-session-history';

export const cryptocurrencies: Cryptocurrency[] = [
  {
    id: 'xmr',
    name: 'Monero',
    symbol: 'XMR',
    algorithm: 'RandomX',
    defaultPort: 3333,
    logoText: 'M',
    logoClass: 'bg-orange-500'
  },
  {
    id: 'etc',
    name: 'Ethereum Classic',
    symbol: 'ETC',
    algorithm: 'Etchash',
    defaultPort: 4444,
    logoText: 'E',
    logoClass: 'bg-emerald-500'
  },
  {
    id: 'rvn',
    name: 'Ravencoin',
    symbol: 'RVN',
    algorithm: 'KawPow',
    defaultPort: 3636,
    logoText: 'R',
    logoClass: 'bg-blue-500'
  }
];

const initialConfig: MiningConfig = {
  coin: cryptocurrencies[0],
  algorithm: 'RandomX',
  poolUrl: 'rx.unmineable.com',
  poolPort: 3333,
  protocol: 'stratum',
  walletAddress: '0x7d8f...a4c2',
  workerName: 'andro-rig-01',
  password: 'x',
  threadCount: 4,
  customThreadCount: 4,
  totalDetectedThreads: 8,
  affinity: 'auto',
  priority: 'normal',
  hugePagesSupported: true,
  hugePagesEnabled: false,
  batteryAwareMode: true,
  autoPauseOnBattery: false,
  autoPauseScreenOff: true,
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

export const profilePresets: ProfilePreset[] = [
  {
    id: 'battery_saver',
    label: 'Battery Saver',
    description: 'Cooler CPU use for longer unplugged sessions',
    threads: 2,
    thermalLimit: 62,
    priority: 'low'
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Recommended for everyday Android mining',
    threads: 4,
    thermalLimit: 72,
    priority: 'normal'
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Higher output with tighter thermal monitoring',
    threads: 7,
    thermalLimit: 78,
    priority: 'high'
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Manual CPU and safety configuration',
    threads: 4,
    thermalLimit: 72,
    priority: 'normal'
  }
];

const formatClockLabel = (): string =>
  new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());

const createSeedHistory = (base: number, spread: number): HistoryPoint[] =>
  Array.from({ length: maxHistoryPoints }, (_, index) => ({
    label: `${index + 1}`,
    value: Number((base + Math.sin(index / 2) * spread + Math.random() * spread).toFixed(2))
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

export const useMiningMock = () => {
  const isLoading = ref(true);
  const state = ref<MiningState>('idle');
  const connected = ref(true);
  const config = reactive<MiningConfig>({ ...initialConfig });
  const stats = reactive<MiningStats>({ ...initialStats });
  const hashrateHistory = ref<HistoryPoint[]>(createSeedHistory(0.8, 0.35));
  const temperatureHistory = ref<HistoryPoint[]>(createSeedHistory(36, 2.4));
  const sessionHistory = ref<MiningSessionHistoryItem[]>(readSessionHistory());
  let tickHandle = 0;
  let startTimestamp = 0;
  let sessionStartedAt = 0;
  let sessionStartingAcceptedShares = 0;
  let sessionStartingRejectedShares = 0;
  let sessionHashrateTotal = 0;
  let sessionHashrateSamples = 0;
  let externalBatteryLevel: number | null = null;
  let externalCharging = false;
  let externalTemperature: number | null = null;

  const targetHashrate = computed(() => {
    if (state.value !== 'mining') {
      return 0;
    }

    const profileMultiplier: Record<MiningProfile, number> = {
      battery_saver: 0.62,
      balanced: 1,
      performance: 1.38,
      custom: 1.05
    };

    return config.threadCount * 12.8 * profileMultiplier[config.profile];
  });

  const telemetry = computed<MiningTelemetry>(() => ({
    state: state.value,
    connected: connected.value,
    config,
    stats,
    hashrateHistory: hashrateHistory.value,
    temperatureHistory: temperatureHistory.value,
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

  const pushHistory = (series: HistoryPoint[], value: number): HistoryPoint[] => [
    ...series.slice(-(maxHistoryPoints - 1)),
    {
      label: formatClockLabel(),
      value: Number(value.toFixed(2))
    }
  ];

  const tick = (): void => {
    connected.value = Math.random() > 0.025;

    if (state.value === 'mining') {
      const hashDrift = (Math.random() - 0.42) * 7;
      stats.hashrate = bounded(
        stats.hashrate + (targetHashrate.value - stats.hashrate) * 0.32 + hashDrift,
        0,
        140
      );
      stats.cpuUsage = bounded(config.threadCount * 11 + 20 + Math.random() * 12, 0, 100);
      stats.temperature = bounded(
        externalTemperature ??
          stats.temperature + config.threadCount * 0.18 + Math.random() * 1.5 - 0.55,
        34,
        84
      );
      stats.batteryLevel = bounded(
        externalBatteryLevel ??
          stats.batteryLevel +
            (externalCharging ? 0.18 : -(config.profile === 'performance' ? 0.42 : 0.24)),
        5,
        100
      );
      stats.isCharging = externalCharging;
      stats.activeThreads = config.threadCount;
      stats.estimatedEarnings = stats.hashrate * 0.000092;
      stats.uptimeSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
      sessionHashrateTotal += stats.hashrate;
      sessionHashrateSamples += 1;

      if (Math.random() > 0.72) {
        stats.acceptedShares += 1;
      }

      if (Math.random() > 0.96) {
        stats.rejectedShares += 1;
      }
    } else {
      stats.hashrate = bounded(stats.hashrate * 0.72, 0, 140);
      stats.cpuUsage = bounded(stats.cpuUsage * 0.74 + 4, 0, 100);
      stats.temperature = bounded(externalTemperature ?? stats.temperature - 0.7, 30, 84);
      stats.activeThreads = state.value === 'paused' ? config.threadCount : 0;
    }

    hashrateHistory.value = pushHistory(hashrateHistory.value, stats.hashrate);
    temperatureHistory.value = pushHistory(temperatureHistory.value, stats.temperature);
  };

  const startMining = (): void => {
    if (state.value !== 'idle') {
      return;
    }

    stats.uptimeSeconds = 0;
    sessionStartedAt = Date.now();
    sessionStartingAcceptedShares = stats.acceptedShares;
    sessionStartingRejectedShares = stats.rejectedShares;
    sessionHashrateTotal = 0;
    sessionHashrateSamples = 0;
    state.value = 'starting';
    window.setTimeout(() => {
      if (state.value !== 'starting') {
        return;
      }

      state.value = 'mining';
      startTimestamp = Date.now() - stats.uptimeSeconds * 1000;
    }, 900);
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

  const stopMining = (): void => {
    recordSession();
    state.value = 'idle';
    stats.uptimeSeconds = 0;
    stats.hashrate = 0;
    stats.activeThreads = 0;
    startTimestamp = 0;
    sessionStartedAt = 0;
    sessionHashrateTotal = 0;
    sessionHashrateSamples = 0;
  };

  const pauseMining = (): void => {
    state.value = state.value === 'paused' ? 'mining' : 'paused';
  };

  const updateProfile = (profile: MiningProfile): void => {
    const preset = profilePresets.find((item) => item.id === profile);

    if (!preset) {
      return;
    }

    config.profile = profile;
    config.threadCount = preset.threads;
    config.customThreadCount = preset.threads;
    config.thermalThreshold = preset.thermalLimit;
    config.priority = preset.priority;
  };

  const updateCoin = (coinId: string): void => {
    const coin = cryptocurrencies.find((item) => item.id === coinId);

    if (!coin) {
      return;
    }

    config.coin = coin;
    config.algorithm = coin.algorithm;
    config.poolPort = coin.defaultPort;
  };

  const applySavedProfile = (profile: SavedMiningProfile): void => {
    Object.assign(config, {
      ...profile.config,
      coin: { ...profile.config.coin }
    });
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
      startTimestamp = Date.now() - stats.uptimeSeconds * 1000;
      sessionStartedAt = startTimestamp;
    }

    window.setTimeout(() => {
      isLoading.value = false;
    }, 900);
    tickHandle = window.setInterval(tick, 1600);
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
    window.clearInterval(tickHandle);
  });

  return {
    telemetry,
    state,
    statusLabel,
    connected,
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
