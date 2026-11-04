<script setup lang="ts">
import { formatSensor, formatHashrate } from '../utils/miningTelemetry';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import TelemetrySparkline from '../components/TelemetrySparkline.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import SessionControls from '../components/SessionControls.vue';
import WarningBottomSheet, { type WarningType } from '../components/WarningBottomSheet.vue';
import { profilePresets } from '../composables/useMiningController';
import { useSheetDrag } from '../composables/useSheetDrag';
import { useDialogFocus } from '../composables/useDialogFocus';
import { useSettingsStore } from '../stores/settings';
import { formatDate, formatDuration, formatNumber, t } from '../i18n';
import type {
  ProtectionSnapshot,
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
  protection: ProtectionSnapshot | null;
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
      ? t('session.stale')
      : props.stats.sampleState === 'inactive'
        ? t('state.idle')
        : t('session.waiting')
);
const minerStateLabel = computed(() => t(`state.${props.state}`));
const poolAddress = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const totalHashesLabel = computed(() => {
  const results = asRecord(props.apiTelemetry.results);
  const totalHashes = readNumber(results, 'hashes_total');
  if (totalHashes === null) return t('session.unsupported');

  if (totalHashes >= 1_000_000_000) {
    return `${(totalHashes / 1_000_000_000).toFixed(2)}B`;
  }

  if (totalHashes >= 1_000_000) {
    return `${(totalHashes / 1_000_000).toFixed(2)}M`;
  }

  if (totalHashes >= 1_000) {
    return `${(totalHashes / 1_000).toFixed(1)}K`;
  }

  return formatNumber(Math.round(totalHashes));
});
const temperatureLimitOn = computed(() => props.config.thermalThreshold > 0);
const batteryLimitOn = computed(() => settings.batterySafety.stopBelowPercent > 0);
const protectionMissing = computed(
  () =>
    (temperatureLimitOn.value && props.device.temperatureC === null) ||
    (batteryLimitOn.value && props.device.batteryLevel === null)
);
const shareTotal = computed(() => props.stats.acceptedShares + props.stats.rejectedShares);
const acceptancePercent = computed(() =>
  shareTotal.value > 0 ? ((props.stats.acceptedShares / shareTotal.value) * 100).toFixed(1) : '0'
);
const protectionOff = computed(() => !temperatureLimitOn.value && !batteryLimitOn.value);
const thermalTone = computed(() =>
  temperatureLimitOn.value &&
  props.stats.temperature !== null &&
  props.stats.temperature >= props.config.thermalThreshold - 5
    ? 'warning'
    : 'normal'
);
const batterySafetyLimit = computed(() => settings.batterySafety.stopBelowPercent);
const profileLabel = computed(() => t(`profile.${props.config.profile}`));

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

const logTimePattern = /^\[?(?:\d{4}-\d\d-\d\d[ T])?(\d\d:\d\d:\d\d)(?:\.\d+)?\]?\s+(.+)$/;

const toLogRows = (lines: string[], prefix: string) =>
  lines.map((line, index) => {
    const match = logTimePattern.exec(line);
    return {
      id: `${prefix}-${index}-${line}`,
      text: match ? match[2] : line,
      time: match ? match[1] : '',
      tone: classifyLogLine(line)
    };
  });

const latestLogs = computed(() => toLogRows(props.logs.slice(-12).reverse(), 'latest'));
const detailLogs = computed(() => toLogRows(props.logs.slice().reverse(), 'detail'));
const logToneLabel = (tone: LogTone): string =>
  tone === 'danger' ? t('session.logErrors') : tone === 'warning' ? t('session.logWarnings') : '';
const telemetrySourceLabel = computed(() =>
  props.apiTelemetry.available ? 'XMRig HTTP API' : t('session.logParser')
);

const telemetryEndpointLabel = computed(() =>
  props.apiTelemetry.port > 0
    ? `${props.apiTelemetry.host}:${props.apiTelemetry.port}`
    : t('session.inactive')
);
const showingPreparation = computed(
  () =>
    ['starting', 'mining', 'reconnecting'].includes(props.state) &&
    props.stats.sampleState !== 'live'
);
const preparationTitle = computed(() => {
  if (props.connected) {
    return t('session.collecting');
  }

  if (props.state === 'mining') {
    return t('session.waitingWork');
  }

  return t('session.preparing');
});
const preparationDetail = computed(() => {
  if (props.connected) {
    return t('session.collectingDetail');
  }

  if (props.state === 'mining') {
    return t('session.waitingWorkDetail');
  }

  return t('session.preparingDetail');
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
    return t('common.unknown');
  }

  return formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 });
};

const formatCpuUsage = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '-';

const logToneClass = (tone: LogTone): string => {
  const classes: Record<LogTone, string> = {
    danger: 'border-red-400/70 bg-red-500/10 text-red-700 dark:text-red-100',
    warning: 'border-app-yellow/70 bg-app-yellow/10 text-amber-800 dark:text-yellow-100',
    success: 'border-app-green/70 bg-app-green-dim text-app-green-ink',
    muted: 'border-white/10 text-app-muted'
  };

  return classes[tone];
};

const cpuHardwareName = computed(
  () => props.device.cpuName || props.device.model || t('device.androidCpu')
);
const engineLabel = 'XMRig CPU Miner';

const affinityLabel = computed(() => t(`affinity.${props.config.affinity}`));

const priorityLabel = computed(() => t(`priority.${props.config.priority}Label`));

const cpuWorkerLabel = computed(() =>
  t('session.cpuWorkers', {
    count: props.config.threadCount,
    total: props.config.totalDetectedThreads
  })
);
const cpuTuningLabel = computed(() =>
  t('session.cpuTuning', { affinity: affinityLabel.value, priority: priorityLabel.value })
);

const apiResults = computed(() => asRecord(props.apiTelemetry.results));
const apiConnection = computed(() => asRecord(props.apiTelemetry.connection));
const powerDrawLabel = computed(() =>
  typeof props.device.powerDrawW === 'number' && Number.isFinite(props.device.powerDrawW)
    ? `${props.device.powerDrawW.toFixed(2)} W`
    : t('common.unavailable')
);
const frequencyMhzLabel = computed(() =>
  typeof props.device.cpuClockGhz === 'number' && Number.isFinite(props.device.cpuClockGhz)
    ? `${formatNumber(Math.round(props.device.cpuClockGhz * 1000))} MHz`
    : t('common.unknown')
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
  return ping === null ? t('common.unknown') : `${Math.round(ping)} ms`;
});

const toggleDetails = (): void => {
  detailsOpen.value = !detailsOpen.value;
};

const diagnosticGroups = computed(() => [
  {
    title: t('diag.connection'),
    items: [
      { label: t('metric.pool'), value: poolAddress.value, wide: true },
      { label: t('metric.worker'), value: props.config.workerName },
      { label: t('diag.networkLatency'), value: networkLatencyLabel.value },
      { label: t('metric.difficulty'), value: currentDifficultyLabel.value },
      {
        label: t('diag.telemetry'),
        value: telemetrySourceLabel.value,
        tone: props.apiTelemetry.available ? 'success' : 'muted'
      },
      { label: t('diag.apiEndpoint'), value: telemetryEndpointLabel.value }
    ]
  },
  {
    title: t('diag.engine'),
    items: [
      { label: t('diag.engineName'), value: engineLabel },
      { label: t('diag.cpuHardware'), value: cpuHardwareName.value },
      { label: t('diag.cpuClock'), value: frequencyMhzLabel.value },
      { label: t('diag.cpuWorkers'), value: cpuWorkerLabel.value },
      { label: t('diag.cpuTuning'), value: cpuTuningLabel.value },
      { label: t('metric.minerCpu'), value: formatCpuUsage(props.stats.minerCpuUsage) },
      { label: t('diag.totalHashes'), value: totalHashesLabel.value }
    ]
  },
  {
    title: t('diag.devicePower'),
    items: [
      { label: t('metric.battery'), value: formatSensor(props.stats.batteryLevel, '%') },
      {
        label: t('diag.chargingState'),
        value: props.stats.isCharging ? t('metric.charging') : t('diag.unplugged')
      },
      { label: t('metric.temperature'), value: formatSensor(props.stats.temperature, ' °C') },
      {
        label: t('diag.thermalStatus'),
        value:
          props.stats.temperature === null
            ? t('common.unavailable')
            : thermalTone.value === 'warning'
              ? t('diag.nearLimit')
              : t('diag.belowLimit'),
        tone:
          props.stats.temperature === null
            ? 'muted'
            : thermalTone.value === 'warning'
              ? 'warning'
              : 'success'
      },
      { label: t('diag.batteryFlow'), value: powerDrawLabel.value }
    ]
  },
  {
    title: t('protection.title'),
    items: props.protection
      ? [
          { label: t('protection.title'), value: t(`protection.state.${props.protection.state}`) },
          {
            label: t('protection.configured'),
            value: `${Math.round(props.protection.configuredIntensity)}%`
          },
          {
            label: t('protection.current'),
            value: `${Math.round(props.protection.targetIntensity)}%`
          },
          {
            label: t('protection.measured'),
            value: `${Math.round(props.protection.measuredIntensity)}%`
          }
        ]
      : [{ label: t('protection.title'), value: t('common.unavailable') }]
  }
]);

const barPercent = (value: number | null | undefined, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) && max > 0
    ? Math.min(100, Math.max(0, (value / max) * 100))
    : 0;

const vitals = computed(() => {
  const floor = settings.batterySafety.stopBelowPercent;
  const battery = props.stats.batteryLevel;
  return [
    {
      id: 'temperature',
      icon: 'device_thermostat',
      label:
        props.device.thermalSource === 'battery'
          ? t('metric.batteryTemp')
          : t('metric.temperature'),
      value: formatSensor(props.stats.temperature, ' °C'),
      percent: barPercent(
        props.stats.temperature,
        temperatureLimitOn.value ? props.config.thermalThreshold : 85
      ),
      tone: thermalTone.value === 'warning' ? 'warning' : 'normal'
    },
    {
      id: 'battery',
      icon: props.stats.isCharging ? 'battery_charging_full' : 'battery_5_bar',
      label: props.stats.isCharging ? t('metric.charging') : t('metric.battery'),
      value: formatSensor(battery, '%'),
      percent: barPercent(battery, 100),
      tone: floor > 0 && battery !== null && battery <= floor + 10 ? 'warning' : 'normal'
    },
    {
      id: 'cpu',
      icon: 'memory',
      label: t('metric.minerCpu'),
      value: formatCpuUsage(props.stats.minerCpuUsage),
      percent: barPercent(props.stats.minerCpuUsage, 100),
      tone: 'normal'
    }
  ];
});

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
const remainingLabel = computed(() =>
  props.stats.remainingSeconds === null ? '' : formatDuration(props.stats.remainingSeconds)
);
</script>

<template>
  <div class="app-page session-page" :class="{ 'session-page-fullscreen': fullscreenActive }">
    <header class="screen-heading session-heading">
      <div>
        <h1>{{ config.coin.name }}</h1>
        <p>
          {{
            $t('session.threadsLine', { algorithm: config.algorithm, threads: config.threadCount })
          }}
        </p>
      </div>
      <button
        class="outline-button"
        :aria-label="
          fullscreenActive ? $t('session.exitFullscreen') : $t('session.enterFullscreen')
        "
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
                / {{ apiTelemetry.available ? $t('session.avg10') : $t('session.reported') }}</small
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
          <p class="hero-label">{{ $t('dashboard.currentHashrate') }}</p>
          <div class="hero-number" :class="{ 'hero-number-message': stats.sampleState !== 'live' }">
            {{ speedLabel }}
          </div>
          <p class="hero-caption">
            {{
              stats.sampleState === 'live'
                ? telemetrySourceLabel
                : stats.sampleState === 'stale'
                  ? $t('session.staleCaption')
                  : stats.sampleState === 'inactive'
                    ? $t('session.noMeasurement')
                    : preparationDetail
            }}
          </p>
          <TelemetrySparkline v-if="!liteSessionMode" :points="hashrateHistory" />
          <div class="hero-footer">
            <span
              >{{ $t('session.avg60') }}<strong>{{ formatHashrate(averageHashrate) }}</strong></span
            ><span
              >{{ $t('session.peak') }}<strong>{{ highestSpeedLabel }}</strong></span
            ><span
              >{{ $t('session.uptime') }}<strong>{{ uptime }}</strong
              ><small v-if="remainingLabel">{{
                $t('session.remaining', {
                  remaining: remainingLabel,
                  time: stats.deadlineAt
                    ? formatDate(stats.deadlineAt, { timeStyle: 'medium' })
                    : '—'
                })
              }}</small></span
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
        <section
          class="protect-card"
          :data-tone="protectionMissing ? 'warning' : protectionOff ? 'off' : 'normal'"
        >
          <header>
            <span class="protect-badge"><MaterialIcon name="shield" :size="22" filled /></span>
            <strong>{{
              protectionMissing
                ? $t('session.protectionMissing')
                : protectionOff
                  ? $t('session.protectionOff')
                  : $t('session.protectionActive')
            }}</strong>
            <span class="protect-source">{{
              device.thermalSource === 'battery'
                ? $t('session.sourceBattery')
                : $t('session.sourceSensor')
            }}</span>
          </header>
          <dl>
            <div :data-off="!temperatureLimitOn">
              <dt>
                <MaterialIcon name="device_thermostat" :size="18" />{{ $t('config.tempLimit') }}
              </dt>
              <dd>
                {{ temperatureLimitOn ? `${config.thermalThreshold} °C` : $t('config.limitOff') }}
              </dd>
            </div>
            <div :data-off="!batteryLimitOn">
              <dt>
                <MaterialIcon name="battery_alert" :size="18" />{{ $t('settings.pauseBelowLabel') }}
              </dt>
              <dd>{{ batteryLimitOn ? `${batterySafetyLimit}%` : $t('config.limitOff') }}</dd>
            </div>
          </dl>
        </section>
        <div v-if="actionFailure" class="notice notice-error" role="alert">
          <MaterialIcon name="error" :size="20" />
          <div>
            <strong>{{ $t('session.actionAttention') }}</strong>
            <p>{{ actionFailure }}</p>
          </div>
        </div>
      </div>
      <div class="session-column grid min-w-0 gap-layout content-start">
        <section class="share-card" :aria-label="$t('session.shares')">
          <header>
            <h3>{{ $t('session.shares') }}</h3>
            <span v-if="shareTotal > 0" class="share-rate">{{
              $t('history.acceptance', { percent: acceptancePercent })
            }}</span>
          </header>
          <div class="share-figures">
            <div>
              <strong>{{ formatNumber(stats.acceptedShares) }}</strong>
              <small
                ><i class="share-key" data-tone="good" />{{ $t('session.acceptedShares') }}</small
              >
            </div>
            <div :data-bad="stats.rejectedShares > 0">
              <strong>{{ formatNumber(stats.rejectedShares) }}</strong>
              <small
                ><i class="share-key" data-tone="bad" />{{ $t('session.rejectedShares') }}</small
              >
            </div>
          </div>
          <div class="share-bar" aria-hidden="true">
            <i class="share-bar-ok" :style="{ flexGrow: stats.acceptedShares }" />
            <i class="share-bar-bad" :style="{ flexGrow: stats.rejectedShares }" />
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
              {{ $t('session.fullView') }}</button
            ><button
              :aria-pressed="liteSessionMode"
              @click="settings.performance.liteSessionMode = true"
            >
              {{ $t('session.liteView') }}
            </button>
          </div>
          <button class="text-button" @click="toggleDetails">
            {{ $t('session.diagnostics') }} <MaterialIcon name="chevron_right" :size="18" />
          </button>
        </div>
        <template v-if="!liteSessionMode">
          <section class="vitals">
            <div v-for="item in vitals" :key="item.id" class="vital" :data-tone="item.tone">
              <span class="vital-label"
                ><MaterialIcon :name="item.icon" :size="18" />{{ item.label }}</span
              >
              <strong>{{ item.value }}</strong>
              <span class="vital-bar" aria-hidden="true"
                ><i :style="{ width: `${item.percent}%` }"
              /></span>
            </div>
          </section>
          <section class="surface">
            <div class="section-heading">
              <h3>{{ $t('session.connection') }}</h3>
              <span class="supporting-label">{{ config.protocol }}</span>
            </div>
            <dl class="definition-list">
              <div>
                <dt>{{ $t('metric.pool') }}</dt>
                <dd>{{ poolAddress }}</dd>
              </div>
              <div>
                <dt>{{ $t('metric.worker') }}</dt>
                <dd>{{ config.workerName }}</dd>
              </div>
              <div>
                <dt>{{ $t('metric.latency') }}</dt>
                <dd>{{ networkLatencyLabel }}</dd>
              </div>
              <div>
                <dt>{{ $t('metric.difficulty') }}</dt>
                <dd>{{ currentDifficultyLabel }}</dd>
              </div>
            </dl>
          </section>
          <section class="out-card" :aria-label="$t('session.minerOutput')">
            <header>
              <h3>{{ $t('session.minerOutput') }}</h3>
              <button type="button" class="text-button" @click="toggleDetails">
                {{ $t('session.viewAll') }}
              </button>
            </header>
            <ol class="out-list" role="log" aria-live="off">
              <li v-if="!latestLogs.length" class="out-empty">
                {{ backendMessage || $t('session.waitingOutput') }}
              </li>
              <li v-for="line in latestLogs" :key="line.id" :data-tone="line.tone">
                <span v-if="logToneLabel(line.tone)" class="sr-only">{{
                  logToneLabel(line.tone)
                }}</span>
                <time v-if="line.time">{{ line.time }}</time>
                <span class="out-text">{{ line.text }}</span>
              </li>
            </ol>
          </section>
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
            :aria-label="$t('session.diagnosticsLabel')"
            tabindex="-1"
            class="diagnostics-sheet"
            :style="detailsSheetStyle"
          >
            <button
              class="sheet-handle diagnostics-handle"
              type="button"
              :aria-label="$t('session.closeSheetDrag')"
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
                <h2>{{ $t('session.diagnostics') }}</h2>
                <p>{{ $t('session.diagnosticsSub') }}</p>
              </div>
              <button
                type="button"
                class="outline-button diagnostics-close"
                :aria-label="$t('session.closeDiagnostics')"
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
                  <span>{{ $t('session.minerOutput') }}</span
                  ><small>{{ $t('session.linesCount', { count: logs.length }) }}</small>
                </summary>
                <div class="terminal" data-swipe-ignore>
                  <p v-if="!detailLogs.length">
                    {{ backendMessage || $t('session.waitingMinerOutput') }}
                  </p>
                  <p v-for="line in detailLogs" :key="line.id" :class="logToneClass(line.tone)">
                    {{ line.text }}
                  </p>
                </div>
              </details>
              <p class="diagnostics-note">{{ $t('session.noEarnings') }}</p>
            </div>
            <footer class="diagnostics-footer">
              <button type="button" class="primary-button" @click="closeDetails">
                {{ $t('session.done') }}
              </button>
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
        :aria-label="$t('session.changeProfile')"
        tabindex="-1"
        :style="profileSheetStyle"
      >
        <button
          class="sheet-handle"
          :aria-label="$t('session.closeProfile')"
          @click="closeProfilePicker"
          @pointerdown="startProfileDrag"
          @pointermove="moveProfileDrag"
          @pointerup="endProfileDrag"
          @pointercancel="endProfileDrag"
        >
          <span />
        </button>
        <div class="section-heading">
          <h3>{{ $t('session.changeProfile') }}</h3>
          <MaterialIcon name="tune" :size="20" />
        </div>
        <p class="section-copy">
          {{ $t('session.profileCopy') }}
        </p>
        <button
          v-for="preset in profilePresets"
          :key="preset.id"
          class="profile-option"
          :aria-pressed="config.profile === preset.id"
          @click="selectProfile(preset.id)"
        >
          <MaterialIcon name="memory" :size="21" /><span
            ><strong>{{ $t(`profile.${preset.id}`) }}</strong
            ><small>{{ $t(`profile.hint.${preset.id}`) }}</small
            ><small>{{
              $t('session.workerThreads', {
                count: preset.id === 'custom' ? config.customThreadCount : preset.threads
              })
            }}</small></span
          ><MaterialIcon
            :name="config.profile === preset.id ? 'radio_button_checked' : 'radio_button_unchecked'"
            :size="21"
          />
        </button>
      </section>
    </div>
  </div>
</template>
