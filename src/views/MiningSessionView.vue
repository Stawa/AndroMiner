<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import HashrateRing from '../components/HashrateRing.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import SessionControls from '../components/SessionControls.vue';
import StatusIndicator from '../components/StatusIndicator.vue';
import WarningBottomSheet, { type WarningType } from '../components/WarningBottomSheet.vue';
import { profilePresets } from '../composables/useMiningController';
import { useSheetDrag } from '../composables/useSheetDrag';
import type {
  DeviceTelemetry,
  HistoryPoint,
  MiningApiTelemetry,
  MiningConfig,
  MiningProfile,
  MiningState,
  MiningStats
} from '../types/mining';

interface MiningSessionViewProps {
  state: MiningState;
  config: MiningConfig;
  stats: MiningStats;
  device: DeviceTelemetry;
  connected: boolean;
  uptime: string;
  backendMessage: string;
  logs: string[];
  apiTelemetry: MiningApiTelemetry;
  hashrateHistory: HistoryPoint[];
}

interface ImmersiveModePlugin {
  enter: () => Promise<{ active: boolean }>;
  exit: () => Promise<{ active: boolean }>;
}

type LogTone = 'danger' | 'warning' | 'success' | 'muted';

const props = defineProps<MiningSessionViewProps>();

const emit = defineEmits<{
  pause: [];
  stop: [];
  profile: [value: MiningProfile];
  resume: [];
}>();

const detailsOpen = ref(false);
const fullscreenActive = ref(false);
const fullscreenBusy = ref(false);
const profilePickerOpen = ref(false);
const warningType = ref<WarningType | null>(null);
const ImmersiveMode = registerPlugin<ImmersiveModePlugin>('ImmersiveMode');

const recentHashrates = computed(() =>
  props.hashrateHistory
    .map((point) => point.value)
    .filter((value) => Number.isFinite(value) && value > 0)
);
const baselineHashrates = computed(() => {
  if (recentHashrates.value.length <= 1) {
    return recentHashrates.value;
  }

  return recentHashrates.value.slice(0, -1);
});
const averageHashrate = computed(() => {
  const samples = baselineHashrates.value;

  if (samples.length === 0) {
    return Math.max(0, props.stats.hashrate);
  }

  return samples.reduce((total, value) => total + value, 0) / samples.length;
});
const poolAddress = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const totalHashesLabel = computed(() => {
  const totalHashes = Math.max(0, props.stats.hashrate * props.stats.uptimeSeconds);

  if (totalHashes >= 1_000_000_000) {
    return `${(totalHashes / 1_000_000_000).toFixed(2)}B`;
  }

  if (totalHashes >= 1_000_000) {
    return `${(totalHashes / 1_000_000).toFixed(2)}M`;
  }

  if (totalHashes >= 1_000) {
    return `${(totalHashes / 1_000).toFixed(1)}K`;
  }

  return Math.round(totalHashes).toLocaleString();
});
const thermalTone = computed(() =>
  props.stats.temperature >= props.config.thermalThreshold - 5 ? 'warning' : 'normal'
);
const batterySafetyLimit = 20;
const profileLabel = computed(
  () => profilePresets.find((preset) => preset.id === props.config.profile)?.label || 'Profile'
);

const classifyLogLine = (line: string): LogTone => {
  const normalized = line.toLowerCase();

  if (
    /error|fail|fatal|crash|exception|denied|unauthorized|invalid|refused|timeout|stopped|exit code|signal/.test(
      normalized
    )
  ) {
    return 'danger';
  }

  if (/warn|retry|reconnect|paused|throttle|thermal|battery|slow|low memory/.test(normalized)) {
    return 'warning';
  }

  if (/accepted|connected|ready|started|new job|speed|hashrate|cpu affinity/.test(normalized)) {
    return 'success';
  }

  return 'muted';
};

const toLogRows = (lines: string[], prefix: string) =>
  lines.map((line, index) => ({
    id: `${prefix}-${index}-${line}`,
    text: line,
    tone: classifyLogLine(line)
  }));

const latestLogs = computed(() => toLogRows(props.logs.slice(-12).reverse(), 'latest'));
const detailLogs = computed(() => toLogRows(props.logs.slice().reverse(), 'detail'));
const latestLogCountLabel = computed(() =>
  latestLogs.value.length > 0 ? `${latestLogs.value.length} latest` : 'waiting'
);
const telemetrySourceLabel = computed(() =>
  props.apiTelemetry.available ? 'XMRig HTTP API' : 'Log parser'
);

const telemetryEndpointLabel = computed(() =>
  props.apiTelemetry.port > 0 ? `${props.apiTelemetry.host}:${props.apiTelemetry.port}` : 'Inactive'
);
const showingPreparation = computed(
  () => (props.state === 'starting' || props.state === 'mining') && props.stats.hashrate <= 0
);
const preparationTitle = computed(() => {
  if (props.connected) {
    return 'Collecting first speed';
  }

  if (props.state === 'mining') {
    return 'Waiting for pool work';
  }

  return 'Preparing miner';
});
const preparationDetail = computed(() => {
  if (props.connected) {
    return 'Waiting for the first hashrate sample.';
  }

  if (props.state === 'mining') {
    return 'Opening the pool connection and waiting for work.';
  }

  return 'Applying CPU settings and starting XMRig.';
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readNumber = (record: Record<string, unknown> | null, key: string): number | null => {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const firstPositiveNumber = (...values: Array<number | null | undefined>): number | null => {
  const value = values.find(
    (item) => typeof item === 'number' && Number.isFinite(item) && item > 0
  );
  return value ?? null;
};

const formatCompactNumber = (value: number | null): string => {
  if (value === null) {
    return 'Unknown';
  }

  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

const formatCpuUsage = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '-';

const logToneClass = (tone: LogTone): string => {
  const classes: Record<LogTone, string> = {
    danger: 'border-red-400/70 bg-red-500/10 text-red-100',
    warning: 'border-app-yellow/70 bg-app-yellow/10 text-yellow-100',
    success: 'border-app-green/70 bg-app-green-dim text-green-100',
    muted: 'border-white/10 text-app-muted'
  };

  return classes[tone];
};

const cpuHardwareName = computed(() => props.device.cpuName || props.device.model || 'Android CPU');
const cpuClockLabel = computed(() => props.device.cpuClockLabel || '-');
const engineLabel = 'XMRig CPU Miner';

const affinityLabel = computed(() => {
  const labels: Record<MiningConfig['affinity'], string> = {
    auto: 'All cores',
    little: 'Efficiency cores',
    big: 'Performance cores',
    custom: 'Custom affinity'
  };

  return labels[props.config.affinity];
});

const priorityLabel = computed(() => {
  const labels: Record<MiningConfig['priority'], string> = {
    low: 'Low priority',
    normal: 'Normal priority',
    high: 'High priority'
  };

  return labels[props.config.priority];
});

const cpuWorkerLabel = computed(
  () => `${props.config.threadCount}/${props.config.totalDetectedThreads} CPU threads`
);
const cpuTuningLabel = computed(() => `${affinityLabel.value} · ${priorityLabel.value}`);

const apiResults = computed(() => asRecord(props.apiTelemetry.results));
const apiConnection = computed(() => asRecord(props.apiTelemetry.connection));
const currentDifficultyLabel = computed(() =>
  formatCompactNumber(
    firstPositiveNumber(
      readNumber(apiResults.value, 'diff_current'),
      readNumber(apiConnection.value, 'diff'),
      props.stats.difficulty
    )
  )
);
const networkLatencyLabel = computed(() => {
  const ping = firstPositiveNumber(
    readNumber(apiConnection.value, 'ping'),
    props.stats.networkLatencyMs
  );
  return ping === null ? 'Unknown' : `${Math.round(ping)} ms`;
});

const toggleDetails = (): void => {
  detailsOpen.value = !detailsOpen.value;
};

const closeDetails = (): void => {
  detailsOpen.value = false;
};

const enterBrowserFullscreen = async (): Promise<void> => {
  const element = document.documentElement;
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    await element.requestFullscreen();
  }
};

const exitBrowserFullscreen = async (): Promise<void> => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
};

const exitFullscreenMode = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await ImmersiveMode.exit();
    } else {
      await exitBrowserFullscreen();
    }
  } finally {
    fullscreenActive.value = false;
    fullscreenBusy.value = false;
  }
};

const setFullscreen = async (enabled: boolean): Promise<void> => {
  if (fullscreenBusy.value || fullscreenActive.value === enabled) {
    return;
  }

  fullscreenBusy.value = true;

  try {
    if (!enabled) {
      await exitFullscreenMode();
      return;
    }

    if (Capacitor.isNativePlatform()) {
      await ImmersiveMode.enter();
    } else {
      await enterBrowserFullscreen();
    }

    fullscreenActive.value = true;
  } catch {
    fullscreenActive.value = enabled;
  } finally {
    fullscreenBusy.value = false;
  }
};

const toggleFullscreen = (): void => {
  void setFullscreen(!fullscreenActive.value);
};

const syncBrowserFullscreenState = (): void => {
  if (!Capacitor.isNativePlatform()) {
    fullscreenActive.value = Boolean(document.fullscreenElement);
  }
};

const closeProfilePicker = (): void => {
  profilePickerOpen.value = false;
};

const {
  sheetDragStyle: detailsSheetStyle,
  startSheetDrag: startDetailsDrag,
  moveSheetDrag: moveDetailsDrag,
  endSheetDrag: endDetailsDrag
} = useSheetDrag(closeDetails);

const {
  sheetDragStyle: profileSheetStyle,
  startSheetDrag: startProfileDrag,
  moveSheetDrag: moveProfileDrag,
  endSheetDrag: endProfileDrag
} = useSheetDrag(closeProfilePicker);

const showThermalWarning = (): void => {
  warningType.value = 'thermal';
};

const showBatteryWarning = (): void => {
  warningType.value = 'battery';
};

const dismissWarning = (): void => {
  warningType.value = null;
};

const resumeFromWarning = (): void => {
  warningType.value = null;
  emit('resume');
};

const lowerPerformance = (): void => {
  warningType.value = null;
  emit('profile', 'battery_saver');
};

const openProfilePicker = (): void => {
  if (props.stats.temperature >= props.config.thermalThreshold - 5) {
    showThermalWarning();
    return;
  }

  if (props.stats.batteryLevel <= batterySafetyLimit + 5) {
    showBatteryWarning();
    return;
  }

  profilePickerOpen.value = true;
};

const selectProfile = (profile: MiningProfile): void => {
  emit('profile', profile);
  closeProfilePicker();
};

watch(
  () => [props.stats.temperature, props.stats.batteryLevel, props.state] as const,
  ([temperature, batteryLevel, state]) => {
    if (state !== 'mining' || warningType.value) {
      return;
    }

    if (temperature >= props.config.thermalThreshold) {
      warningType.value = 'thermal';
      emit('pause');
      return;
    }

    if (batteryLevel <= batterySafetyLimit) {
      warningType.value = 'battery';
      emit('pause');
    }
  }
);

onMounted(() => {
  document.addEventListener('fullscreenchange', syncBrowserFullscreenState);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncBrowserFullscreenState);
  void exitFullscreenMode();
});

const trendLabel = computed(() => {
  const current = props.stats.hashrate;
  const average = averageHashrate.value;

  if (showingPreparation.value) return 'Preparing';
  if (current <= 0) return 'Idle';
  if (baselineHashrates.value.length < 3) return 'Warming up';
  if (average <= 0) return 'Mining';

  const tolerance = Math.max(1, average * 0.08);

  if (current > average + tolerance) return 'Above average';
  if (current < average - tolerance) return 'Below average';

  return 'Near average';
});

const trendTone = computed(() => {
  if (showingPreparation.value) {
    return 'text-app-yellow';
  }

  if (props.stats.hashrate <= 0 || baselineHashrates.value.length < 3) {
    return 'text-app-muted';
  }

  return trendLabel.value === 'Above average'
    ? 'text-app-green'
    : trendLabel.value === 'Below average'
      ? 'text-yellow-400'
      : 'text-app-muted';
});

const trendIcon = computed(() => {
  if (showingPreparation.value) {
    return '•';
  }

  if (props.stats.hashrate <= 0 || baselineHashrates.value.length < 3) {
    return '•';
  }

  return trendLabel.value === 'Above average'
    ? '↗'
    : trendLabel.value === 'Below average'
      ? '↘'
      : '•';
});
</script>

<template>
  <div class="session-page" :class="{ 'session-page-fullscreen': fullscreenActive }">
    <header class="flex items-center gap-3">
      <div
        class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[22px] font-bold text-white"
        :class="config.coin.logoClass"
      >
        {{ config.coin.logoText }}
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[18px] font-semibold leading-6 text-white">
          {{ config.coin.name }} ({{ config.coin.symbol }})
        </h1>
        <p class="truncate text-[12px] leading-5 text-app-muted">
          {{ config.algorithm }} · {{ poolAddress }}
        </p>
        <StatusIndicator :connected="connected" />
      </div>
      <button
        class="top-icon-button"
        :class="{ 'bg-app-green-dim text-app-green': fullscreenActive }"
        type="button"
        :aria-label="fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'"
        :aria-pressed="fullscreenActive"
        :disabled="fullscreenBusy"
        @click="toggleFullscreen"
      >
        <MaterialIcon :name="fullscreenActive ? 'fullscreen_exit' : 'fullscreen'" :size="23" />
      </button>
    </header>

    <main class="flex flex-1 flex-col justify-center gap-4 py-5">
      <HashrateRing
        v-if="!showingPreparation"
        :value="stats.hashrate"
        :average="averageHashrate"
        :active="state === 'mining' || state === 'starting'"
      />
      <section
        v-else
        class="mx-auto flex w-full max-w-[330px] flex-col items-center px-4 py-2 text-center"
      >
        <div class="relative grid h-[168px] w-[168px] place-items-center">
          <div class="absolute inset-0 rounded-full bg-app-green-dim/30" />
          <div
            class="absolute inset-3 rounded-full border border-app-green/20 border-t-app-green/80 animate-spin"
          />
          <div class="absolute inset-8 rounded-full border border-app-line/70" />
          <div
            class="relative grid h-[94px] w-[94px] place-items-center rounded-full bg-app-card text-app-green shadow-[0_12px_28px_rgb(25_128_88/0.16)]"
          >
            <MaterialIcon name="precision_manufacturing" :size="38" />
          </div>
        </div>

        <p class="mt-2 text-[11px] font-semibold uppercase leading-4 text-app-green">
          Session Startup
        </p>
        <h2 class="mt-1 text-[24px] font-semibold leading-7 text-white">
          {{ preparationTitle }}
        </h2>
        <p class="mt-2 max-w-[260px] text-[13px] leading-[19px] text-app-muted">
          {{ preparationDetail }}
        </p>
      </section>

      <div class="mb-6 text-center">
        <p class="text-[30px] font-semibold tracking-tight text-white">
          {{ uptime }}
        </p>

        <p class="mt-1 text-[12px] text-app-muted">Session uptime</p>

        <!-- subtle inline status -->
        <div
          class="mx-auto mt-4 flex w-fit items-center rounded-full border border-app-line bg-app-elevated/60 px-2 py-2 backdrop-blur"
        >
          <!-- trend -->
          <div class="flex items-center gap-1 rounded-full px-3 py-1" :class="trendTone">
            <span class="text-sm">
              {{ trendIcon }}
            </span>

            <span class="text-[12px] font-medium">
              {{ trendLabel }}
            </span>
          </div>

          <div class="mx-2 h-4 w-px bg-app-line" />

          <!-- avg -->
          <div class="px-3 text-[12px]">
            <span class="text-app-muted">Avg</span>
            <span class="ml-1 font-medium text-white">
              {{ averageHashrate.toFixed(1) }}
            </span>
            <span class="text-app-muted">H/s</span>
          </div>
        </div>
      </div>

      <section class="overflow-hidden rounded-2xl border border-app-line bg-app-card">
        <div class="flex items-center justify-between gap-3 border-b border-app-line px-3 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <MaterialIcon class="shrink-0 text-app-green" name="memory" :size="18" />
            <p class="truncate text-[12px] font-semibold uppercase leading-4 text-app-muted">
              Hardware engine
            </p>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-green-dim px-2.5 py-1 text-[11px] font-semibold leading-4 text-app-green"
          >
            {{ engineLabel }}
          </span>
        </div>

        <div class="divide-y divide-app-line">
          <div class="flex min-w-0 items-center gap-3 px-3 py-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-app-elevated text-app-green"
            >
              <MaterialIcon name="developer_board" :size="21" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <p class="truncate text-[14px] font-semibold leading-5 text-white">
                  {{ cpuHardwareName }}
                </p>
                <span
                  class="shrink-0 rounded-full bg-app-green-dim px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-app-green"
                >
                  CPU
                </span>
              </div>
              <p class="mt-0.5 truncate text-[12px] leading-4 text-app-muted">
                {{ cpuClockLabel }} · {{ cpuWorkerLabel }}
              </p>
              <p class="mt-0.5 truncate text-[11px] leading-4 text-app-muted">
                {{ cpuTuningLabel }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[11px] leading-4 text-app-muted">Load</p>
              <p class="text-[17px] font-semibold leading-6 text-white">
                {{ formatCpuUsage(stats.minerCpuUsage) }}
              </p>
            </div>
          </div>

          <div class="flex min-w-0 items-center gap-3 px-3 py-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-app-elevated"
              :class="thermalTone === 'warning' ? 'text-app-yellow' : 'text-app-green'"
            >
              <MaterialIcon
                :name="stats.isCharging ? 'battery_charging_full' : 'battery_5_bar'"
                :size="21"
              />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <p class="truncate text-[14px] font-semibold leading-5 text-white">Device power</p>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-4"
                  :class="
                    stats.isCharging
                      ? 'bg-app-green-dim text-app-green'
                      : 'bg-app-elevated text-app-muted'
                  "
                >
                  {{ stats.isCharging ? 'Plugged' : 'Battery' }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[12px] leading-4 text-app-muted">
                {{ Math.round(stats.temperature) }} °C ·
                {{ stats.isCharging ? 'Charging' : 'Unplugged' }}
              </p>
              <p class="mt-0.5 truncate text-[11px] leading-4 text-app-muted">
                Thermal limit {{ config.thermalThreshold }} °C
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[11px] leading-4 text-app-muted">Battery</p>
              <p
                class="text-[17px] font-semibold leading-6"
                :class="stats.batteryLevel <= batterySafetyLimit ? 'text-app-yellow' : 'text-white'"
              >
                {{ Math.round(stats.batteryLevel) }}%
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-app-line bg-app-card">
        <div class="flex items-center justify-between gap-3 border-b border-app-line px-3 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <MaterialIcon class="shrink-0 text-app-green" name="task_alt" :size="18" />
            <p class="truncate text-[12px] font-semibold uppercase leading-4 text-app-muted">
              Shares
            </p>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-elevated px-2.5 py-1 text-[11px] font-semibold leading-4 text-app-muted"
          >
            {{ networkLatencyLabel }}
          </span>
        </div>

        <div class="divide-y divide-app-line">
          <div class="flex min-w-0 items-center gap-3 px-3 py-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-app-elevated text-app-green"
            >
              <MaterialIcon name="speed" :size="21" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-semibold leading-5 text-white">Difficulty</p>
              <p class="mt-0.5 truncate text-[12px] leading-4 text-app-muted">
                Current pool share target
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[11px] leading-4 text-app-muted">Diff</p>
              <p class="text-[17px] font-semibold leading-6 text-white">
                {{ currentDifficultyLabel }}
              </p>
            </div>
          </div>

          <div class="flex min-w-0 items-center gap-3 px-3 py-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-app-elevated text-app-green"
            >
              <MaterialIcon name="done_all" :size="21" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-semibold leading-5 text-white">
                Accepted / rejected
              </p>
              <p class="mt-0.5 truncate text-[12px] leading-4 text-app-muted">Pool share results</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[11px] leading-4 text-app-muted">Shares</p>
              <p class="text-[17px] font-semibold leading-6">
                <span class="text-app-green">{{ stats.acceptedShares.toLocaleString() }}</span>
                <span class="px-1.5 text-app-muted">/</span>
                <span class="text-red-400">{{ stats.rejectedShares.toLocaleString() }}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-app-line bg-black/25 p-3">
        <div class="mb-2 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <MaterialIcon name="terminal" :size="18" class="shrink-0 text-app-green" />
            <p class="truncate text-[13px] font-semibold text-white">Miner logs</p>
          </div>
          <span
            class="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-app-muted"
          >
            {{ latestLogCountLabel }}
          </span>
        </div>

        <div
          class="max-h-56 overflow-y-auto overflow-x-auto rounded-xl bg-black/35 p-2 font-mono text-[11px] leading-[17px]"
        >
          <p v-if="latestLogs.length === 0" class="whitespace-pre-wrap break-words text-app-muted">
            {{ backendMessage || 'Waiting for miner output...' }}
          </p>
          <p
            v-for="line in latestLogs"
            :key="line.id"
            class="mb-1 whitespace-pre-wrap break-words rounded border-l-2 px-2 py-1 last:mb-0"
            :class="logToneClass(line.tone)"
          >
            {{ line.text }}
          </p>
        </div>
      </section>
    </main>

    <SessionControls
      :state="state"
      :profile-label="profileLabel"
      @pause="emit('pause')"
      @stop="emit('stop')"
      @profile="openProfilePicker"
    />

    <button
      class="ripple mx-auto mt-4 flex h-12 items-center justify-center gap-1 rounded-full px-5 text-[15px] font-medium text-app-green"
      type="button"
      @click="toggleDetails"
    >
      <MaterialIcon :name="detailsOpen ? 'expand_more' : 'expand_less'" :size="22" />
      Details
    </button>

    <Transition name="fade">
      <div v-if="detailsOpen" class="fixed inset-0 z-40 bg-black/[0.36]" @click="closeDetails" />
    </Transition>
    <Transition name="sheet">
      <section
        v-if="detailsOpen"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82vh] max-w-[420px] overflow-hidden rounded-t-[28px] border border-app-line bg-app-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
        :style="detailsSheetStyle"
      >
        <button
          class="ripple mx-auto mb-3 block h-8 min-h-8 w-24 touch-none rounded-full"
          type="button"
          aria-label="Close details"
          @click="closeDetails"
          @pointerdown="startDetailsDrag"
          @pointermove="moveDetailsDrag"
          @pointerup="endDetailsDrag"
          @pointercancel="endDetailsDrag"
        >
          <span class="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </button>
        <div class="max-h-[calc(82vh-5rem)] overflow-y-auto divide-y divide-app-line">
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Pool</span
            ><strong class="break-all text-right font-medium text-white">{{ poolAddress }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Worker</span
            ><strong class="font-medium text-white">{{ config.workerName }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Difficulty</span
            ><strong class="font-medium text-white">{{ currentDifficultyLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Total hashes</span
            ><strong class="font-medium text-white">{{ totalHashesLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Mining Engine</span
            ><strong class="font-medium text-white">{{ engineLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">CPU hardware</span
            ><strong class="break-words text-right font-medium text-white">{{
              cpuHardwareName
            }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">CPU clock</span
            ><strong class="font-medium text-white">{{ cpuClockLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">CPU workers</span
            ><strong class="font-medium text-white">{{ cpuWorkerLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">CPU tuning</span
            ><strong class="text-right font-medium text-white">{{ cpuTuningLabel }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Miner CPU</span
            ><strong class="font-medium text-white">{{
              formatCpuUsage(stats.minerCpuUsage)
            }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Network latency</span
            ><strong
              class="font-medium"
              :class="apiTelemetry.available ? 'text-app-green' : 'text-app-muted'"
              >{{ networkLatencyLabel }}</strong
            >
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Telemetry</span
            ><strong
              class="break-all text-right font-medium"
              :class="apiTelemetry.available ? 'text-app-green' : 'text-app-muted'"
              >{{ telemetrySourceLabel }} · {{ telemetryEndpointLabel }}</strong
            >
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Battery</span
            ><strong class="font-medium text-white">{{ Math.round(stats.batteryLevel) }}%</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Charging state</span
            ><strong
              class="font-medium"
              :class="stats.isCharging ? 'text-app-green' : 'text-app-muted'"
              >{{ stats.isCharging ? 'Charging' : 'Unplugged' }}</strong
            >
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Thermal status</span
            ><strong
              class="font-medium"
              :class="thermalTone === 'warning' ? 'text-app-yellow' : 'text-app-green'"
              >{{ thermalTone === 'warning' ? 'Warm' : 'Good' }}</strong
            >
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Estimated earnings</span
            ><strong class="font-medium text-white"
              >{{ stats.estimatedEarnings.toFixed(6) }} {{ config.coin.symbol }} / 24h</strong
            >
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Background mode</span
            ><strong class="font-medium text-white">{{
              config.backgroundMining ? 'Enabled' : 'Disabled'
            }}</strong>
          </div>
          <div class="py-3 text-[14px]">
            <div class="mb-2 flex items-center justify-between gap-3">
              <span class="text-app-muted">Miner logs</span>
              <strong class="font-medium text-white">{{ logs.length }} lines</strong>
            </div>
            <div
              class="max-h-[48vh] overflow-y-auto overflow-x-auto rounded-xl bg-black/35 p-2 font-mono text-[11px] leading-[17px]"
            >
              <p
                v-if="detailLogs.length === 0"
                class="whitespace-pre-wrap break-words text-app-muted"
              >
                {{ backendMessage || 'Waiting for miner output...' }}
              </p>
              <p
                v-for="line in detailLogs"
                :key="line.id"
                class="mb-1 whitespace-pre-wrap break-words rounded border-l-2 px-2 py-1 last:mb-0"
                :class="logToneClass(line.tone)"
              >
                {{ line.text }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </Transition>

    <WarningBottomSheet
      :open="warningType !== null"
      :type="warningType || 'thermal'"
      :threshold="warningType === 'battery' ? batterySafetyLimit : config.thermalThreshold"
      @resume="resumeFromWarning"
      @lower-performance="lowerPerformance"
      @ignore="dismissWarning"
      @dismiss="dismissWarning"
    />

    <Transition name="fade">
      <div
        v-if="profilePickerOpen"
        class="fixed inset-0 z-50 bg-black/[0.62]"
        @click="closeProfilePicker"
      />
    </Transition>
    <Transition name="sheet">
      <section
        v-if="profilePickerOpen"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-[28px] border border-app-line bg-app-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3"
        :style="profileSheetStyle"
      >
        <button
          class="ripple mx-auto mb-3 block h-8 min-h-8 w-24 touch-none rounded-full"
          type="button"
          aria-label="Close profile picker"
          @click="closeProfilePicker"
          @pointerdown="startProfileDrag"
          @pointermove="moveProfileDrag"
          @pointerup="endProfileDrag"
          @pointercancel="endProfileDrag"
        >
          <span class="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </button>
        <h2 class="text-[18px] font-semibold leading-6 text-white">Mining profile</h2>
        <div class="mt-4 space-y-2">
          <button
            v-for="preset in profilePresets"
            :key="preset.id"
            class="ripple flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 text-left active:bg-white/5"
            :class="
              config.profile === preset.id
                ? 'border-app-green bg-app-green-dim text-app-green'
                : 'border-app-line bg-app-elevated text-white'
            "
            type="button"
            @click="selectProfile(preset.id)"
          >
            <MaterialIcon
              :name="
                preset.id === 'battery_saver'
                  ? 'battery_saver'
                  : preset.id === 'performance'
                    ? 'speed'
                    : 'tune'
              "
              :size="24"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-semibold leading-5">{{ preset.label }}</span>
              <span class="mt-0.5 block text-[12px] leading-4 text-app-muted">{{
                preset.description
              }}</span>
            </span>
            <MaterialIcon v-if="config.profile === preset.id" name="check" :size="22" />
          </button>
        </div>
      </section>
    </Transition>
  </div>
</template>
