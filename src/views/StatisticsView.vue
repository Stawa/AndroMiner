<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import MetricChart from '../components/MetricChart.vue';
import StatCard from '../components/StatCard.vue';
import type {
  HistoryPoint,
  MiningConfig,
  MiningSessionHistoryItem,
  MiningStats
} from '../types/mining';

type TimeRange = '1H' | '6H' | '24H' | '7D' | '30D';

interface StatisticsViewProps {
  config: MiningConfig;
  stats: MiningStats;
  hashrateHistory: HistoryPoint[];
  temperatureHistory: HistoryPoint[];
  sessionHistory: MiningSessionHistoryItem[];
}

const props = defineProps<StatisticsViewProps>();

const activeRange = ref<TimeRange>('1H');
const ranges: TimeRange[] = ['1H', '6H', '24H', '7D', '30D'];
const rangePointCounts: Record<TimeRange, number> = {
  '1H': 12,
  '6H': 18,
  '24H': 26,
  '7D': 26,
  '30D': 26
};

const average = (points: HistoryPoint[]): number =>
  points.length === 0 ? 0 : points.reduce((sum, point) => sum + point.value, 0) / points.length;

const maxValue = (points: HistoryPoint[]): number =>
  points.length === 0 ? 0 : Math.max(...points.map((point) => point.value));

const minValue = (points: HistoryPoint[]): number =>
  points.length === 0 ? 0 : Math.min(...points.map((point) => point.value));

const rangeLabel = computed(() => {
  const labels: Record<TimeRange, string> = {
    '1H': 'Last hour',
    '6H': 'Last 6 hours',
    '24H': 'Last 24 hours',
    '7D': 'Last 7 days',
    '30D': 'Last 30 days'
  };

  return labels[activeRange.value];
});

const visibleHashrateHistory = computed(() =>
  props.hashrateHistory.slice(-rangePointCounts[activeRange.value])
);
const visibleTemperatureHistory = computed(() =>
  props.temperatureHistory.slice(-rangePointCounts[activeRange.value])
);

const averageHashrate = computed(() => average(visibleHashrateHistory.value));
const peakHashrate = computed(() => maxValue(visibleHashrateHistory.value));
const lowHashrate = computed(() => minValue(visibleHashrateHistory.value));
const averageTemperature = computed(() => average(visibleTemperatureHistory.value));
const peakTemperature = computed(() => maxValue(visibleTemperatureHistory.value));
const thermalHeadroom = computed(() =>
  Math.max(0, props.config.thermalThreshold - props.stats.temperature)
);
const hashrateSpread = computed(() => Math.max(0, peakHashrate.value - lowHashrate.value));
const hashrateStability = computed(() => {
  if (averageHashrate.value <= 0) {
    return 100;
  }

  return Math.max(0, Math.round(100 - (hashrateSpread.value / averageHashrate.value) * 100));
});

const totalShares = computed(() => props.stats.acceptedShares + props.stats.rejectedShares);
const acceptedRate = computed(() =>
  totalShares.value === 0 ? 100 : (props.stats.acceptedShares / totalShares.value) * 100
);
const rejectedRate = computed(() => 100 - acceptedRate.value);
const dailyEstimate = computed(() => props.stats.estimatedEarnings);
const monthlyEstimate = computed(() => dailyEstimate.value * 30);
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
const bestSession = computed(() =>
  completedSessions.value.reduce<MiningSessionHistoryItem | null>(
    (best, session) => (!best || session.averageHashrate > best.averageHashrate ? session : best),
    null
  )
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

const healthItems = computed(() => [
  {
    label: 'Share acceptance',
    value: `${acceptedRate.value.toFixed(1)}%`,
    detail: `${props.stats.acceptedShares.toLocaleString()} accepted / ${props.stats.rejectedShares.toLocaleString()} rejected`,
    icon: 'task_alt',
    tone: acceptedRate.value >= 98 ? 'good' : acceptedRate.value >= 94 ? 'warning' : 'danger'
  },
  {
    label: 'Hashrate stability',
    value: `${hashrateStability.value}%`,
    detail: `${hashrateSpread.value.toFixed(1)} H/s spread in ${rangeLabel.value.toLowerCase()}`,
    icon: 'show_chart',
    tone:
      hashrateStability.value >= 70 ? 'good' : hashrateStability.value >= 45 ? 'warning' : 'danger'
  },
  {
    label: 'Thermal headroom',
    value: `${thermalHeadroom.value.toFixed(1)} °C`,
    detail: `Limit ${props.config.thermalThreshold} °C · peak ${peakTemperature.value.toFixed(1)} °C`,
    icon: 'device_thermostat',
    tone: thermalHeadroom.value >= 8 ? 'good' : thermalHeadroom.value >= 3 ? 'warning' : 'danger'
  }
]);
</script>

<template>
  <div class="phone-page">
    <div class="grid grid-cols-5 gap-2">
      <button
        v-for="range in ranges"
        :key="range"
        class="ripple min-h-12 rounded-lg border border-app-line px-1 text-[13px] font-medium text-app-muted"
        :class="{ 'border-app-green bg-app-green-dim text-app-green': activeRange === range }"
        type="button"
        @click="activeRange = range"
      >
        {{ range }}
      </button>
    </div>

    <section class="app-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">
            {{ rangeLabel }}
          </p>
          <h2 class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ props.config.coin.symbol }} mining performance
          </h2>
          <p class="mt-1 truncate text-[13px] leading-5 text-app-muted">
            {{ props.config.algorithm }} · {{ activeThreadsLabel }} threads ·
            {{ props.config.profile.replace('_', ' ') }}
          </p>
        </div>
        <div
          class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px] font-bold text-white"
          :class="props.config.coin.logoClass"
        >
          {{ props.config.coin.logoText }}
        </div>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Current</p>
          <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
            {{ stats.hashrate.toFixed(1) }}
          </p>
          <p class="text-[11px] leading-4 text-app-muted">H/s</p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Average</p>
          <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
            {{ averageHashrate.toFixed(1) }}
          </p>
          <p class="text-[11px] leading-4 text-app-muted">H/s</p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Peak</p>
          <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
            {{ peakHashrate.toFixed(1) }}
          </p>
          <p class="text-[11px] leading-4 text-app-muted">H/s</p>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
      <StatCard
        label="Temperature"
        :value="`${stats.temperature.toFixed(1)} °C`"
        :supporting-text="`Avg ${averageTemperature.toFixed(1)} °C`"
        icon="device_thermostat"
        :tone="thermalHeadroom >= 3 ? 'warning' : 'normal'"
      />
      <StatCard
        label="Battery"
        :value="`${Math.round(stats.batteryLevel)}%`"
        :supporting-text="stats.isCharging ? 'Charging' : 'On battery'"
        :icon="stats.isCharging ? 'battery_charging_full' : 'battery_5_bar'"
        :tone="stats.batteryLevel > 35 ? 'good' : 'warning'"
      />
      <StatCard
        label="CPU usage"
        :value="`${Math.round(stats.cpuUsage)}%`"
        :supporting-text="`${activeThreadsLabel} threads active`"
        icon="memory"
      />
      <StatCard
        label="Est. earnings"
        :value="`${dailyEstimate.toFixed(6)} ${config.coin.symbol}`"
        :supporting-text="`${monthlyEstimate.toFixed(6)} / 30d`"
        icon="payments"
        tone="good"
      />
    </div>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Mining quality</span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="item in healthItems"
          :key="item.label"
          class="flex min-h-[72px] items-center gap-3 px-4 py-3"
        >
          <div
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            :class="{
              'bg-app-green-dim text-app-green': item.tone === 'good',
              'bg-app-yellow/15 text-app-yellow': item.tone === 'warning',
              'bg-red-500/15 text-red-300': item.tone === 'danger'
            }"
          >
            <MaterialIcon :name="item.icon" :size="22" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-medium text-white">{{ item.label }}</p>
            <p class="truncate text-[12px] text-app-muted">{{ item.detail }}</p>
          </div>
          <p class="shrink-0 text-[15px] font-semibold text-white">{{ item.value }}</p>
        </div>
      </div>
    </section>

    <MetricChart
      title="Hashrate history"
      :subtitle="`Average ${averageHashrate.toFixed(2)} H/s · low ${lowHashrate.toFixed(2)} · peak ${peakHashrate.toFixed(2)}`"
      :points="visibleHashrateHistory"
      accent="#5ad989"
      unit="H/s"
    />
    <MetricChart
      title="Temperature history"
      :subtitle="`Average ${averageTemperature.toFixed(1)} °C · peak ${peakTemperature.toFixed(1)} °C`"
      :points="visibleTemperatureHistory"
      accent="#f8c338"
      unit="°C"
    />

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Shares</span>
      </div>
      <div class="border-t border-app-line p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <span class="text-[13px] text-app-muted">Acceptance rate</span>
          <strong class="text-[15px] font-semibold text-white"
            >{{ acceptedRate.toFixed(2) }}%</strong
          >
        </div>
        <div class="h-3 overflow-hidden rounded-full bg-app-elevated">
          <div class="h-full rounded-full bg-app-green" :style="{ width: `${acceptedRate}%` }" />
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Accepted</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-app-green">
              {{ stats.acceptedShares.toLocaleString() }}
            </p>
          </div>
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Rejected</p>
            <p
              class="mt-1 text-[18px] font-semibold leading-6"
              :class="stats.rejectedShares > 0 ? 'text-red-300' : 'text-white'"
            >
              {{ stats.rejectedShares.toLocaleString() }}
            </p>
          </div>
          <div class="rounded-xl bg-app-elevated p-3">
            <p class="text-[11px] uppercase leading-4 text-app-muted">Rejects</p>
            <p class="mt-1 text-[18px] font-semibold leading-6 text-white">
              {{ rejectedRate.toFixed(1) }}%
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <span>Completed sessions</span>
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
          <p class="text-[11px] uppercase leading-4 text-app-muted">Accepted</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-app-green">
            {{ totalSessionAccepted.toLocaleString() }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Best avg</p>
          <p class="mt-1 text-[20px] font-semibold leading-7 text-white">
            {{ bestSession ? `${bestSession.averageHashrate.toFixed(1)} H/s` : '0 H/s' }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
