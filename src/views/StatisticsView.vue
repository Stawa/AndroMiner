<script setup lang="ts">
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import { compatibleAverage, exportHistory } from '../utils/sessionHistory';
import { Clipboard } from '@capacitor/clipboard';
import ConfigInput from '../components/ConfigInput.vue';
import { formatHashrate } from '../utils/miningTelemetry';
import { formatDate, formatDuration, formatNumber, t, te } from '../i18n';
import type { MiningConfig, MiningSessionHistoryItem } from '../types/mining';
const props = defineProps<{ config: MiningConfig; sessionHistory: MiningSessionHistoryItem[] }>();
const selected = ref<MiningSessionHistoryItem | null>(null);
const coinFilter = ref('');
const outcomeFilter = ref('');
const poolFilter = ref('');
const algorithmFilter = ref('');
const fromDate = ref('');
const toDate = ref('');
const includePool = ref(false);
const exportPreview = ref('');
const exportFeedback = ref('');
const runs = computed(() =>
  props.sessionHistory.filter(
    (run) =>
      (!coinFilter.value ||
        run.coinSymbol.toLowerCase().includes(coinFilter.value.toLowerCase())) &&
      (!outcomeFilter.value || run.reasonCode === outcomeFilter.value) &&
      (!algorithmFilter.value || run.algorithm?.includes(algorithmFilter.value)) &&
      (!poolFilter.value || run.pool?.toLowerCase().includes(poolFilter.value.toLowerCase())) &&
      (!fromDate.value || new Date(run.startedAt).toLocaleDateString('en-CA') >= fromDate.value) &&
      (!toDate.value || new Date(run.startedAt).toLocaleDateString('en-CA') <= toDate.value)
  )
);
const outcomes = computed(() => [
  ...new Set(props.sessionHistory.map((run) => run.reasonCode).filter(Boolean))
]);
const accepted = computed(() => runs.value.reduce((a, r) => a + r.acceptedShares, 0));
const rejected = computed(() => runs.value.reduce((a, r) => a + r.rejectedShares, 0));
const shares = computed(() => accepted.value + rejected.value);
const measured = computed(() => compatibleAverage(runs.value, props.config.coin.xmrigAlgo));
const average = computed(() => measured.value.average);
const prepareExport = () => {
  exportPreview.value = JSON.stringify(exportHistory(runs.value, includePool.value), null, 2);
  exportFeedback.value = '';
};
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
const outcomeLabel = (code?: string): string =>
  code ? (te(`outcome.${code}`) ? t(`outcome.${code}`) : code.replace(/_/g, ' ')) : '';
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => Boolean(selected.value),
  panel,
  () => {
    selected.value = null;
  }
);
</script>
<template>
  <div
    class="app-page phone-page redesign-page insights-page md:grid md:grid-cols-2 md:items-stretch"
  >
    <header class="screen-heading">
      <h1>{{ $t('header.statistics') }}</h1>
      <p>{{ $t('history.subtitle') }}</p>
    </header>
    <details class="surface">
      <summary>{{ $t('history.filter') }}</summary>
      <div class="grid gap-3 md:grid-cols-2">
        <ConfigInput v-model="coinFilter" :label="$t('history.coinSymbol')" />
        <ConfigInput v-model="algorithmFilter" :label="$t('history.algorithm')" />
        <ConfigInput v-model="poolFilter" :label="$t('history.poolContains')" />
        <label class="config-field"
          ><span class="config-label">{{ $t('history.outcome') }}</span>
          <select v-model="outcomeFilter" class="config-input">
            <option value="">{{ $t('history.allOutcomes') }}</option>
            <option v-for="outcome in outcomes" :key="outcome" :value="outcome">
              {{ outcomeLabel(outcome) }}
            </option>
          </select>
        </label>
        <label class="config-field"
          ><span class="config-label">{{ $t('history.fromDate') }}</span
          ><input v-model="fromDate" class="config-input" type="date"
        /></label>
        <label class="config-field"
          ><span class="config-label">{{ $t('history.throughDate') }}</span
          ><input v-model="toDate" class="config-input" type="date"
        /></label>
      </div>
      <label class="section-copy"
        ><input v-model="includePool" type="checkbox" /> {{ $t('history.includePool') }}</label
      >
      <button class="outline-button" :disabled="!runs.length" @click="prepareExport">
        {{ $t('history.previewExport') }}
      </button>
      <div v-if="exportPreview">
        <p class="section-copy">
          {{ $t('history.reviewBefore') }}
        </p>
        <pre class="section-copy overflow-x-auto" tabindex="0">{{ exportPreview }}</pre>
        <button class="outline-button" @click="copyExport">{{ $t('history.copyJson') }}</button>
        <p role="status" class="section-copy">{{ exportFeedback }}</p>
      </div>
    </details>
    <dl class="history-summary" :aria-label="$t('history.totals')">
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
    <section class="surface">
      <div class="section-heading">
        <h3>{{ $t('history.measuredAverage', { symbol: config.coin.symbol }) }}</h3>
        <MaterialIcon name="speed" :size="20" />
      </div>
      <p class="measured-average">{{ formatHashrate(average) }}</p>
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
    </section>
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
    <section class="surface insights-history">
      <div class="section-heading">
        <h3>{{ $t('header.statistics') }}</h3>
        <span class="supporting-label">{{ $t('history.runsBadge', { count: runs.length }) }}</span>
      </div>
      <div v-if="!runs.length" class="empty-state">
        <MaterialIcon name="history" :size="32" /><strong>{{ $t('dashboard.noRuns') }}</strong>
        <p>{{ $t('history.emptyBody') }}</p>
      </div>
      <button v-for="run in runs" :key="run.id" class="history-row" @click="selected = run">
        <CoinIcon :symbol="run.coinSymbol" :size="34" />
        <span
          ><strong>{{ run.coinSymbol }} · {{ formatDuration(run.durationSeconds) }}</strong
          ><small>{{ dateTime(run.endedAt) }}</small
          ><small>{{
            $t('history.runLine', { accepted: run.acceptedShares, rejected: run.rejectedShares })
          }}</small></span
        ><b>{{ formatHashrate(run.averageHashrate) }}</b
        ><MaterialIcon name="chevron_right" :size="18" />
      </button>
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
      </section>
    </div>
  </div>
</template>
