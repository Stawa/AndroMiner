<script setup lang="ts">
import { formatSensor, formatHashrate } from '../utils/miningTelemetry';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import TelemetrySparkline from '../components/TelemetrySparkline.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import SessionControls from '../components/SessionControls.vue';
import StatusIndicator from '../components/StatusIndicator.vue';
import WarningBottomSheet, { type WarningType } from '../components/WarningBottomSheet.vue';
import { profilePresets } from '../composables/useMiningController';
import { useSheetDrag } from '../composables/useSheetDrag';
import { useDialogFocus } from '../composables/useDialogFocus';
import { useSettingsStore } from '../stores/settings';
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
type PendingSessionAction = 'pause' | 'resume' | 'stop' | null;

const props = defineProps<MiningSessionViewProps>();
const settings = useSettingsStore();

const emit = defineEmits<{
  pause: [];
  stop: [];
  profile: [value: MiningProfile];
  resume: [];
  fullscreen: [active: boolean];
}>();

const detailsOpen = ref(false);
const fullscreenActive = ref(false);
const fullscreenBusy = ref(false);
watch(fullscreenActive, (active) => emit('fullscreen', active));
const profilePickerOpen = ref(false);
const warningType = ref<WarningType | null>(null);
const pendingSessionAction = ref<PendingSessionAction>(null);
const actionFailure = ref('');
const ImmersiveMode = registerPlugin<ImmersiveModePlugin>('ImmersiveMode');
const liteSessionMode = computed(() => settings.performance.liteSessionMode);
let pendingSessionActionTimeout = 0;

const averageHashrate = computed(() => props.stats.averageHashrate);
const speedLabel = computed(() =>
  props.stats.sampleState === 'live'
    ? formatHashrate(props.stats.hashrate)
    : props.stats.sampleState === 'stale'
      ? 'Stale'
      : props.stats.sampleState === 'inactive'
        ? 'Stopped'
        : 'Waiting'
);
const minerStateLabel = computed(
  () =>
    ({
      idle: 'Stopped',
      starting: 'Starting',
      mining: 'Running',
      reconnecting: 'Reconnecting',
      pausing: 'Pausing',
      paused: 'Paused',
      stopping: 'Stopping',
      error: 'Error'
    })[props.state]
);
const poolAddress = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const totalHashesLabel = computed(() => {
  const results = asRecord(props.apiTelemetry.results);
  const totalHashes = readNumber(results, 'hashes_total');
  if (totalHashes === null) return 'Unsupported';

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
  props.stats.temperature !== null && props.stats.temperature >= props.config.thermalThreshold - 5
    ? 'warning'
    : 'normal'
);
const batterySafetyLimit = computed(() => settings.batterySafety.stopBelowPercent);
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
  () =>
    ['starting', 'mining', 'reconnecting'].includes(props.state) &&
    props.stats.sampleState !== 'live'
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
    danger: 'border-red-400/70 bg-red-500/10 text-red-700 dark:text-red-100',
    warning: 'border-app-yellow/70 bg-app-yellow/10 text-amber-800 dark:text-yellow-100',
    success: 'border-app-green/70 bg-app-green-dim text-app-green',
    muted: 'border-white/10 text-app-muted'
  };

  return classes[tone];
};

const cpuHardwareName = computed(() => props.device.cpuName || props.device.model || 'Android CPU');
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
const powerDrawLabel = computed(() =>
  typeof props.device.powerDrawW === 'number' && Number.isFinite(props.device.powerDrawW)
    ? `${props.device.powerDrawW.toFixed(2)} W`
    : 'Unavailable'
);
const frequencyMhzLabel = computed(() =>
  typeof props.device.cpuClockGhz === 'number' && Number.isFinite(props.device.cpuClockGhz)
    ? `${Math.round(props.device.cpuClockGhz * 1000).toLocaleString()} MHz`
    : 'Unknown'
);
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

const diagnosticGroups = computed(() => [
  {
    title: 'Connection',
    items: [
      { label: 'Pool', value: poolAddress.value, wide: true },
      { label: 'Worker', value: props.config.workerName },
      { label: 'Network latency', value: networkLatencyLabel.value },
      { label: 'Difficulty', value: currentDifficultyLabel.value },
      {
        label: 'Telemetry',
        value: telemetrySourceLabel.value,
        tone: props.apiTelemetry.available ? 'success' : 'muted'
      },
      { label: 'API endpoint', value: telemetryEndpointLabel.value }
    ]
  },
  {
    title: 'Mining engine',
    items: [
      { label: 'Engine', value: engineLabel },
      { label: 'CPU hardware', value: cpuHardwareName.value },
      { label: 'CPU clock', value: frequencyMhzLabel.value },
      { label: 'CPU workers', value: cpuWorkerLabel.value },
      { label: 'CPU tuning', value: cpuTuningLabel.value },
      { label: 'Miner CPU', value: formatCpuUsage(props.stats.minerCpuUsage) },
      { label: 'Total hashes', value: totalHashesLabel.value }
    ]
  },
  {
    title: 'Device & power',
    items: [
      { label: 'Battery', value: formatSensor(props.stats.batteryLevel, '%') },
      { label: 'Charging state', value: props.stats.isCharging ? 'Charging' : 'Unplugged' },
      { label: 'Temperature', value: formatSensor(props.stats.temperature, ' °C') },
      {
        label: 'Thermal status',
        value:
          props.stats.temperature === null
            ? 'Unavailable'
            : thermalTone.value === 'warning'
              ? 'Near limit'
              : 'Below limit',
        tone:
          props.stats.temperature === null
            ? 'muted'
            : thermalTone.value === 'warning'
              ? 'warning'
              : 'success'
      },
      { label: 'Battery flow (calculated)', value: powerDrawLabel.value }
    ]
  }
]);

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
    fullscreenActive.value = false;
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

const dismissWarning = (): void => {
  warningType.value = null;
};

const resumeFromWarning = (): void => {
  warningType.value = null;
  requestPauseResume();
};

const lowerPerformance = (): void => {
  warningType.value = null;
  emit('profile', 'battery_saver');
};

const openProfilePicker = (): void => {
  profilePickerOpen.value = true;
};

const selectProfile = (profile: MiningProfile): void => {
  emit('profile', profile);
  closeProfilePicker();
};

const clearPendingSessionAction = (): void => {
  if (pendingSessionActionTimeout) {
    window.clearTimeout(pendingSessionActionTimeout);
    pendingSessionActionTimeout = 0;
  }

  pendingSessionAction.value = null;
};

const setPendingSessionAction = (action: Exclude<PendingSessionAction, null>): void => {
  actionFailure.value = '';
  pendingSessionAction.value = action;

  if (pendingSessionActionTimeout) {
    window.clearTimeout(pendingSessionActionTimeout);
  }

  pendingSessionActionTimeout = window.setTimeout(() => {
    clearPendingSessionAction();
  }, 9000);
};

const requestPauseResume = (): void => {
  if (pendingSessionAction.value) {
    return;
  }

  if (props.state === 'paused') {
    setPendingSessionAction('resume');
    emit('resume');
    return;
  }

  setPendingSessionAction('pause');
  emit('pause');
};

const requestStop = (): void => {
  if (pendingSessionAction.value) {
    return;
  }

  setPendingSessionAction('stop');
  closeDetails();
  closeProfilePicker();
  emit('stop');
};

watch(
  () => props.backendMessage,
  (message) => {
    const action = pendingSessionAction.value;
    const failed =
      action === 'pause'
        ? ['mining', 'reconnecting'].includes(props.state)
        : action === 'resume'
          ? props.state === 'paused'
          : action === 'stop' &&
            ['starting', 'mining', 'reconnecting', 'paused'].includes(props.state);
    if (failed) {
      actionFailure.value = message;
      clearPendingSessionAction();
    }
  }
);

watch(
  () => props.state,
  (state) => {
    if (state !== 'paused') return;
    if (/temperature|thermal/i.test(props.backendMessage)) warningType.value = 'thermal';
    else if (/battery|power disconnected/i.test(props.backendMessage))
      warningType.value = 'battery';
  }
);

watch(
  () => props.state,
  (state) => {
    if (
      (pendingSessionAction.value === 'pause' && state === 'paused') ||
      (pendingSessionAction.value === 'resume' && state === 'mining') ||
      (pendingSessionAction.value === 'stop' && state === 'idle') ||
      state === 'error' ||
      state === 'reconnecting'
    ) {
      clearPendingSessionAction();
    }
  }
);

onMounted(() => {
  document.addEventListener('fullscreenchange', syncBrowserFullscreenState);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncBrowserFullscreenState);
  clearPendingSessionAction();
  void exitFullscreenMode();
});
const highestSpeedLabel = computed(() => formatHashrate(props.stats.peakHashrate));
const detailsPanel = ref<HTMLElement | null>(null);
const profilePanel = ref<HTMLElement | null>(null);
useDialogFocus(() => detailsOpen.value, detailsPanel, closeDetails);
useDialogFocus(() => profilePickerOpen.value, profilePanel, closeProfilePicker);
defineExpose({ exitFullscreenMode });
</script>

<template>
  <div
    class="app-page session-page redesign-page"
    :class="{ 'session-page-fullscreen': fullscreenActive }"
  >
    <header class="screen-heading session-heading">
      <div>
        <h1>{{ config.coin.name }}</h1>
        <p>{{ config.algorithm }} · {{ config.threadCount }} CPU threads</p>
      </div>
      <button
        class="outline-button"
        :aria-label="fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'"
        :disabled="fullscreenBusy"
        @click="toggleFullscreen"
      >
        <MaterialIcon :name="fullscreenActive ? 'fullscreen_exit' : 'fullscreen'" :size="22" />
      </button>
    </header>
    <div class="session-layout grid min-w-0 gap-layout content-start md:grid-cols-2 items-start">
      <div class="session-column grid min-w-0 gap-layout content-start">
        <section class="hash-hero">
          <div class="hero-top">
            <span
              >{{ config.coin.symbol }}
              <small>
                / {{ apiTelemetry.available ? '10s average' : 'Reported speed' }}</small
              ></span
            ><span
              class="hero-pill"
              :data-tone="
                state === 'mining' && connected
                  ? 'success'
                  : state === 'error'
                    ? 'error'
                    : 'warning'
              "
              role="status"
              aria-live="polite"
              >{{ minerStateLabel }}</span
            >
          </div>
          <p class="hero-label">Current hashrate</p>
          <div class="hero-number" :class="{ 'hero-number-message': stats.sampleState !== 'live' }">
            {{ speedLabel }}
          </div>
          <p class="hero-caption">
            {{
              stats.sampleState === 'live'
                ? telemetrySourceLabel
                : stats.sampleState === 'stale'
                  ? 'Last sample expired; waiting for a fresh reading'
                  : stats.sampleState === 'inactive'
                    ? 'No active measurement'
                    : preparationDetail
            }}
          </p>
          <TelemetrySparkline v-if="!liteSessionMode" :points="hashrateHistory" />
          <div class="hero-footer">
            <span
              >Average · 60s<strong>{{ formatHashrate(averageHashrate) }}</strong></span
            ><span
              >Peak<strong>{{ highestSpeedLabel }}</strong></span
            ><span
              >Uptime<strong>{{ uptime }}</strong></span
            >
          </div>
        </section>
        <SessionControls
          :state="state"
          :profile-label="profileLabel"
          :pending-action="pendingSessionAction"
          :animations-enabled="settings.performance.animationsEnabled"
          @pause="requestPauseResume"
          @stop="requestStop"
          @profile="openProfilePicker"
        />
        <div
          class="session-protection"
          :data-tone="
            device.temperatureC === null || device.batteryLevel === null ? 'warning' : 'normal'
          "
        >
          <MaterialIcon name="shield" :size="20" />
          <p>
            <strong>{{
              device.temperatureC === null || device.batteryLevel === null
                ? 'Protection readings unavailable'
                : 'Native device protection'
            }}</strong>
            <span
              >{{ device.thermalSource === 'battery' ? 'Battery' : 'Sensor' }}
              {{ formatSensor(device.temperatureC, ' °C') }} · Limit
              {{ config.thermalThreshold }} °C · Battery
              {{ formatSensor(device.batteryLevel, '%') }}</span
            >
          </p>
        </div>
        <div v-if="actionFailure" class="notice notice-error" role="alert">
          <MaterialIcon name="error" :size="20" />
          <div>
            <strong>Action needs attention</strong>
            <p>{{ actionFailure }}</p>
          </div>
        </div>
      </div>
      <div class="session-column grid min-w-0 gap-layout content-start">
        <section class="share-strip">
          <div>
            <span class="status-dot"></span><strong>{{ stats.acceptedShares }}</strong
            ><small>Accepted shares</small>
          </div>
          <div>
            <strong>{{ stats.rejectedShares }}</strong
            ><small>Rejected shares</small>
          </div>
          <div>
            <StatusIndicator
              :connected="connected"
              :label="connected ? 'Connected' : 'Disconnected'"
            /><small>Pool connection</small>
          </div>
        </section>
        <div
          v-if="
            showingPreparation || state === 'paused' || state === 'stopping' || state === 'error'
          "
          class="notice"
        >
          <MaterialIcon name="info" :size="20" />
          <div>
            <strong>{{ showingPreparation ? preparationTitle : minerStateLabel }}</strong>
            <p>{{ backendMessage }}</p>
          </div>
        </div>
        <div class="section-heading">
          <div class="segment">
            <button
              :aria-pressed="!liteSessionMode"
              @click="settings.performance.liteSessionMode = false"
            >
              Full view</button
            ><button
              :aria-pressed="liteSessionMode"
              @click="settings.performance.liteSessionMode = true"
            >
              Lite view
            </button>
          </div>
          <button class="text-button" @click="toggleDetails">
            Diagnostics <MaterialIcon name="chevron_right" :size="18" />
          </button>
        </div>
        <template v-if="!liteSessionMode">
          <section class="device-strip">
            <div :class="{ 'text-app-yellow': thermalTone === 'warning' }">
              <MaterialIcon name="device_thermostat" :size="20" /><strong>{{
                formatSensor(stats.temperature, ' °C')
              }}</strong
              ><small>{{
                device.thermalSource === 'battery' ? 'Battery temp' : 'Temperature'
              }}</small>
            </div>
            <div>
              <MaterialIcon name="battery_5_bar" :size="20" /><strong>{{
                formatSensor(stats.batteryLevel, '%')
              }}</strong
              ><small>{{ stats.isCharging ? 'Charging' : 'Battery' }}</small>
            </div>
            <div>
              <MaterialIcon name="memory" :size="20" /><strong>{{
                formatCpuUsage(stats.minerCpuUsage)
              }}</strong
              ><small>Miner CPU</small>
            </div>
          </section>
          <section class="surface">
            <div class="section-heading">
              <h3>Connection</h3>
              <span class="supporting-label">{{ config.protocol }}</span>
            </div>
            <dl class="definition-list">
              <div>
                <dt>Pool</dt>
                <dd>{{ poolAddress }}</dd>
              </div>
              <div>
                <dt>Worker</dt>
                <dd>{{ config.workerName }}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>{{ networkLatencyLabel }}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{{ currentDifficultyLabel }}</dd>
              </div>
            </dl>
          </section>
          <details class="surface log-disclosure" open>
            <summary>
              <span>Miner output</span><small>{{ latestLogCountLabel }}</small>
            </summary>
            <div class="terminal">
              <p v-if="!latestLogs.length">{{ backendMessage || 'Waiting for output…' }}</p>
              <p v-for="line in latestLogs" :key="line.id" :class="logToneClass(line.tone)">
                {{ line.text }}
              </p>
            </div>
          </details>
        </template>
      </div>
    </div>
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="detailsOpen"
          class="diagnostics-backdrop"
          aria-hidden="true"
          @click="closeDetails"
        />
      </Transition>
      <Transition name="sheet">
        <div v-if="detailsOpen" class="diagnostics-positioner">
          <section
            ref="detailsPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Mining diagnostics"
            tabindex="-1"
            class="diagnostics-sheet"
            :style="detailsSheetStyle"
          >
            <button
              class="sheet-handle diagnostics-handle"
              type="button"
              aria-label="Drag down or tap to close diagnostics"
              @click="closeDetails"
              @pointerdown="startDetailsDrag"
              @pointermove="moveDetailsDrag"
              @pointerup="endDetailsDrag"
              @pointercancel="endDetailsDrag"
            >
              <span />
            </button>
            <header class="diagnostics-heading">
              <div>
                <h2>Diagnostics</h2>
                <p>Live mining and device readings</p>
              </div>
              <button
                type="button"
                class="outline-button diagnostics-close"
                aria-label="Close diagnostics"
                @click="closeDetails"
              >
                <MaterialIcon name="close" :size="22" />
              </button>
            </header>
            <div class="diagnostics-body">
              <section
                v-for="group in diagnosticGroups"
                :key="group.title"
                class="diagnostics-section"
                :aria-label="group.title"
              >
                <h3>{{ group.title }}</h3>
                <dl class="diagnostics-list">
                  <div
                    v-for="item in group.items"
                    :key="item.label"
                    :class="{ 'diagnostics-wide': 'wide' in item && item.wide }"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd :data-tone="'tone' in item ? item.tone : undefined">{{ item.value }}</dd>
                  </div>
                </dl>
              </section>
              <details class="diagnostics-output diagnostics-section">
                <summary>
                  <span>Miner output</span><small>{{ logs.length }} lines</small>
                </summary>
                <div class="terminal" data-swipe-ignore>
                  <p v-if="!detailLogs.length">
                    {{ backendMessage || 'Waiting for miner output...' }}
                  </p>
                  <p v-for="line in detailLogs" :key="line.id" :class="logToneClass(line.tone)">
                    {{ line.text }}
                  </p>
                </div>
              </details>
              <p class="diagnostics-note">Estimated earnings are not available from the miner.</p>
            </div>
            <footer class="diagnostics-footer">
              <button type="button" class="primary-button" @click="closeDetails">Done</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <WarningBottomSheet
      :open="warningType !== null"
      :message="backendMessage"
      :type="warningType || 'thermal'"
      :threshold="warningType === 'battery' ? batterySafetyLimit : config.thermalThreshold"
      @resume="resumeFromWarning"
      @lower-performance="lowerPerformance"
      @ignore="dismissWarning"
      @dismiss="dismissWarning"
    />

    <div v-if="profilePickerOpen" class="modal-backdrop" @click.self="closeProfilePicker">
      <section
        ref="profilePanel"
        class="detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Change CPU profile"
        tabindex="-1"
        :style="profileSheetStyle"
      >
        <button
          class="sheet-handle"
          aria-label="Close profile picker"
          @click="closeProfilePicker"
          @pointerdown="startProfileDrag"
          @pointermove="moveProfileDrag"
          @pointerup="endProfileDrag"
          @pointercancel="endProfileDrag"
        >
          <span />
        </button>
        <div class="section-heading">
          <h3>Change CPU profile</h3>
          <MaterialIcon name="tune" :size="20" />
        </div>
        <p class="section-copy">
          Choose a different CPU allocation. Watch temperature after changing the load.
        </p>
        <button
          v-for="preset in profilePresets"
          :key="preset.id"
          class="profile-option"
          :aria-pressed="config.profile === preset.id"
          @click="selectProfile(preset.id)"
        >
          <MaterialIcon name="memory" :size="21" /><span
            ><strong>{{ preset.label }}</strong
            ><small>{{ preset.description }}</small
            ><small
              >{{ preset.id === 'custom' ? config.customThreadCount : preset.threads }} worker
              threads</small
            ></span
          ><MaterialIcon
            :name="config.profile === preset.id ? 'radio_button_checked' : 'radio_button_unchecked'"
            :size="21"
          />
        </button>
      </section>
    </div>
  </div>
</template>
