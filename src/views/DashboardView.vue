<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import StatusIndicator from '../components/StatusIndicator.vue';
import type {
  DeviceTelemetry,
  MiningConfig,
  MiningSessionHistoryItem,
  MiningStats,
  SavedMiningProfile
} from '../types/mining';
import type { MinerBackendState } from '../composables/useMiningController';

interface DashboardViewProps {
  config: MiningConfig;
  stats: MiningStats;
  device: DeviceTelemetry;
  connected: boolean;
  backendState: MinerBackendState;
  backendMessage: string;
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
const canStart = computed(() => props.backendState === 'ready' || props.backendState === 'missing');
const connectionStatus = computed(() => {
  if (props.connected) {
    return { label: 'Pool connected', tone: 'good' as const };
  }

  const labels: Record<
    MinerBackendState,
    { label: string; tone: 'good' | 'warning' | 'danger' | 'muted' }
  > = {
    checking: { label: 'Checking backend', tone: 'warning' },
    ready: { label: 'Miner ready', tone: 'good' },
    missing: { label: 'Download required', tone: 'warning' },
    downloading: { label: 'Downloading miner', tone: 'warning' },
    'web-unavailable': { label: 'Android required', tone: 'warning' },
    error: { label: 'Miner stopped', tone: 'danger' }
  };

  return labels[props.backendState];
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
  },
  {
    label: 'CPU',
    value: `${props.config.threadCount}/${props.config.totalDetectedThreads} threads`,
    icon: 'memory',
    good: props.config.threadCount <= props.config.totalDetectedThreads
  }
]);

const recentSessions = computed(() =>
  props.sessionHistory.slice(0, 5).map((session) => ({
    ...session,
    duration: formatDuration(session.durationSeconds),
    detail:
      session.acceptedShares + session.rejectedShares > 0
        ? `${session.acceptedShares} accepted`
        : formatRelativeDate(session.endedAt),
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

const deleteSelectedSession = (id: string): void => {
  emit('deleteSession', id);
  if (selectedSessionId.value === id) {
    closeSessionReview();
  }
};
</script>

<template>
  <div class="phone-page">
    <section class="app-card overflow-hidden">
      <button
        class="ripple flex min-h-[88px] w-full items-center gap-3 p-4 text-left"
        type="button"
        @click="emit('configure')"
      >
        <div
          class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[22px] font-bold text-white"
          :class="config.coin.logoClass"
        >
          {{ config.coin.logoText }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Active profile</p>
          <h2 class="mt-1 truncate text-[20px] font-semibold leading-7 text-white">
            {{ profileName }}
          </h2>
          <p class="truncate text-[13px] leading-5 text-app-muted">
            {{ config.coin.name }} · {{ config.algorithm }}
          </p>
        </div>
        <MaterialIcon class="shrink-0 text-app-muted" name="chevron_right" :size="26" />
      </button>
    </section>

    <section class="app-card p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Quick start</p>
          <h2 class="mt-1 text-[18px] font-semibold leading-6 text-white">
            {{ config.coin.symbol }} mining
          </h2>
        </div>
        <StatusIndicator
          :connected="connected"
          :label="connectionStatus.label"
          :tone="connectionStatus.tone"
        />
      </div>

      <div class="space-y-2 rounded-2xl bg-app-elevated p-3 text-[14px] leading-5">
        <div class="flex min-w-0 justify-between gap-3">
          <span class="text-app-muted">Pool</span>
          <strong class="min-w-0 break-all text-right font-medium text-white">{{
            poolAddress
          }}</strong>
        </div>
        <div class="flex min-w-0 justify-between gap-3">
          <span class="text-app-muted">Wallet</span>
          <strong class="min-w-0 truncate text-right font-medium text-white">{{
            walletPreview
          }}</strong>
        </div>
        <div class="flex min-w-0 justify-between gap-3">
          <span class="text-app-muted">Worker</span>
          <strong class="min-w-0 truncate text-right font-medium text-white">{{
            config.workerName
          }}</strong>
        </div>
      </div>

      <div
        v-if="backendState !== 'ready'"
        class="mt-3 rounded-xl border border-app-line bg-app-elevated/70 p-3 text-[12px] leading-[18px] text-app-muted"
      >
        {{ backendMessage }}
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <button
          class="ripple col-span-2 flex h-14 items-center justify-center gap-2 rounded-xl bg-app-green-dim text-[16px] font-semibold text-app-green disabled:opacity-45"
          type="button"
          :disabled="!canStart"
          @click="emit('start')"
        >
          <MaterialIcon name="play_arrow" :size="24" filled />
          Start
        </button>
        <button
          class="ripple grid h-14 place-items-center rounded-xl bg-app-elevated text-white"
          type="button"
          aria-label="Edit mining setup"
          @click="emit('configure')"
        >
          <MaterialIcon name="tune" :size="24" />
        </button>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
      <button
        v-for="item in readinessItems"
        :key="item.label"
        class="ripple app-card min-h-[88px] p-3 text-left active:bg-white/5"
        type="button"
        @click="item.label === 'CPU' ? emit('configure') : emit('statistics')"
      >
        <div
          class="mb-2 grid h-8 w-8 place-items-center rounded-full"
          :class="
            item.good ? 'bg-app-green-dim text-app-green' : 'bg-app-yellow/15 text-app-yellow'
          "
        >
          <MaterialIcon :name="item.icon" :size="19" />
        </div>
        <p class="text-[12px] leading-4 text-app-muted">{{ item.label }}</p>
        <p class="mt-1 truncate text-[14px] font-semibold leading-5 text-white">{{ item.value }}</p>
      </button>
    </section>

    <section class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center justify-between gap-3 px-4">
        <h2 class="text-[15px] font-semibold text-white">Recent sessions</h2>
        <div class="flex items-center gap-1">
          <button
            v-if="recentSessions.length > 0"
            class="ripple grid h-12 w-12 place-items-center rounded-full text-app-muted active:bg-white/10"
            type="button"
            aria-label="Clear session history"
            @click="emit('clearSessions')"
          >
            <MaterialIcon name="delete_sweep" :size="22" />
          </button>
          <button
            class="ripple min-h-12 rounded-full px-3 text-[13px] font-medium text-app-green"
            type="button"
            @click="emit('statistics')"
          >
            View stats
          </button>
        </div>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="session in recentSessions"
          :key="session.id"
          class="flex min-h-[72px] w-full items-center gap-2 px-4 py-3"
        >
          <button
            class="ripple flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left active:bg-white/5"
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
            <div class="min-w-[72px] text-right">
              <p class="text-[13px] font-medium text-white">{{ session.duration }}</p>
              <p class="truncate text-[11px] text-app-muted">{{ session.detail }}</p>
            </div>
          </button>
          <button
            class="ripple grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-muted active:bg-white/10"
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

    <section class="grid grid-cols-2 gap-2">
      <button
        class="ripple app-card flex min-h-14 items-center justify-center gap-2 px-3 text-[14px] font-medium text-white"
        type="button"
        @click="emit('profiles')"
      >
        <MaterialIcon name="folder_managed" :size="21" />
        Profiles
      </button>
      <button
        class="ripple app-card flex min-h-14 items-center justify-center gap-2 px-3 text-[14px] font-medium text-white"
        type="button"
        @click="emit('statistics')"
      >
        <MaterialIcon name="monitoring" :size="21" />
        Statistics
      </button>
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
      >
        <button
          class="ripple mx-auto mb-3 block h-8 min-h-8 w-24 rounded-full"
          type="button"
          aria-label="Close session review"
          @click="closeSessionReview"
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
