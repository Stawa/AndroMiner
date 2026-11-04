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
  <div class="app-page phone-page insights-page md:grid md:grid-cols-2 md:items-stretch">
    <header class="screen-heading">
      <h1>{{ $t('header.statistics') }}</h1>
      <p>{{ $t('history.subtitle') }}</p>
    </header>
    <div class="st-toolbar md:col-span-2">
      <div class="chip-row" role="group" :aria-label="$t('history.rangeLabel')">
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="range === option.value"
          @click="range = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="st-tools">
        <button class="st-tool" type="button" @click="filterOpen = true">
          <MaterialIcon name="tune" :size="20" />{{ $t('history.filters') }}
          <b v-if="activeFilters" class="st-count">{{ activeFilters }}</b>
        </button>
        <button class="st-tool" type="button" :disabled="!runs.length" @click="openExport">
          <MaterialIcon name="ios_share" :size="20" />{{ $t('history.export') }}
        </button>
      </div>
    </div>
    <section class="st-hero md:col-span-2">
      <span class="eyebrow">{{
        $t('history.measuredAverage', { symbol: config.coin.symbol })
      }}</span>
      <p class="st-number">{{ formatHashrate(average) }}</p>
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
      <dl class="st-kpis" :aria-label="$t('history.totals')">
        <div>
          <dt>{{ $t('history.completed') }}</dt>
          <dd>
            <strong>{{ formatNumber(runs.length) }}</strong>
            <span>{{ $t('history.totalRuntime', { duration: formatDuration(seconds) }) }}</span>
          </dd>
        </div>
        <div>
          <dt>{{ $t('session.acceptedShares') }}</dt>
          <dd>
            <strong :class="{ 'history-summary-positive': accepted > 0 }">{{
              formatNumber(accepted)
            }}</strong>
            <span>{{
              shares
                ? $t('history.acceptance', { percent: ((accepted / shares) * 100).toFixed(1) })
                : $t('history.noSharesYet')
            }}</span>
          </dd>
        </div>
      </dl>
    </section>
    <section v-if="trend.bars.length" class="st-chart md:col-span-2">
      <div class="st-chart-head">
        <span class="eyebrow">{{ $t('history.trend') }}</span>
        <span class="supporting-label">{{ trend.peak }}</span>
      </div>
      <div class="st-bars" role="img" :aria-label="$t('history.trend')">
        <span
          v-for="bar in trend.bars"
          :key="bar.id"
          :style="{ '--h': bar.height }"
          :title="bar.label"
        />
      </div>
    </section>
    <LeaderboardCard class="md:col-span-2" />
    <section class="surface">
      <div class="section-heading">
        <h3>{{ $t('history.shareQuality') }}</h3>
        <span class="supporting-label">{{ $t('history.totalBadge', { count: shares }) }}</span>
      </div>
      <template v-if="shares">
        <div
          class="share-meter"
          role="img"
          :aria-label="$t('history.shareMeter', { accepted, rejected })"
        >
          <span :style="{ width: `${(accepted / shares) * 100}%` }" /><span
            :style="{ width: `${(rejected / shares) * 100}%` }"
          />
        </div>
        <div class="share-legend">
          <span>{{ $t('run.acceptedCount', { count: accepted }) }}</span
          ><span>{{ $t('run.rejectedCount', { count: rejected }) }}</span>
        </div>
      </template>
      <p v-else class="section-copy">
        {{ $t('history.noShares') }}
      </p>
    </section>
    <section class="st-history md:col-span-2">
      <div class="section-heading">
        <div>
          <h3>{{ $t('history.sessionHistory') }}</h3>
          <span class="supporting-label">{{
            $t('history.runsBadge', { count: runs.length })
          }}</span>
        </div>
        <button v-if="sessionHistory.length" class="text-button danger-text" @click="clearAll">
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
      <ul class="st-runs">
        <li v-for="run in runs" :key="run.id" class="st-run">
          <button class="history-row" @click="selected = run">
            <CoinIcon :symbol="run.coinSymbol" :size="40" />
            <span
              ><strong>{{ run.coinSymbol }} · {{ formatDuration(run.durationSeconds) }}</strong
              ><small>{{ dateTime(run.endedAt) }}</small
              ><small>{{
                $t('history.runLine', {
                  accepted: run.acceptedShares,
                  rejected: run.rejectedShares
                })
              }}</small></span
            ><b>{{ formatHashrate(run.averageHashrate) }}</b>
          </button>
          <button
            class="st-remove"
            type="button"
            :aria-label="$t('dashboard.deleteSession')"
            @click="removeRun(run)"
          >
            <MaterialIcon name="delete" :size="20" />
          </button>
        </li>
      </ul>
    </section>
    <details class="surface">
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
