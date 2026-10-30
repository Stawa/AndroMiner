<script setup lang="ts">
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import { formatHashrate } from '../utils/miningTelemetry';
import type { MiningConfig, MiningSessionHistoryItem } from '../types/mining';
const props = defineProps<{ config: MiningConfig; sessionHistory: MiningSessionHistoryItem[] }>();
const selected = ref<MiningSessionHistoryItem | null>(null);
const runs = computed(() => props.sessionHistory);
const accepted = computed(() => runs.value.reduce((a, r) => a + r.acceptedShares, 0));
const rejected = computed(() => runs.value.reduce((a, r) => a + r.rejectedShares, 0));
const shares = computed(() => accepted.value + rejected.value);
const measured = computed(() =>
  runs.value.filter(
    (r) =>
      r.coinSymbol === props.config.coin.symbol &&
      r.averageHashrate !== null &&
      r.durationSeconds > 0
  )
);
const average = computed(() =>
  measured.value.length
    ? measured.value.reduce((a, r) => a + r.averageHashrate! * r.durationSeconds, 0) /
      measured.value.reduce((a, r) => a + r.durationSeconds, 0)
    : null
);
const seconds = computed(() => runs.value.reduce((a, r) => a + r.durationSeconds, 0));
const duration = (s: number) =>
  s < 60 ? `${s}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
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
      <h1>Session history</h1>
      <p>Review measured results from completed sessions.</p>
    </header>
    <dl class="history-summary" aria-label="Session totals">
      <div>
        <dt>Completed runs</dt>
        <dd>
          <strong>{{ runs.length.toLocaleString() }}</strong>
          <span>{{ duration(seconds) }} total runtime</span>
        </dd>
      </div>
      <div>
        <dt>Accepted shares</dt>
        <dd>
          <strong :class="{ 'history-summary-positive': accepted > 0 }">{{
            accepted.toLocaleString()
          }}</strong>
          <span>{{
            shares ? ((accepted / shares) * 100).toFixed(1) + '% acceptance' : 'No shares yet'
          }}</span>
        </dd>
      </div>
    </dl>
    <section class="surface">
      <div class="section-heading">
        <h3>{{ config.coin.symbol }} measured average</h3>
        <MaterialIcon name="speed" :size="20" />
      </div>
      <p class="measured-average">{{ formatHashrate(average) }}</p>
      <p class="section-copy">
        {{
          measured.length
            ? `Weighted by runtime across ${measured.length} measured ${config.coin.symbol} runs.`
            : 'Complete a run with speed samples to establish a baseline.'
        }}
        Different algorithms are kept separate.
      </p>
    </section>
    <section class="surface">
      <div class="section-heading">
        <h3>Share quality</h3>
        <span class="supporting-label">{{ shares }} TOTAL</span>
      </div>
      <template v-if="shares">
        <div
          class="share-meter"
          role="img"
          :aria-label="`${accepted} accepted and ${rejected} rejected shares`"
        >
          <span :style="{ width: `${(accepted / shares) * 100}%` }" /><span
            :style="{ width: `${(rejected / shares) * 100}%` }"
          />
        </div>
        <div class="share-legend">
          <span>{{ accepted }} accepted</span><span>{{ rejected }} rejected</span>
        </div>
      </template>
      <p v-else class="section-copy">
        No shares recorded. The breakdown appears after a completed run reports shares.
      </p>
    </section>
    <section class="surface insights-history">
      <div class="section-heading">
        <h3>Session history</h3>
        <span class="supporting-label">{{ runs.length }} RUNS</span>
      </div>
      <div v-if="!runs.length" class="empty-state">
        <MaterialIcon name="history" :size="32" /><strong>No completed runs yet</strong>
        <p>Start mining from the dashboard. Stop your run to save its results here.</p>
      </div>
      <button v-for="run in runs" :key="run.id" class="history-row" @click="selected = run">
        <CoinIcon :symbol="run.coinSymbol" :size="34" />
        <span
          ><strong>{{ run.coinSymbol }} · {{ duration(run.durationSeconds) }}</strong
          ><small>{{ new Date(run.endedAt).toLocaleString() }}</small
          ><small
            >{{ run.acceptedShares }} accepted · {{ run.rejectedShares }} rejected</small
          ></span
        ><b>{{ formatHashrate(run.averageHashrate) }}</b
        ><MaterialIcon name="chevron_right" :size="18" />
      </button>
    </section>
    <details class="surface">
      <summary>How to compare your results</summary>
      <p class="section-copy">
        Compare runs using the same coin and pool. Change one CPU setting at a time, allow the miner
        to warm up, and watch measured speed alongside temperature and rejected shares. A faster
        short run may slow down as the phone warms.
      </p>
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
        aria-label="Session details"
      >
        <div class="section-heading">
          <h3>{{ selected.coinSymbol }} session</h3>
          <button
            class="outline-button"
            aria-label="Close session details"
            @click="selected = null"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <dl class="definition-list">
          <div>
            <dt>Started</dt>
            <dd>{{ new Date(selected.startedAt).toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Ended</dt>
            <dd>{{ new Date(selected.endedAt).toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{{ duration(selected.durationSeconds) }}</dd>
          </div>
          <div>
            <dt>Measured average</dt>
            <dd>{{ formatHashrate(selected.averageHashrate) }}</dd>
          </div>
          <div>
            <dt>Accepted / rejected</dt>
            <dd>{{ selected.acceptedShares }} / {{ selected.rejectedShares }}</dd>
          </div>
          <div>
            <dt>Acceptance</dt>
            <dd>
              {{
                selected.acceptedShares + selected.rejectedShares
                  ? (
                      (selected.acceptedShares /
                        (selected.acceptedShares + selected.rejectedShares)) *
                      100
                    ).toFixed(1) + '%'
                  : 'No shares'
              }}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
