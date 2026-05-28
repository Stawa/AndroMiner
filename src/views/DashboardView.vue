<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import StatusIndicator from '../components/StatusIndicator.vue';
import { useSheetDrag } from '../composables/useSheetDrag';
import type {
  DeviceTelemetry,
  MiningConfig,
  MiningSessionHistoryItem,
  SavedMiningProfile
} from '../types/mining';
import type { MinerBackendState } from '../composables/useMiningController';

interface DashboardViewProps {
  config: MiningConfig;
  device: DeviceTelemetry;
  connected: boolean;
  backendState: MinerBackendState;
  backendMessage: string;
  logs: string[];
  sessionHistory: MiningSessionHistoryItem[];
  activeProfile?: SavedMiningProfile;
}

const props = defineProps<DashboardViewProps>();

const emit = defineEmits<{
  start: [];
  configure: [];
  statistics: [];
  profiles: [];
  deleteSession: [id: string];
  clearSessions: [];
}>();

const selectedSessionId = ref<string | null>(null);

const poolAddress = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const walletPreview = computed(() =>
  props.config.walletAddress.length > 10
    ? `${props.config.walletAddress.slice(0, 6)}...${props.config.walletAddress.slice(-5)}`
    : props.config.walletAddress
);
const profileName = computed(() => props.activeProfile?.name || 'Unsaved setup');
const canStart = computed(
  () =>
    props.backendState === 'ready' ||
    props.backendState === 'missing' ||
    props.backendState === 'error'
);
const primaryActionLabel = computed(() =>
  props.backendState === 'missing'
    ? 'Download Miner'
    : props.backendState === 'error'
      ? 'Start Again'
      : 'Start Mining'
);
const hasPlaceholderWallet = computed(() =>
  /^YOUR_[A-Z0-9]+_WALLET_ADDRESS$/.test(props.config.walletAddress)
);
const walletReady = computed(
  () => props.config.walletAddress.trim().length > 12 && !hasPlaceholderWallet.value
);
const connectionStatus = computed(() => {
  if (props.connected) {
    return { label: 'Pool connected', tone: 'good' as const };
  }

  const labels: Record<
    MinerBackendState,
    { label: string; tone: 'good' | 'warning' | 'danger' | 'muted' }
  > = {
    checking: { label: 'Checking backend', tone: 'warning' },
    ready: { label: 'Ready to mine', tone: 'good' },
    missing: { label: 'Download required', tone: 'warning' },
    downloading: { label: 'Downloading miner', tone: 'warning' },
    'web-unavailable': { label: 'Android required', tone: 'warning' },
    error: { label: 'Miner stopped', tone: 'danger' }
  };

  return labels[props.backendState];
});

const statusIcon = computed(() => {
  const icons: Record<'good' | 'warning' | 'danger' | 'muted', string> = {
    good: 'check_circle',
    warning: 'info',
    danger: 'error',
    muted: 'radio_button_unchecked'
  };

  return icons[connectionStatus.value.tone];
});

const connectionDetail = computed(() => {
  if (props.connected) {
    return `${props.config.workerName} · ${props.config.protocol}`;
  }

  if (props.backendState === 'error') {
    return 'Last error captured';
  }

  if (props.backendState === 'web-unavailable') {
    return 'Use Android app for real mining';
  }

  return props.backendMessage;
});
const errorMessage = computed(
  () => props.backendMessage || 'Native miner stopped unexpectedly. Check the latest miner logs.'
);
const errorText = computed(() => `${errorMessage.value}\n${props.logs.join('\n')}`);
const hasTasksetMaskError = computed(() => /taskset|tasket|bad mask/i.test(errorText.value));
const errorExitCode = computed(() => {
  const match = errorMessage.value.match(/(?:code|Exit code:)\s*([0-9]+)/i);
  return match?.[1] || '';
});
const errorLastOutput = computed(() => {
  const match = errorMessage.value.match(/Last output:\s*(.+)$/i);
  return match?.[1]?.trim() || errorMessage.value;
});
const errorTitle = computed(() =>
  hasTasksetMaskError.value ? 'CPU affinity failed' : 'Miner could not start'
);
const errorAdvice = computed(() =>
  hasTasksetMaskError.value
    ? 'Performance-core pinning hit Android taskset mask handling. This build now falls back to normal scheduling if taskset rejects the mask; use All cores if this repeats.'
    : 'Check the last output below, then adjust the pool, wallet, protocol, or CPU settings before starting again.'
);
const crashLogs = computed(() => props.logs.slice(-8).reverse());

const deviceReady = computed(
  () =>
    (props.device.isCharging || props.device.batteryLevel > 35) &&
    props.device.thermalStatus !== 'hot'
);
const setupReady = computed(() => walletReady.value && canStart.value && deviceReady.value);
const launchTitle = computed(() => {
  if (!walletReady.value) {
    return 'Wallet needed';
  }

  if (props.backendState === 'web-unavailable') {
    return 'Android required';
  }

  if (props.backendState === 'missing') {
    return 'Miner download ready';
  }

  if (props.backendState === 'downloading') {
    return 'Downloading miner';
  }

  if (props.connected) {
    return 'Pool connected';
  }

  if (props.backendState === 'ready') {
    return 'Ready to start';
  }

  if (props.backendState === 'error') {
    return 'Needs attention';
  }

  return 'Checking setup';
});
const launchTone = computed<'good' | 'warning' | 'danger' | 'muted'>(() => {
  if (props.backendState === 'error') {
    return 'danger';
  }

  if (
    !walletReady.value ||
    props.backendState === 'web-unavailable' ||
    props.backendState === 'missing'
  ) {
    return 'warning';
  }

  if (setupReady.value || props.connected) {
    return 'good';
  }

  return 'muted';
});
const launchIcon = computed(() => {
  const icons: Record<'good' | 'warning' | 'danger' | 'muted', string> = {
    good: 'rocket_launch',
    warning: 'priority_high',
    danger: 'error',
    muted: 'hourglass_empty'
  };

  return icons[launchTone.value];
});
const launchDetail = computed(() => {
  if (!walletReady.value) {
    return 'Add a wallet address before a real run';
  }

  if (props.backendState === 'web-unavailable') {
    return 'Open the Android app to mine';
  }

  if (props.backendState === 'missing') {
    return 'Download XMRig binary on first start';
  }

  return `${props.config.coin.name} · ${props.config.threadCount}/${props.config.totalDetectedThreads} CPU threads`;
});

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.max(1, seconds)}s`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const formatRelativeDate = (isoDate: string): string => {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return 'Just now';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? 'Yesterday' : `${elapsedDays} days ago`;
};

const formatDateTime = (isoDate: string): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));

const readinessItems = computed(() => [
  {
    label: 'Power',
    value: props.device.isCharging ? 'Charging' : 'Battery',
    icon: props.device.isCharging ? 'battery_charging_full' : 'battery_5_bar',
    good: props.device.isCharging || props.device.batteryLevel > 35
  },
  {
    label: 'Thermal',
    value:
      props.device.temperatureC === null
        ? props.device.thermalStatus
        : `${Math.round(props.device.temperatureC)} °C`,
    icon: 'device_thermostat',
    good: props.device.thermalStatus !== 'hot'
  }
]);

const setupChecks = computed(() => [
  {
    label: 'Pool',
    value: poolAddress.value,
    icon: 'hub',
    good: canStart.value || props.connected
  },
  {
    label: 'Wallet',
    value: walletReady.value ? walletPreview.value : 'Not set',
    icon: 'account_balance_wallet',
    good: walletReady.value
  },
  {
    label: 'Device',
    value: deviceReady.value ? 'Ready' : 'Check power or heat',
    icon: 'smartphone',
    good: deviceReady.value
  }
]);

const recentSessions = computed(() =>
  props.sessionHistory.slice(0, 5).map((session) => ({
    ...session,
    duration: formatDuration(session.durationSeconds),
    endedLabel: formatRelativeDate(session.endedAt)
  }))
);

const selectedSession = computed(() =>
  props.sessionHistory.find((session) => session.id === selectedSessionId.value)
);

const reviewSession = (id: string): void => {
  selectedSessionId.value = id;
};

const closeSessionReview = (): void => {
  selectedSessionId.value = null;
};

const {
  sheetDragStyle: sessionSheetDragStyle,
  startSheetDrag: startSessionSheetDrag,
  moveSheetDrag: moveSessionSheetDrag,
  endSheetDrag: endSessionSheetDrag
} = useSheetDrag(closeSessionReview);

const deleteSelectedSession = (id: string): void => {
  const confirmed = window.confirm('Delete this completed mining session from history?');
  if (!confirmed) {
    return;
  }

  emit('deleteSession', id);
  if (selectedSessionId.value === id) {
    closeSessionReview();
  }
};

const clearSessionHistory = (): void => {
  const confirmed = window.confirm('Clear all completed mining sessions from history?');
  if (!confirmed) {
    return;
  }

  emit('clearSessions');
};
</script>

<template>
  <div class="phone-page">
    <section class="app-card overflow-hidden">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <button
            class="ripple grid h-14 w-14 shrink-0 place-items-center rounded-lg text-[24px] font-bold text-white shadow-sm"
            :class="config.coin.logoClass"
            type="button"
            aria-label="Edit mining setup"
            @click="emit('configure')"
          >
            {{ config.coin.logoText }}
          </button>
          <button class="ripple min-w-0 flex-1 text-left" type="button" @click="emit('configure')">
            <p class="truncate text-[12px] font-semibold uppercase leading-4 text-app-green">
              Active Setup
            </p>
            <h2 class="mt-1 truncate text-[22px] font-semibold leading-7 text-white">
              {{ profileName }}
            </h2>
            <p class="truncate text-[13px] leading-5 text-app-muted">
              {{ config.coin.name }} · {{ config.algorithm }}
            </p>
          </button>
          <button
            class="ripple grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-muted active:bg-app-elevated"
            type="button"
            aria-label="Open profiles"
            @click="emit('profiles')"
          >
            <MaterialIcon name="folder_managed" :size="22" />
          </button>
        </div>

        <div class="mt-4 rounded-lg bg-app-elevated p-4">
          <div class="flex items-start gap-3">
            <div
              class="grid h-12 w-12 shrink-0 place-items-center rounded-full"
              :class="{
                'bg-app-green-dim text-app-green': launchTone === 'good',
                'bg-app-yellow/15 text-app-yellow': launchTone === 'warning',
                'bg-red-500/15 text-red-300': launchTone === 'danger',
                'bg-app-card text-app-muted': launchTone === 'muted'
              }"
            >
              <MaterialIcon :name="launchIcon" :size="25" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[12px] font-semibold uppercase leading-4 text-app-muted">
                Launch Status
              </p>
              <h3 class="mt-1 text-[20px] font-semibold leading-6 text-white">
                {{ launchTitle }}
              </h3>
              <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
                {{ launchDetail }}
              </p>
            </div>
          </div>

          <div class="mt-4 rounded-lg border border-app-line/70 bg-app-card px-3 py-3">
            <div class="flex min-w-0 items-start gap-3">
              <div
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                :class="{
                  'bg-app-green-dim text-app-green': connectionStatus.tone === 'good',
                  'bg-app-yellow/15 text-app-yellow': connectionStatus.tone === 'warning',
                  'bg-red-500/15 text-red-300': connectionStatus.tone === 'danger',
                  'bg-app-elevated text-app-muted': connectionStatus.tone === 'muted'
                }"
              >
                <MaterialIcon :name="statusIcon" :size="20" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusIndicator
                    class="min-w-0"
                    :connected="connected"
                    :label="connectionStatus.label"
                    :tone="connectionStatus.tone"
                  />
                  <span
                    class="rounded-full bg-app-elevated px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-app-muted"
                  >
                    {{ connected ? 'Live pool' : 'Backend' }}
                  </span>
                </div>
                <p
                  class="mt-1 whitespace-normal break-words text-[12px] leading-[18px] text-app-muted"
                >
                  {{ connectionDetail }}
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="backendState === 'error'"
            class="mt-4 overflow-hidden rounded-xl border border-red-200 bg-red-50 text-red-950 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-50"
          >
            <div class="p-3">
              <div class="flex items-start gap-3">
                <span
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300"
                >
                  <MaterialIcon name="report" :size="21" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p
                      class="text-[13px] font-semibold uppercase leading-4 text-red-700 dark:text-red-200"
                    >
                      Last failure
                    </p>
                    <span
                      v-if="errorExitCode"
                      class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-100"
                    >
                      Exit {{ errorExitCode }}
                    </span>
                  </div>
                  <h3 class="mt-1 text-[18px] font-semibold leading-6">
                    {{ errorTitle }}
                  </h3>
                  <p
                    class="mt-1 whitespace-pre-wrap break-words text-[12px] leading-[18px] text-red-800 dark:text-red-100/85"
                  >
                    {{ errorLastOutput }}
                  </p>
                </div>
              </div>

              <div
                class="mt-3 flex items-start gap-2 rounded-lg bg-white/65 p-2.5 text-[12px] leading-[18px] text-red-800 dark:bg-black/20 dark:text-red-100/80"
              >
                <MaterialIcon class="mt-0.5 shrink-0" name="tips_and_updates" :size="17" />
                <p class="min-w-0 break-words">{{ errorAdvice }}</p>
              </div>

              <button
                class="ripple mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-3 text-[13px] font-semibold text-white active:bg-red-700 dark:bg-red-500/85"
                type="button"
                @click="emit('configure')"
              >
                <MaterialIcon name="tune" :size="18" />
                Open CPU Settings
              </button>
            </div>

            <div v-if="crashLogs.length > 0" class="border-t border-red-200 dark:border-red-400/20">
              <div
                class="flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold uppercase text-red-700 dark:text-red-200"
              >
                <span>Recent output</span>
                <span>{{ crashLogs.length }} lines</span>
              </div>
              <div
                class="max-h-40 overflow-y-auto overflow-x-auto bg-black/80 px-3 py-2 font-mono text-[11px] leading-4 dark:bg-black/35"
              >
                <p
                  v-for="(line, index) in crashLogs"
                  :key="`crash-${index}-${line}`"
                  class="whitespace-pre-wrap break-words border-b border-white/5 py-1 text-red-100/85 last:border-b-0"
                >
                  {{ line }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <div
            v-for="item in readinessItems"
            :key="item.label"
            class="min-w-0 rounded-lg bg-app-elevated p-2.5 text-left"
          >
            <div class="flex items-center gap-2">
              <div
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                :class="
                  item.good ? 'bg-app-green-dim text-app-green' : 'bg-app-yellow/15 text-app-yellow'
                "
              >
                <MaterialIcon :name="item.icon" :size="18" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-[11px] leading-4 text-app-muted">{{ item.label }}</p>
                <p class="truncate text-[12px] font-semibold leading-4 text-white">
                  {{ item.value }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 overflow-hidden rounded-lg border border-app-line bg-app-elevated/60">
          <div
            v-for="check in setupChecks"
            :key="check.label"
            class="flex min-h-[54px] items-center gap-3 border-t border-app-line px-3 first:border-t-0"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              :class="
                check.good ? 'bg-app-green-dim text-app-green' : 'bg-app-yellow/15 text-app-yellow'
              "
            >
              <MaterialIcon :name="check.icon" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[12px] font-medium leading-4 text-white">
                {{ check.label }}
              </span>
              <span class="block truncate text-[11px] leading-4 text-app-muted">
                {{ check.value }}
              </span>
            </span>
            <MaterialIcon
              class="shrink-0"
              :class="check.good ? 'text-app-green' : 'text-app-yellow'"
              :name="check.good ? 'check_circle' : 'info'"
              :size="19"
            />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-[1fr_52px] gap-2">
          <button
            class="ripple flex h-14 items-center justify-center gap-2 rounded-full bg-app-green text-[16px] font-semibold text-white shadow-[0_8px_18px_rgb(25_128_88/0.22)] disabled:opacity-45"
            type="button"
            :disabled="!canStart"
            @click="emit('start')"
          >
            <MaterialIcon name="play_arrow" :size="24" filled />
            {{ primaryActionLabel }}
          </button>
          <button
            class="ripple grid h-14 place-items-center rounded-full border border-app-line bg-app-elevated text-app-on"
            type="button"
            aria-label="Edit mining setup"
            @click="emit('configure')"
          >
            <MaterialIcon name="tune" :size="23" />
          </button>
        </div>
      </div>
    </section>

    <section class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center justify-between gap-3 px-4">
        <div class="min-w-0">
          <h2 class="text-[15px] font-semibold text-white">Recent sessions</h2>
          <p class="mt-0.5 text-[12px] text-app-muted">
            {{ recentSessions.length }} saved run{{ recentSessions.length === 1 ? '' : 's' }}
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="recentSessions.length > 0"
            class="ripple grid h-11 w-11 place-items-center rounded-full text-app-muted active:bg-app-elevated"
            type="button"
            aria-label="Clear session history"
            @click="clearSessionHistory"
          >
            <MaterialIcon name="delete_sweep" :size="22" />
          </button>
          <button
            class="ripple min-h-11 rounded-full px-3 text-[13px] font-medium text-app-green active:bg-app-green-dim"
            type="button"
            @click="emit('statistics')"
          >
            View
          </button>
        </div>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="session in recentSessions"
          :key="session.id"
          class="flex min-h-[76px] w-full items-center gap-2 px-3 py-2"
        >
          <button
            class="ripple flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left active:bg-app-elevated"
            type="button"
            @click="reviewSession(session.id)"
          >
            <div
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
              :class="session.coinLogoClass"
            >
              {{ session.coinLogoText }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-medium text-white">{{ session.title }}</p>
              <p class="truncate text-[12px] text-app-muted">
                {{ session.subtitle }} · {{ session.endedLabel }}
              </p>
            </div>
            <div class="rounded-lg bg-app-elevated px-2 py-1 text-right">
              <p class="truncate text-[13px] font-semibold text-white">{{ session.duration }}</p>
            </div>
          </button>
          <button
            class="ripple grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-muted active:bg-app-elevated"
            type="button"
            aria-label="Delete session"
            @click="deleteSelectedSession(session.id)"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <div v-if="recentSessions.length === 0" class="px-4 py-6 text-[13px] text-app-muted">
          No completed sessions yet.
        </div>
      </div>
    </section>

    <Transition name="fade">
      <div
        v-if="selectedSession"
        class="fixed inset-0 z-50 bg-black/[0.62]"
        @click="closeSessionReview"
      />
    </Transition>
    <Transition name="sheet">
      <section
        v-if="selectedSession"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-[28px] border border-app-line bg-app-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3"
        :style="sessionSheetDragStyle"
      >
        <button
          class="ripple mx-auto mb-3 block h-8 min-h-8 w-24 touch-none rounded-full"
          type="button"
          aria-label="Close session review"
          @click="closeSessionReview"
          @pointerdown="startSessionSheetDrag"
          @pointermove="moveSessionSheetDrag"
          @pointerup="endSessionSheetDrag"
          @pointercancel="endSessionSheetDrag"
        >
          <span class="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </button>

        <div class="flex items-center gap-3">
          <div
            class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px] font-bold text-white"
            :class="selectedSession.coinLogoClass"
          >
            {{ selectedSession.coinLogoText }}
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-[18px] font-semibold leading-6 text-white">
              {{ selectedSession.title }}
            </h3>
            <p class="truncate text-[12px] leading-5 text-app-muted">
              {{ formatDateTime(selectedSession.startedAt) }} -
              {{ formatDateTime(selectedSession.endedAt) }}
            </p>
          </div>
          <button
            class="ripple grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-muted active:bg-white/10"
            type="button"
            aria-label="Delete reviewed session"
            @click="deleteSelectedSession(selectedSession.id)"
          >
            <MaterialIcon name="delete" :size="21" />
          </button>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Duration</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
              {{ formatDuration(selectedSession.durationSeconds) }}
            </p>
          </div>
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Average</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
              {{ selectedSession.averageHashrate.toFixed(2) }} H/s
            </p>
          </div>
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Accepted</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-app-green">
              {{ selectedSession.acceptedShares.toLocaleString() }}
            </p>
          </div>
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Rejected</p>
            <p
              class="mt-1 text-[18px] font-semibold leading-6"
              :class="selectedSession.rejectedShares > 0 ? 'text-red-300' : 'text-white'"
            >
              {{ selectedSession.rejectedShares.toLocaleString() }}
            </p>
          </div>
        </div>

        <div class="mt-4 divide-y divide-app-line">
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Setup</span>
            <strong class="break-words text-right font-medium text-white">{{
              selectedSession.subtitle
            }}</strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Completed</span>
            <strong class="font-medium text-white">{{
              formatRelativeDate(selectedSession.endedAt)
            }}</strong>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>
