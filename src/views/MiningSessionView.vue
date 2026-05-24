<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import HashrateRing from '../components/HashrateRing.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import MiningMetric from '../components/MiningMetric.vue';
import SessionControls from '../components/SessionControls.vue';
import StatusIndicator from '../components/StatusIndicator.vue';
import WarningBottomSheet, { type WarningType } from '../components/WarningBottomSheet.vue';
import { profilePresets } from '../composables/useMiningController';
import { useSheetDrag } from '../composables/useSheetDrag';
import type {
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
  connected: boolean;
  uptime: string;
  backendMessage: string;
  logs: string[];
  apiTelemetry: MiningApiTelemetry;
  hashrateHistory: HistoryPoint[];
}

const props = defineProps<MiningSessionViewProps>();

const emit = defineEmits<{
  pause: [];
  stop: [];
  profile: [value: MiningProfile];
  resume: [];
}>();

const detailsOpen = ref(false);
const profilePickerOpen = ref(false);
const warningType = ref<WarningType | null>(null);

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
const latestLogs = computed(() => props.logs.slice(-8).reverse());
const detailLogs = computed(() => props.logs.slice(-30).reverse());
const telemetrySourceLabel = computed(() =>
  props.apiTelemetry.available ? 'XMRig HTTP API' : 'Log parser'
);

const telemetryEndpointLabel = computed(() =>
  props.apiTelemetry.port > 0 ? `${props.apiTelemetry.host}:${props.apiTelemetry.port}` : 'Inactive'
);

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
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : 'Measuring';

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

const trendLabel = computed(() => {
  const current = props.stats.hashrate;
  const average = averageHashrate.value;

  if (current <= 0) return 'Idle';
  if (baselineHashrates.value.length < 3) return 'Warming up';
  if (average <= 0) return 'Mining';

  const tolerance = Math.max(1, average * 0.08);

  if (current > average + tolerance) return 'Above average';
  if (current < average - tolerance) return 'Below average';

  return 'Near average';
});

const trendTone = computed(() => {
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
  <div class="session-page">
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
        type="button"
        aria-label="Open session details"
        @click="toggleDetails"
      >
        <MaterialIcon name="fullscreen" :size="23" />
      </button>
    </header>

    <main class="flex flex-1 flex-col justify-center gap-4 py-5">
      <HashrateRing
        :value="stats.hashrate"
        :average="averageHashrate"
        :active="state === 'mining' || state === 'starting'"
      />

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

      <section class="grid grid-cols-2 gap-2">
        <MiningMetric label="Accepted" :value="stats.acceptedShares.toLocaleString()" tone="good" />
        <MiningMetric
          label="Rejected"
          :value="stats.rejectedShares.toLocaleString()"
          :tone="stats.rejectedShares > 0 ? 'danger' : 'normal'"
        />
        <MiningMetric label="Miner CPU" :value="formatCpuUsage(stats.minerCpuUsage)" />
        <MiningMetric
          label="Temperature"
          :value="`${Math.round(stats.temperature)} °C`"
          :tone="thermalTone"
        />
        <MiningMetric label="Threads" :value="`${stats.activeThreads} / ${config.threadCount}`" />
        <MiningMetric
          label="Battery"
          :value="`${Math.round(stats.batteryLevel)}%`"
          :tone="stats.batteryLevel <= batterySafetyLimit ? 'warning' : 'normal'"
        />
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
            latest
          </span>
        </div>

        <div
          class="max-h-36 overflow-y-auto rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] leading-4"
        >
          <p v-if="latestLogs.length === 0" class="break-words text-app-muted">
            {{ backendMessage || 'Waiting for miner output...' }}
          </p>
          <p
            v-for="(line, index) in latestLogs"
            :key="`latest-${index}-${line}`"
            class="break-words border-b border-white/5 py-1 text-app-muted last:border-b-0"
          >
            {{ line }}
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
              class="max-h-52 overflow-y-auto rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] leading-4"
            >
              <p v-if="detailLogs.length === 0" class="break-words text-app-muted">
                {{ backendMessage || 'Waiting for miner output...' }}
              </p>
              <p
                v-for="(line, index) in detailLogs"
                :key="`detail-${index}-${line}`"
                class="break-words border-b border-white/5 py-1 text-app-muted last:border-b-0"
              >
                {{ line }}
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
