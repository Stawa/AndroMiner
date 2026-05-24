<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import StatCard from '../components/StatCard.vue';
import { useSheetDrag } from '../composables/useSheetDrag';
import type { MiningConfig, MiningSessionHistoryItem, MiningStats } from '../types/mining';

interface StatisticsViewProps {
  config: MiningConfig;
  stats: MiningStats;
  sessionHistory: MiningSessionHistoryItem[];
}

const props = defineProps<StatisticsViewProps>();

const selectedSessionId = ref<string | null>(null);

const totalShares = computed(() => props.stats.acceptedShares + props.stats.rejectedShares);
const acceptedRate = computed(() =>
  totalShares.value === 0 ? 100 : (props.stats.acceptedShares / totalShares.value) * 100
);
const rejectedRate = computed(() => 100 - acceptedRate.value);
const thermalHeadroom = computed(() =>
  Math.max(0, props.config.thermalThreshold - props.stats.temperature)
);
const activeThreadsLabel = computed(
  () =>
    `${props.stats.activeThreads || props.config.threadCount}/${props.config.totalDetectedThreads}`
);

const completedSessions = computed(() => props.sessionHistory);
const totalSessionSeconds = computed(() =>
  completedSessions.value.reduce((sum, session) => sum + session.durationSeconds, 0)
);
const totalSessionAccepted = computed(() =>
  completedSessions.value.reduce((sum, session) => sum + session.acceptedShares, 0)
);
const totalSessionRejected = computed(() =>
  completedSessions.value.reduce((sum, session) => sum + session.rejectedShares, 0)
);
const totalSessionShares = computed(() => totalSessionAccepted.value + totalSessionRejected.value);
const historicalAcceptance = computed(() =>
  totalSessionShares.value === 0 ? 100 : (totalSessionAccepted.value / totalSessionShares.value) * 100
);
const weightedAverageHashrate = computed(() => {
  if (totalSessionSeconds.value === 0) {
    return 0;
  }

  const weightedHashrate = completedSessions.value.reduce(
    (sum, session) => sum + session.averageHashrate * session.durationSeconds,
    0
  );
  return weightedHashrate / totalSessionSeconds.value;
});
const bestSession = computed(() =>
  completedSessions.value.reduce<MiningSessionHistoryItem | null>(
    (best, session) => (!best || session.averageHashrate > best.averageHashrate ? session : best),
    null
  )
);
const longestSession = computed(() =>
  completedSessions.value.reduce<MiningSessionHistoryItem | null>(
    (longest, session) =>
      !longest || session.durationSeconds > longest.durationSeconds ? session : longest,
    null
  )
);
const selectedSession = computed(() =>
  completedSessions.value.find((session) => session.id === selectedSessionId.value)
);

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.max(0, seconds)}s`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const formatDateTime = (isoDate: string): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));

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

const formatCpuUsage = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Measuring';

const sessionAcceptance = (session: MiningSessionHistoryItem): number => {
  const shares = session.acceptedShares + session.rejectedShares;
  return shares === 0 ? 100 : (session.acceptedShares / shares) * 100;
};

const sessionRows = computed(() =>
  completedSessions.value.slice(0, 12).map((session) => ({
    ...session,
    duration: formatDuration(session.durationSeconds),
    acceptance: sessionAcceptance(session),
    endedLabel: formatRelativeDate(session.endedAt)
  }))
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
</script>

<template>
  <div class="phone-page">
    <section class="app-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Live summary</p>
          <h2 class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ config.coin.symbol }} session statistics
          </h2>
          <p class="mt-1 truncate text-[13px] leading-5 text-app-muted">
            {{ config.algorithm }} · {{ activeThreadsLabel }} threads ·
            {{ config.profile.replace('_', ' ') }}
          </p>
        </div>
        <div
          class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px] font-bold text-white"
          :class="config.coin.logoClass"
        >
          {{ config.coin.logoText }}
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Current rate</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ stats.hashrate.toFixed(1) }} H/s
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Runtime</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ formatDuration(stats.uptimeSeconds) }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Accepted now</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-app-green">
            {{ stats.acceptedShares.toLocaleString() }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Reject rate</p>
          <p
            class="mt-1 text-[20px] font-semibold leading-7"
            :class="rejectedRate > 2 ? 'text-red-300' : 'text-white'"
          >
            {{ rejectedRate.toFixed(1) }}%
          </p>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
      <StatCard
        label="Temperature"
        :value="`${stats.temperature.toFixed(1)} °C`"
        :supporting-text="`${thermalHeadroom.toFixed(1)} °C below limit`"
        icon="device_thermostat"
        :tone="thermalHeadroom >= 5 ? 'good' : 'warning'"
      />
      <StatCard
        label="Battery"
        :value="`${Math.round(stats.batteryLevel)}%`"
        :supporting-text="stats.isCharging ? 'Charging' : 'On battery'"
        :icon="stats.isCharging ? 'battery_charging_full' : 'battery_5_bar'"
        :tone="stats.batteryLevel > 35 ? 'good' : 'warning'"
      />
      <StatCard
        label="Miner CPU"
        :value="formatCpuUsage(stats.minerCpuUsage)"
        :supporting-text="`${activeThreadsLabel} threads active`"
        icon="memory"
      />
      <StatCard
        label="Est. earnings"
        :value="`${stats.estimatedEarnings.toFixed(6)} ${config.coin.symbol}`"
        supporting-text="Projected per 24 hours"
        icon="payments"
        tone="good"
      />
    </div>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Completed session totals</span>
      </div>
      <div class="grid grid-cols-2 gap-2 border-t border-app-line p-4">
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Sessions</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ completedSessions.length }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Total time</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ formatDuration(totalSessionSeconds) }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Weighted avg</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ weightedAverageHashrate.toFixed(1) }} H/s
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Acceptance</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-app-green">
            {{ historicalAcceptance.toFixed(1) }}%
          </p>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
      <button
        class="ripple app-card min-h-[112px] p-4 text-left active:bg-white/5"
        type="button"
        :disabled="!bestSession"
        @click="bestSession && reviewSession(bestSession.id)"
      >
        <div class="mb-2 flex items-center gap-2 text-app-green">
          <MaterialIcon name="speed" :size="20" />
          <span class="text-[12px] font-semibold uppercase leading-4">Best average</span>
        </div>
        <p class="text-[18px] font-semibold leading-6 text-white">
          {{ bestSession ? `${bestSession.averageHashrate.toFixed(1)} H/s` : 'No sessions' }}
        </p>
        <p class="mt-1 truncate text-[12px] leading-4 text-app-muted">
          {{ bestSession ? `${bestSession.title} · ${formatRelativeDate(bestSession.endedAt)}` : 'Stop a mining run to record one' }}
        </p>
      </button>
      <button
        class="ripple app-card min-h-[112px] p-4 text-left active:bg-white/5"
        type="button"
        :disabled="!longestSession"
        @click="longestSession && reviewSession(longestSession.id)"
      >
        <div class="mb-2 flex items-center gap-2 text-app-green">
          <MaterialIcon name="timer" :size="20" />
          <span class="text-[12px] font-semibold uppercase leading-4">Longest run</span>
        </div>
        <p class="text-[18px] font-semibold leading-6 text-white">
          {{ longestSession ? formatDuration(longestSession.durationSeconds) : 'No sessions' }}
        </p>
        <p class="mt-1 truncate text-[12px] leading-4 text-app-muted">
          {{ longestSession ? `${longestSession.averageHashrate.toFixed(1)} H/s average` : 'Session history will appear here' }}
        </p>
      </button>
    </section>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Recent sessions</span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <button
          v-for="session in sessionRows"
          :key="session.id"
          class="ripple flex min-h-[82px] w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5"
          type="button"
          @click="reviewSession(session.id)"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
            :class="session.coinLogoClass"
          >
            {{ session.coinLogoText }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] font-medium text-white">
              {{ session.title }}
            </span>
            <span class="mt-0.5 block truncate text-[12px] text-app-muted">
              {{ session.subtitle }} · {{ session.endedLabel }}
            </span>
            <span class="mt-1 block truncate text-[11px] text-app-muted">
              {{ session.acceptedShares.toLocaleString() }} accepted ·
              {{ session.rejectedShares.toLocaleString() }} rejected ·
              {{ session.acceptance.toFixed(1) }}% accepted
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-[13px] font-semibold text-white">{{ session.duration }}</span>
            <span class="block text-[11px] text-app-muted">
              {{ session.averageHashrate.toFixed(1) }} H/s
            </span>
          </span>
        </button>
        <div v-if="sessionRows.length === 0" class="px-4 py-6 text-[13px] text-app-muted">
          No completed sessions yet. Stop a mining session and this page will keep the useful
          details here.
        </div>
      </div>
    </section>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Current setup</span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line px-4">
        <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
          <span class="text-app-muted">Algorithm</span>
          <strong class="text-right font-medium text-white">{{ config.algorithm }}</strong>
        </div>
        <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
          <span class="text-app-muted">Pool</span>
          <strong class="break-all text-right font-medium text-white">
            {{ config.poolUrl }}:{{ config.poolPort }}
          </strong>
        </div>
        <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
          <span class="text-app-muted">Worker</span>
          <strong class="truncate text-right font-medium text-white">{{ config.workerName }}</strong>
        </div>
        <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
          <span class="text-app-muted">Shares this run</span>
          <strong class="text-right font-medium text-white">
            {{ stats.acceptedShares.toLocaleString() }} / {{ stats.rejectedShares.toLocaleString() }}
          </strong>
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
          aria-label="Close session details"
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
            <span class="text-app-muted">Share acceptance</span>
            <strong class="font-medium text-white">
              {{ sessionAcceptance(selectedSession).toFixed(2) }}%
            </strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Setup</span>
            <strong class="break-words text-right font-medium text-white">
              {{ selectedSession.subtitle }}
            </strong>
          </div>
          <div class="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]">
            <span class="text-app-muted">Completed</span>
            <strong class="font-medium text-white">
              {{ formatRelativeDate(selectedSession.endedAt) }}
            </strong>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>
