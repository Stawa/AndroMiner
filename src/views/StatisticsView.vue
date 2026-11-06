<script setup lang="ts">
import ProtectionEventList from '../components/ProtectionEventList.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import { compatibleAverage, exportHistory } from '../utils/sessionHistory';
import { Clipboard } from '@capacitor/clipboard';
import ConfigSelect from '../components/ConfigSelect.vue';
import LeaderboardCard from '../components/LeaderboardCard.vue';
import { formatHashrate } from '../utils/miningTelemetry';
import { formatDate, formatDuration, formatNumber, t, te } from '../i18n';
import type { MiningConfig, MiningSessionHistoryItem } from '../types/mining';
const props = defineProps<{ config: MiningConfig; sessionHistory: MiningSessionHistoryItem[] }>();
const emit = defineEmits<{ deleteSession: [id: string]; clearSessions: [] }>();
const selected = ref<MiningSessionHistoryItem | null>(null);
const coinFilter = ref('');
const outcomeFilter = ref('');
const poolFilter = ref('');
const algorithmFilter = ref('');
const fromDate = ref('');
const toDate = ref('');
const includePool = ref(false);
const filterOpen = ref(false);
const exportOpen = ref(false);
type Range = '7' | '30' | 'all';
const range = ref<Range>('all');
const rangeOptions = computed<Array<{ value: Range; label: string }>>(() => [
  { value: '7', label: t('history.range7') },
  { value: '30', label: t('history.range30') },
  { value: 'all', label: t('history.rangeAll') }
]);
const rangeStart = computed(() =>
  range.value === 'all' ? 0 : Date.now() - Number(range.value) * 86_400_000
);
const exportPreview = ref('');
const exportFeedback = ref('');
const runs = computed(() =>
  props.sessionHistory.filter(
    (run) =>
      new Date(run.endedAt).getTime() >= rangeStart.value &&
      (!coinFilter.value || run.coinSymbol === coinFilter.value) &&
      (!outcomeFilter.value || run.reasonCode === outcomeFilter.value) &&
      (!algorithmFilter.value || run.algorithm === algorithmFilter.value) &&
      (!poolFilter.value || run.pool === poolFilter.value) &&
      (!fromDate.value || new Date(run.startedAt).toLocaleDateString('en-CA') >= fromDate.value) &&
      (!toDate.value || new Date(run.startedAt).toLocaleDateString('en-CA') <= toDate.value)
  )
);
const distinct = (pick: (run: MiningSessionHistoryItem) => string | undefined) => [
  ...new Set(props.sessionHistory.map(pick).filter((value): value is string => Boolean(value)))
];
const outcomeLabel = (code?: string): string =>
  code ? (te(`outcome.${code}`) ? t(`outcome.${code}`) : code.replace(/_/g, ' ')) : '';
const choices = (values: string[], all: string, label = (value: string) => value) => [
  { value: '', label: all },
  ...values.map((value) => ({ value, label: label(value) }))
];
const coinOptions = computed(() =>
  choices(
    distinct((run) => run.coinSymbol),
    t('history.allCoins')
  )
);
const algorithmOptions = computed(() =>
  choices(
    distinct((run) => run.algorithm),
    t('history.allAlgorithms')
  )
);
const poolOptions = computed(() =>
  choices(
    distinct((run) => run.pool),
    t('history.allPools')
  )
);
const outcomeOptions = computed(() =>
  choices(
    distinct((run) => run.reasonCode),
    t('history.allOutcomes'),
    outcomeLabel
  )
);
const activeFilters = computed(
  () =>
    [coinFilter, outcomeFilter, poolFilter, algorithmFilter, fromDate, toDate].filter(
      (filter) => filter.value
    ).length
);
const resetFilters = () => {
  coinFilter.value = outcomeFilter.value = poolFilter.value = algorithmFilter.value = '';
  fromDate.value = toDate.value = '';
};
const accepted = computed(() => runs.value.reduce((a, r) => a + r.acceptedShares, 0));
const rejected = computed(() => runs.value.reduce((a, r) => a + r.rejectedShares, 0));
const shares = computed(() => accepted.value + rejected.value);
const measured = computed(() => compatibleAverage(runs.value, props.config.coin.xmrigAlgo));
const average = computed(() => measured.value.average);
const trend = computed(() => {
  const list = runs.value.slice(0, 14).reverse();
  const max = Math.max(0, ...list.map((run) => run.averageHashrate || 0));
  return {
    bars: list.map((run) => ({
      id: run.id,
      height: max ? Math.max(0.04, (run.averageHashrate || 0) / max) : 0.04,
      label: `${dateTime(run.endedAt)} · ${formatHashrate(run.averageHashrate)}`
    })),
    peak: formatHashrate(max)
  };
});
function prepareExport() {
  exportPreview.value = JSON.stringify(exportHistory(runs.value, includePool.value), null, 2);
  exportFeedback.value = '';
}
async function copyExport() {
  try {
    await Clipboard.write({ string: exportPreview.value });
    exportFeedback.value = t('history.copied');
  } catch {
    exportFeedback.value = t('history.copyFailed');
  }
}
const seconds = computed(() => runs.value.reduce((a, r) => a + r.durationSeconds, 0));
const dateTime = (value: number | string): string =>
  formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
const removeRun = (run: MiningSessionHistoryItem) => {
  if (!window.confirm(t('dashboard.confirmDelete'))) return;
  emit('deleteSession', run.id);
  if (selected.value?.id === run.id) selected.value = null;
};
const clearAll = () => {
  if (window.confirm(t('dashboard.confirmClear'))) emit('clearSessions');
};
function openExport() {
  exportOpen.value = true;
  prepareExport();
}
const panel = ref<HTMLElement | null>(null);
const filterPanel = ref<HTMLElement | null>(null);
const exportPanel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => Boolean(selected.value),
  panel,
  () => {
    selected.value = null;
  }
);
useDialogFocus(
  () => filterOpen.value,
  filterPanel,
  () => {
    filterOpen.value = false;
  }
);
useDialogFocus(
  () => exportOpen.value,
  exportPanel,
  () => {
    exportOpen.value = false;
  }
);
</script>
<template>
  <div class="app-page phone-page insights-page md:grid md:grid-cols-2 md:items-start">
    <header class="screen-heading">
      <h1>{{ $t('header.statistics') }}</h1>
      <p>{{ $t('history.subtitle') }}</p>
    </header>

    <div class="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center md:col-span-2">
      <div
        class="grid flex-1 grid-cols-3 gap-1 rounded-full bg-app-elevated p-1"
        role="group"
        :aria-label="$t('history.rangeLabel')"
      >
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          type="button"
          class="min-h-10 min-w-0 truncate rounded-full px-2 text-[0.8125rem] font-semibold transition-colors duration-200"
          :class="range === option.value ? 'bg-app-on text-app-bg shadow-sm' : 'text-app-muted'"
          :aria-pressed="range === option.value"
          @click="range = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2 min-[480px]:flex">
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-app-line px-4 text-sm font-semibold"
          @click="filterOpen = true"
        >
          <MaterialIcon name="tune" :size="20" />{{ $t('history.filters') }}
          <b
            v-if="activeFilters"
            class="grid h-5 min-w-5 place-items-center rounded-full bg-app-green px-1.5 text-xs text-black"
            >{{ activeFilters }}</b
          >
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-app-line px-4 text-sm font-semibold disabled:opacity-45"
          :disabled="!runs.length"
          @click="openExport"
        >
          <MaterialIcon name="ios_share" :size="20" />{{ $t('history.export') }}
        </button>
      </div>
    </div>

    <section
      class="min-w-0 rounded-[28px] border border-app-line bg-app-card bg-[radial-gradient(110%_80%_at_100%_0%,rgb(var(--color-app-green)/0.16),transparent_60%)] p-5 md:col-span-2 md:grid md:grid-cols-2 md:items-center md:gap-8"
    >
      <div class="grid gap-2">
        <span class="eyebrow">{{
          $t('history.measuredAverage', { symbol: config.coin.symbol })
        }}</span>
        <p
          class="text-[clamp(2.25rem,12vw,3.75rem)] leading-none font-light tracking-tighter tabular-nums"
        >
          {{ formatHashrate(average) }}
        </p>
        <p class="section-copy">
          {{
            measured.runs
              ? $t('history.weighted', {
                  samples: measured.samples,
                  runs: measured.runs,
                  algorithm: config.coin.xmrigAlgo
                })
              : $t('history.baseline')
          }}
          {{ $t('history.excluded') }}
        </p>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-2 md:mt-0" :aria-label="$t('history.totals')">
        <div class="grid min-w-0 gap-1 rounded-2xl bg-app-elevated p-3.5">
          <dt class="eyebrow">{{ $t('history.completed') }}</dt>
          <dd class="m-0 grid gap-0.5">
            <strong class="text-2xl font-semibold tracking-tight tabular-nums">{{
              formatNumber(runs.length)
            }}</strong>
            <span class="text-xs text-app-muted">{{
              $t('history.totalRuntime', { duration: formatDuration(seconds) })
            }}</span>
          </dd>
        </div>
        <div class="grid min-w-0 gap-1 rounded-2xl bg-app-elevated p-3.5">
          <dt class="eyebrow">{{ $t('session.acceptedShares') }}</dt>
          <dd class="m-0 grid gap-0.5">
            <strong
              class="text-2xl font-semibold tracking-tight tabular-nums"
              :class="{ 'text-app-green-ink': accepted > 0 }"
              >{{ formatNumber(accepted) }}</strong
            >
            <span class="text-xs text-app-muted">{{
              shares
                ? $t('history.acceptance', { percent: ((accepted / shares) * 100).toFixed(1) })
                : $t('history.noSharesYet')
            }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <section
      v-if="trend.bars.length"
      class="grid min-w-0 content-start gap-4 rounded-[28px] border border-app-line bg-app-card p-5"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="eyebrow">{{ $t('history.trend') }}</span>
        <span class="text-xs font-semibold text-app-muted tabular-nums">{{ trend.peak }}</span>
      </div>
      <div
        class="flex h-32 items-end gap-1.5 border-b border-app-line bg-[linear-gradient(rgb(var(--color-app-line)),transparent_1px)] bg-[length:100%_25%]"
        role="img"
        :aria-label="$t('history.trend')"
      >
        <span
          v-for="bar in trend.bars"
          :key="bar.id"
          class="bar-rise max-w-7 min-w-0 flex-1 origin-bottom rounded-t-lg rounded-b-[3px] bg-gradient-to-t from-app-green/35 to-app-green opacity-60 last:opacity-100"
          :style="{ height: `${bar.height * 100}%` }"
          :title="bar.label"
        />
      </div>
    </section>

    <section
      class="grid min-w-0 content-start gap-3 rounded-[28px] border border-app-line bg-app-card p-5"
      :class="trend.bars.length ? '' : 'md:col-span-2'"
    >
      <div class="flex items-center justify-between gap-3">
        <h3 class="m-0 text-base font-semibold">{{ $t('history.shareQuality') }}</h3>
        <span class="eyebrow">{{ $t('history.totalBadge', { count: shares }) }}</span>
      </div>
      <template v-if="shares">
        <p class="m-0 text-4xl leading-none font-light tracking-tighter tabular-nums">
          {{ ((accepted / shares) * 100).toFixed(1) }}<span class="text-xl text-app-muted">%</span>
        </p>
        <div
          class="flex h-3 gap-0.5 overflow-hidden rounded-full bg-app-elevated"
          role="img"
          :aria-label="$t('history.shareMeter', { accepted, rejected })"
        >
          <span class="bg-app-green" :style="{ width: `${(accepted / shares) * 100}%` }" /><span
            class="bg-[var(--danger)]"
            :style="{ width: `${(rejected / shares) * 100}%` }"
          />
        </div>
        <div class="flex flex-wrap justify-between gap-x-3 text-xs text-app-muted">
          <span>{{ $t('run.acceptedCount', { count: accepted }) }}</span
          ><span>{{ $t('run.rejectedCount', { count: rejected }) }}</span>
        </div>
      </template>
      <p v-else class="section-copy">{{ $t('history.noShares') }}</p>
    </section>

    <LeaderboardCard class="md:col-span-2" />

    <section class="grid min-w-0 gap-3 md:col-span-2">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="m-0 text-base font-semibold">{{ $t('history.sessionHistory') }}</h3>
          <span class="eyebrow mt-1">{{ $t('history.runsBadge', { count: runs.length }) }}</span>
        </div>
        <button
          v-if="sessionHistory.length"
          class="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--danger)]"
          type="button"
          @click="clearAll"
        >
          <MaterialIcon name="delete_sweep" :size="18" />{{ $t('dashboard.clearHistory') }}
        </button>
      </div>
      <div v-if="!runs.length" class="empty-state">
        <MaterialIcon name="history" :size="32" /><strong>{{ $t('dashboard.noRuns') }}</strong>
        <p>{{ $t('history.emptyBody') }}</p>
        <button v-if="activeFilters" class="text-button" @click="resetFilters">
          {{ $t('history.reset') }}
        </button>
      </div>
      <ul class="m-0 grid list-none gap-2 p-0 lg:grid-cols-2">
        <li
          v-for="run in runs"
          :key="run.id"
          class="flex min-w-0 items-stretch rounded-[20px] border border-app-line bg-app-card"
        >
          <button
            type="button"
            class="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 p-3.5 text-left min-[360px]:grid-cols-[auto_minmax(0,1fr)_auto]"
            @click="selected = run"
          >
            <CoinIcon
              :symbol="run.coinSymbol"
              :size="40"
              class="row-span-2 min-[360px]:row-span-1"
            />
            <span class="grid min-w-0 gap-0.5">
              <strong class="text-[0.8125rem] font-semibold"
                >{{ run.coinSymbol }} · {{ formatDuration(run.durationSeconds) }}</strong
              >
              <small class="text-xs text-app-muted">{{ dateTime(run.endedAt) }}</small>
              <small class="text-xs text-app-muted">{{
                $t('history.runLine', {
                  accepted: run.acceptedShares,
                  rejected: run.rejectedShares
                })
              }}</small>
            </span>
            <b
              class="col-start-2 text-sm font-semibold tabular-nums min-[360px]:col-start-auto min-[360px]:text-right"
              >{{ formatHashrate(run.averageHashrate) }}</b
            >
          </button>
          <button
            type="button"
            class="grid w-11 shrink-0 place-items-center rounded-r-[20px] text-app-muted hover:text-[var(--danger)] focus-visible:text-[var(--danger)]"
            :aria-label="$t('dashboard.deleteSession')"
            @click="removeRun(run)"
          >
            <MaterialIcon name="delete" :size="20" />
          </button>
        </li>
      </ul>
    </section>

    <details
      class="stat-note rounded-[28px] border border-app-line bg-app-card px-5 py-3 md:col-span-2"
    >
      <summary>{{ $t('history.compare') }}</summary>
      <p class="section-copy">{{ $t('history.compareBody') }}</p>
    </details>
    <div
      v-if="selected"
      class="modal-backdrop"
      @click.self="selected = null"
      @keydown.esc="selected = null"
    >
      <section
        ref="panel"
        tabindex="-1"
        class="detail-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('run.details')"
      >
        <div class="section-heading">
          <h3>{{ $t('run.sessionTitle', { symbol: selected.coinSymbol }) }}</h3>
          <button
            class="outline-button"
            :aria-label="$t('run.closeDetails')"
            @click="selected = null"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <p v-if="selected.endReason" class="section-copy" role="status">{{ selected.endReason }}</p>
        <dl class="definition-list">
          <div>
            <dt>{{ $t('run.started') }}</dt>
            <dd>{{ dateTime(selected.startedAt) }}</dd>
          </div>
          <div>
            <dt>{{ $t('run.ended') }}</dt>
            <dd>{{ dateTime(selected.endedAt) }}</dd>
          </div>
          <div>
            <dt>{{ $t('run.duration') }}</dt>
            <dd>{{ formatDuration(selected.durationSeconds) }}</dd>
          </div>
          <div>
            <dt>{{ $t('run.avgRecordedShort') }}</dt>
            <dd>
              {{ formatHashrate(selected.averageHashrate)
              }}<small v-if="selected.sampleCount !== undefined">
                ·
                {{
                  $t('run.samplesWindow', {
                    count: selected.sampleCount,
                    seconds: selected.sampleWindowSeconds
                  })
                }}</small
              >
            </dd>
          </div>
          <div>
            <dt>{{ $t('run.acceptedRejected') }}</dt>
            <dd>{{ selected.acceptedShares }} / {{ selected.rejectedShares }}</dd>
          </div>
          <div>
            <dt>{{ $t('history.acceptanceRow') }}</dt>
            <dd>
              {{
                selected.acceptedShares + selected.rejectedShares
                  ? (
                      (selected.acceptedShares /
                        (selected.acceptedShares + selected.rejectedShares)) *
                      100
                    ).toFixed(1) + '%'
                  : $t('history.noSharesRow')
              }}
            </dd>
          </div>
        </dl>
        <section v-if="selected.protectionEvents?.length" class="dv-group">
          <h4 class="eyebrow">{{ $t('protection.events') }}</h4>
          <p v-if="selected.protectionSeconds" class="section-copy">
            {{
              $t('protection.durations', {
                caution: formatDuration(selected.protectionSeconds.caution),
                throttled: formatDuration(selected.protectionSeconds.throttled)
              })
            }}
          </p>
          <ProtectionEventList :events="selected.protectionEvents" />
        </section>
        <button class="outline-button danger-text" @click="removeRun(selected)">
          <MaterialIcon name="delete" :size="20" />{{ $t('dashboard.deleteSession') }}
        </button>
      </section>
    </div>
    <div v-if="filterOpen" class="modal-backdrop" @click.self="filterOpen = false">
      <section
        ref="filterPanel"
        tabindex="-1"
        class="detail-sheet st-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('history.filter')"
      >
        <div class="section-heading">
          <h3>{{ $t('history.filters') }}</h3>
          <button
            class="outline-button"
            :aria-label="$t('select.close')"
            @click="filterOpen = false"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <div class="st-filter-grid">
          <ConfigSelect
            v-model="coinFilter"
            :label="$t('history.coinSymbol')"
            :options="coinOptions"
          />
          <ConfigSelect
            v-model="algorithmFilter"
            :label="$t('history.algorithm')"
            :options="algorithmOptions"
          />
          <ConfigSelect v-model="poolFilter" :label="$t('history.pool')" :options="poolOptions" />
          <ConfigSelect
            v-model="outcomeFilter"
            :label="$t('history.outcome')"
            :options="outcomeOptions"
          />
          <label class="config-field"
            ><span class="config-label">{{ $t('history.fromDate') }}</span
            ><input v-model="fromDate" class="config-input" type="date"
          /></label>
          <label class="config-field"
            ><span class="config-label">{{ $t('history.throughDate') }}</span
            ><input v-model="toDate" class="config-input" type="date"
          /></label>
        </div>
        <div class="st-sheet-actions">
          <button class="outline-button" :disabled="!activeFilters" @click="resetFilters">
            {{ $t('history.reset') }}
          </button>
          <button class="primary-button" @click="filterOpen = false">
            {{ $t('history.showRuns', { count: runs.length }) }}
          </button>
        </div>
      </section>
    </div>
    <div v-if="exportOpen" class="modal-backdrop" @click.self="exportOpen = false">
      <section
        ref="exportPanel"
        tabindex="-1"
        class="detail-sheet st-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('history.export')"
      >
        <div class="section-heading">
          <h3>{{ $t('history.export') }}</h3>
          <button
            class="outline-button"
            :aria-label="$t('select.close')"
            @click="exportOpen = false"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <p class="section-copy">{{ $t('history.reviewBefore') }}</p>
        <label class="st-check"
          ><input v-model="includePool" type="checkbox" @change="prepareExport" />
          <span>{{ $t('history.includePool') }}</span></label
        >
        <pre class="st-preview" tabindex="0">{{ exportPreview }}</pre>
        <p v-if="exportFeedback" role="status" class="section-copy">{{ exportFeedback }}</p>
        <div class="st-sheet-actions">
          <button class="primary-button" @click="copyExport">
            <MaterialIcon name="content_copy" :size="20" />{{ $t('history.copyJson') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
