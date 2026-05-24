<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import { useSheetDrag } from '../composables/useSheetDrag';
import type { MiningConfig, MiningSessionHistoryItem } from '../types/mining';

interface StatisticsViewProps {
  config: MiningConfig;
  sessionHistory: MiningSessionHistoryItem[];
}

type InsightSection = 'summary' | 'improve' | 'history';
type InsightTone = 'good' | 'warning' | 'danger' | 'neutral';

interface InsightSectionItem {
  id: InsightSection;
  label: string;
  icon: string;
}

interface InsightItem {
  title: string;
  body: string;
  icon: string;
  tone: InsightTone;
  metric: string;
}

interface SummaryTile {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: InsightTone;
  sessionId?: string;
}

const props = defineProps<StatisticsViewProps>();

const selectedSessionId = ref<string | null>(null);
const insightSection = ref<InsightSection>('summary');

const insightSections: InsightSectionItem[] = [
  { id: 'summary', label: 'Summary', icon: 'space_dashboard' },
  { id: 'improve', label: 'Improve', icon: 'tips_and_updates' },
  { id: 'history', label: 'Runs', icon: 'history' }
];

const completedSessions = computed(() => props.sessionHistory);
const sessionCount = computed(() => completedSessions.value.length);
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
  totalSessionShares.value === 0
    ? 100
    : (totalSessionAccepted.value / totalSessionShares.value) * 100
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
const latestSession = computed(() => completedSessions.value[0] ?? null);
const selectedSession = computed(() =>
  completedSessions.value.find((session) => session.id === selectedSessionId.value)
);

const hasPlaceholderWallet = computed(() =>
  /^YOUR_[A-Z0-9]+_WALLET_ADDRESS$/.test(props.config.walletAddress)
);
const walletReady = computed(
  () => props.config.walletAddress.trim().length > 12 && !hasPlaceholderWallet.value
);
const profileLabel = computed(() =>
  props.config.profile.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())
);
const poolAddress = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const rejectRate = computed(() => 100 - historicalAcceptance.value);
const averageRunSeconds = computed(() =>
  sessionCount.value === 0 ? 0 : totalSessionSeconds.value / sessionCount.value
);
const consistencyScore = computed(() => {
  if (completedSessions.value.length < 2 || weightedAverageHashrate.value <= 0) {
    return completedSessions.value.length > 0 ? 70 : 0;
  }

  const averageDeviation =
    completedSessions.value.reduce(
      (sum, session) => sum + Math.abs(session.averageHashrate - weightedAverageHashrate.value),
      0
    ) / completedSessions.value.length;

  return Math.max(
    30,
    Math.min(100, 100 - (averageDeviation / weightedAverageHashrate.value) * 100)
  );
});
const primaryInsight = computed<InsightItem>(() => {
  if (!walletReady.value) {
    return {
      title: 'Wallet is still missing',
      body: 'Set a real wallet address before relying on saved profiles or completed runs.',
      icon: 'account_balance_wallet',
      tone: 'danger',
      metric: 'Required'
    };
  }

  if (sessionCount.value === 0) {
    return {
      title: 'No completed runs yet',
      body: 'Finish one mining session and this page will compare duration, acceptance, and setup quality.',
      icon: 'history',
      tone: 'neutral',
      metric: '0 runs'
    };
  }

  if (rejectRate.value > 2) {
    return {
      title: 'Pool results need a look',
      body: 'Saved sessions show more rejected shares than expected. Try a closer pool endpoint or protocol.',
      icon: 'hub',
      tone: 'warning',
      metric: `${rejectRate.value.toFixed(1)}% reject`
    };
  }

  if (averageRunSeconds.value < 300 && sessionCount.value >= 2) {
    return {
      title: 'Runs are ending quickly',
      body: 'Your history has short sessions. Check battery safety, Android background limits, and heat behavior.',
      icon: 'timer',
      tone: 'warning',
      metric: formatDuration(averageRunSeconds.value)
    };
  }

  return {
    title: 'Saved runs look usable',
    body: 'History has clean share acceptance and enough session data to compare future changes.',
    icon: 'check_circle',
    tone: 'good',
    metric: `${historicalAcceptance.value.toFixed(1)}% accepted`
  };
});

const summaryTiles = computed<SummaryTile[]>(() => [
  {
    label: 'Best average',
    value: bestSession.value ? formatHashrate(bestSession.value.averageHashrate) : 'No run',
    helper: bestSession.value ? formatRelativeDate(bestSession.value.endedAt) : 'Finish a session',
    icon: 'workspace_premium',
    tone: bestSession.value ? 'good' : 'neutral',
    sessionId: bestSession.value?.id
  },
  {
    label: 'Longest run',
    value: longestSession.value ? formatDuration(longestSession.value.durationSeconds) : 'No run',
    helper: longestSession.value
      ? formatRelativeDate(longestSession.value.endedAt)
      : 'History is empty',
    icon: 'timer',
    tone: longestSession.value ? 'good' : 'neutral',
    sessionId: longestSession.value?.id
  },
  {
    label: 'Total time',
    value: formatDuration(totalSessionSeconds.value),
    helper: `${sessionCount.value} saved session${sessionCount.value === 1 ? '' : 's'}`,
    icon: 'schedule',
    tone: sessionCount.value > 0 ? 'good' : 'neutral'
  },
  {
    label: 'Share quality',
    value: `${historicalAcceptance.value.toFixed(1)}%`,
    helper: `${totalSessionAccepted.value.toLocaleString()} accepted`,
    icon: 'done_all',
    tone: rejectRate.value > 2 ? 'warning' : 'good'
  }
]);

const setupRows = computed(() => [
  {
    label: 'Coin and profile',
    value: `${props.config.coin.name} · ${profileLabel.value}`,
    icon: props.config.coin.logoText,
    iconClass: props.config.coin.logoClass
  },
  {
    label: 'Pool',
    value: `${poolAddress.value} · ${props.config.protocol}`,
    icon: 'hub',
    iconClass: 'bg-app-green-dim text-app-green'
  },
  {
    label: 'Threads',
    value: `${props.config.threadCount}/${props.config.totalDetectedThreads} threads`,
    icon: 'memory',
    iconClass: 'bg-app-green-dim text-app-green'
  },
  {
    label: 'Wallet',
    value: walletReady.value ? 'Configured' : 'Not set',
    icon: walletReady.value ? 'check' : 'priority_high',
    iconClass: walletReady.value
      ? 'bg-app-green-dim text-app-green'
      : 'bg-app-yellow/15 text-app-yellow'
  }
]);

const improvementItems = computed<InsightItem[]>(() => [
  {
    title: walletReady.value ? 'Wallet is configured' : 'Add a wallet address',
    body: walletReady.value
      ? 'The active setup can be saved and reused safely.'
      : 'The current profile still needs a real payout address.',
    icon: 'account_balance_wallet',
    tone: walletReady.value ? 'good' : 'danger',
    metric: walletReady.value ? 'Ready' : 'Fix'
  },
  {
    title: rejectRate.value > 2 ? 'Try another pool route' : 'Pool acceptance is clean',
    body:
      rejectRate.value > 2
        ? 'Rejected shares in saved runs point to latency, endpoint, or protocol problems.'
        : 'Saved runs are not showing a share-quality problem.',
    icon: rejectRate.value > 2 ? 'wifi_tethering_error' : 'done_all',
    tone: rejectRate.value > 2 ? 'warning' : 'good',
    metric: `${rejectRate.value.toFixed(1)}% reject`
  },
  {
    title: sessionCount.value < 3 ? 'Build a small baseline' : 'Baseline is taking shape',
    body:
      sessionCount.value < 3
        ? 'Run the same setup a few times so changes have something fair to compare against.'
        : 'There is enough history to notice whether a setup change helped.',
    icon: 'stacked_line_chart',
    tone: sessionCount.value < 3 ? 'neutral' : 'good',
    metric: `${sessionCount.value} runs`
  },
  {
    title: consistencyScore.value >= 75 ? 'Results are consistent' : 'Results are uneven',
    body:
      consistencyScore.value >= 75
        ? 'Saved averages are staying close enough to make comparisons useful.'
        : 'Large swings between saved runs usually mean heat, background limits, or pool route changed.',
    icon: 'ssid_chart',
    tone: consistencyScore.value >= 75 ? 'good' : 'warning',
    metric: `${Math.round(consistencyScore.value)}%`
  }
]);

const sessionRows = computed(() =>
  completedSessions.value.slice(0, 16).map((session) => ({
    ...session,
    duration: formatDuration(session.durationSeconds),
    acceptance: sessionAcceptance(session),
    endedLabel: formatRelativeDate(session.endedAt)
  }))
);

const toneClass = (tone: InsightTone): string => {
  const classes: Record<InsightTone, string> = {
    good: 'bg-app-green-dim text-app-green',
    warning: 'bg-app-yellow/15 text-app-yellow',
    danger: 'bg-red-500/15 text-red-300',
    neutral: 'bg-app-elevated text-app-muted'
  };

  return classes[tone];
};

const toneBorderClass = (tone: InsightTone): string => {
  const classes: Record<InsightTone, string> = {
    good: 'border-app-green/30',
    warning: 'border-app-yellow/35',
    danger: 'border-red-400/35',
    neutral: 'border-app-line'
  };

  return classes[tone];
};

const formatHashrate = (value: number): string =>
  `${Math.max(0, value).toFixed(value >= 100 ? 0 : 1)} H/s`;

const formatDuration = (seconds: number): string => {
  const normalized = Math.max(0, Math.round(seconds));

  if (normalized < 60) {
    return `${normalized}s`;
  }

  const minutes = Math.round(normalized / 60);
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

const sessionAcceptance = (session: MiningSessionHistoryItem): number => {
  const shares = session.acceptedShares + session.rejectedShares;
  return shares === 0 ? 100 : (session.acceptedShares / shares) * 100;
};

const reviewSession = (id?: string): void => {
  if (!id) {
    return;
  }

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
    <section class="app-card overflow-hidden">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div
            class="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-app-green-dim text-app-green"
          >
            <MaterialIcon name="insights" :size="30" filled />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Insights</p>
            <h2 class="mt-1 text-[22px] font-semibold leading-7 text-white">Run review</h2>
            <p class="mt-0.5 truncate text-[13px] leading-5 text-app-muted">
              {{ sessionCount }} saved · {{ formatDuration(totalSessionSeconds) }} total
            </p>
          </div>
        </div>

        <div
          class="mt-4 rounded-lg border p-4"
          :class="[toneBorderClass(primaryInsight.tone), toneClass(primaryInsight.tone)]"
        >
          <div class="flex items-start gap-3">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-card/80">
              <MaterialIcon :name="primaryInsight.icon" :size="24" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-[16px] font-semibold leading-6 text-white">
                  {{ primaryInsight.title }}
                </h3>
                <span class="shrink-0 rounded-full bg-app-card/80 px-2 py-1 text-[11px] font-bold">
                  {{ primaryInsight.metric }}
                </span>
              </div>
              <p class="mt-1 text-[13px] leading-5 text-app-muted">{{ primaryInsight.body }}</p>
            </div>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-1 rounded-full bg-app-elevated p-1">
          <button
            v-for="section in insightSections"
            :key="section.id"
            class="ripple flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium leading-4 transition-colors"
            :class="
              insightSection === section.id
                ? 'bg-app-card text-app-green shadow-[0_1px_2px_rgb(15_23_42/0.08)]'
                : 'text-app-muted'
            "
            type="button"
            :aria-pressed="insightSection === section.id"
            @click="insightSection = section.id"
          >
            <MaterialIcon :name="section.icon" :size="18" :filled="insightSection === section.id" />
            <span class="truncate">{{ section.label }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="insightSection === 'summary'" class="space-y-3">
      <section class="grid grid-cols-2 gap-2">
        <button
          v-for="tile in summaryTiles"
          :key="tile.label"
          class="ripple min-h-[118px] rounded-lg border border-app-line bg-app-card p-3 text-left active:bg-app-elevated disabled:opacity-100"
          type="button"
          :disabled="!tile.sessionId"
          @click="reviewSession(tile.sessionId)"
        >
          <span
            class="mb-3 grid h-9 w-9 place-items-center rounded-full"
            :class="toneClass(tile.tone)"
          >
            <MaterialIcon :name="tile.icon" :size="20" />
          </span>
          <span class="block truncate text-[11px] font-semibold uppercase leading-4 text-app-muted">
            {{ tile.label }}
          </span>
          <span class="mt-1 block truncate text-[18px] font-semibold leading-6 text-white">
            {{ tile.value }}
          </span>
          <span class="mt-1 block truncate text-[12px] leading-4 text-app-muted">
            {{ tile.helper }}
          </span>
        </button>
      </section>

      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="tune" :size="21" />
          <div class="min-w-0">
            <h3 class="text-[15px] font-semibold leading-5 text-white">Active setup baseline</h3>
            <p class="mt-0.5 text-[12px] leading-4 text-app-muted">
              Settings used for the next saved comparison
            </p>
          </div>
        </div>
        <div class="divide-y divide-app-line border-t border-app-line">
          <div
            v-for="row in setupRows"
            :key="row.label"
            class="flex min-h-[64px] items-center gap-3 px-4 py-3"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[17px] font-bold"
              :class="row.iconClass"
            >
              <MaterialIcon v-if="row.icon.length > 2" :name="row.icon" :size="21" />
              <span v-else>{{ row.icon }}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-medium leading-5 text-white">
                {{ row.label }}
              </span>
              <span class="block truncate text-[12px] leading-4 text-app-muted">
                {{ row.value }}
              </span>
            </span>
          </div>
        </div>
      </section>
    </section>

    <section v-else-if="insightSection === 'improve'" class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center gap-3 px-4">
        <MaterialIcon class="text-app-green" name="tips_and_updates" :size="22" />
        <div class="min-w-0">
          <h3 class="text-[15px] font-semibold leading-5 text-white">Improvement queue</h3>
          <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Based on saved runs</p>
        </div>
      </div>
      <div class="space-y-2 border-t border-app-line p-4">
        <article
          v-for="item in improvementItems"
          :key="item.title"
          class="rounded-lg border p-3"
          :class="toneBorderClass(item.tone)"
        >
          <div class="flex items-start gap-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              :class="toneClass(item.tone)"
            >
              <MaterialIcon :name="item.icon" :size="21" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-start justify-between gap-3">
                <strong class="text-[14px] leading-5 text-white">{{ item.title }}</strong>
                <span
                  class="shrink-0 rounded-full bg-app-elevated px-2 py-1 text-[11px] font-semibold text-app-muted"
                >
                  {{ item.metric }}
                </span>
              </span>
              <span class="mt-1 block text-[12px] leading-[18px] text-app-muted">
                {{ item.body }}
              </span>
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-else class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center justify-between gap-3 px-4">
        <div class="min-w-0">
          <h3 class="text-[15px] font-semibold leading-5 text-white">Run history</h3>
          <p class="mt-0.5 text-[12px] leading-4 text-app-muted">
            {{
              latestSession
                ? `Latest ${formatRelativeDate(latestSession.endedAt)}`
                : 'No runs saved'
            }}
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-app-elevated px-2.5 py-1 text-[12px] font-semibold leading-4 text-app-muted"
        >
          {{ sessionCount }} total
        </span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <button
          v-for="session in sessionRows"
          :key="session.id"
          class="ripple flex min-h-[82px] w-full items-center gap-3 px-4 py-3 text-left active:bg-app-elevated"
          type="button"
          @click="reviewSession(session.id)"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
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
              {{ session.acceptance.toFixed(1) }}% accepted ·
              {{ session.acceptedShares.toLocaleString() }} shares
            </span>
          </span>
          <span class="shrink-0 rounded-lg bg-app-elevated px-2 py-1 text-right">
            <span class="block text-[13px] font-semibold text-white">{{ session.duration }}</span>
            <span class="block text-[11px] text-app-muted">
              {{ formatHashrate(session.averageHashrate) }}
            </span>
          </span>
        </button>
        <div v-if="sessionRows.length === 0" class="px-4 py-6 text-[13px] text-app-muted">
          Completed mining sessions will appear here.
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
          <div class="rounded-lg bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Duration</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
              {{ formatDuration(selectedSession.durationSeconds) }}
            </p>
          </div>
          <div class="rounded-lg bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Average</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
              {{ formatHashrate(selectedSession.averageHashrate) }}
            </p>
          </div>
          <div class="rounded-lg bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Accepted</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-app-green">
              {{ selectedSession.acceptedShares.toLocaleString() }}
            </p>
          </div>
          <div class="rounded-lg bg-app-elevated p-3">
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
