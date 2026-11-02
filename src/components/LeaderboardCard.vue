<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Clipboard } from '@capacitor/clipboard';
import MaterialIcon from './MaterialIcon.vue';
import { useTelemetry } from '../composables/useTelemetry';
import { formatDuration, formatNumber, regionName } from '../i18n';
import type { LeaderboardEntry } from '../utils/telemetryClient';
import { countryFlag } from '../utils/countryFlag';

const PREVIEW_ROWS = 10;
// The service recomputes the ranking at most once a minute, so asking more often gains nothing.
const REFRESH_INTERVAL_MS = 60_000;

const telemetry = useTelemetry();
const entries = ref<LeaderboardEntry[] | null>(null);
const loading = ref(false);
const failed = ref(false);
const expanded = ref(false);
const copied = ref(false);

const state = computed(() => telemetry.state.value);
const joined = computed(
  () => telemetry.supported && state.value.enabled && state.value.share.activity
);
const me = computed(() => entries.value?.find((entry) => entry.id === telemetry.publicId.value));
const rows = computed(() =>
  expanded.value ? entries.value : entries.value?.slice(0, PREVIEW_ROWS)
);

const refresh = async (): Promise<void> => {
  loading.value = true;
  entries.value = await telemetry.fetchLeaderboard();
  failed.value = entries.value === null;
  loading.value = false;
};

const copyId = async (): Promise<void> => {
  try {
    await Clipboard.write({ string: telemetry.publicId.value });
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    copied.value = false;
  }
};

const countryLabel = (code: string | null): string => (code ? regionName(code) : '');

let refreshTimer: number | undefined;

onMounted(() => {
  if (!telemetry.supported) return;
  void refresh();
  refreshTimer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
});

onUnmounted(() => window.clearInterval(refreshTimer));
</script>

<template>
  <section v-if="telemetry.supported" class="surface leaderboard" aria-labelledby="board-title">
    <div class="section-heading">
      <h3 id="board-title">{{ $t('leaderboard.title') }}</h3>
      <MaterialIcon name="leaderboard" :size="20" />
    </div>

    <div v-if="joined && telemetry.publicId.value" class="board-me">
      <div class="board-me-id">
        <span class="eyebrow">{{ $t('leaderboard.yourId') }}</span>
        <strong class="board-code">{{ telemetry.publicId.value }}</strong>
      </div>
      <button
        class="outline-button"
        type="button"
        :aria-label="$t('leaderboard.copyId')"
        @click="copyId"
      >
        <MaterialIcon :name="copied ? 'check' : 'content_copy'" :size="18" />{{
          copied ? $t('leaderboard.copied') : $t('leaderboard.copyId')
        }}
      </button>
      <p class="board-me-stats">
        <b v-if="me">{{ $t('leaderboard.rank', { rank: me.rank }) }}</b>
        <b v-else-if="entries">{{ $t('leaderboard.unranked') }}</b>
        <span>{{
          $t('leaderboard.mined', {
            time: formatDuration(state.miningSeconds),
            shares: formatNumber(state.acceptedShares)
          })
        }}</span>
      </p>
    </div>
    <p v-else class="section-copy" role="note">
      {{ state.enabled ? $t('leaderboard.activityOff') : $t('leaderboard.off') }}
    </p>

    <p v-if="loading && !entries" class="section-copy" role="status">…</p>
    <p v-else-if="failed" class="section-copy" role="alert">{{ $t('leaderboard.unavailable') }}</p>
    <p v-else-if="entries && !entries.length" class="section-copy">{{ $t('leaderboard.empty') }}</p>
    <ol v-else-if="rows" class="board-list">
      <li v-for="entry in rows" :key="entry.id" :class="{ 'board-self': entry.id === me?.id }">
        <span class="board-rank">{{ entry.rank }}</span>
        <span class="board-flag" :title="countryLabel(entry.country)" aria-hidden="true">{{
          countryFlag(entry.country)
        }}</span>
        <span class="board-name">
          {{ entry.id }}<em v-if="entry.id === me?.id">{{ $t('leaderboard.you') }}</em>
        </span>
        <span class="board-value">{{ formatDuration(entry.miningSeconds) }}</span>
      </li>
    </ol>

    <div class="action-row">
      <button
        v-if="entries && entries.length > PREVIEW_ROWS"
        class="text-button"
        type="button"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t('leaderboard.showLess') : $t('leaderboard.showMore') }}
      </button>
      <button class="text-button" type="button" :disabled="loading" @click="refresh">
        <MaterialIcon name="refresh" :size="16" />{{ $t('leaderboard.refresh') }}
      </button>
    </div>
    <p class="section-copy">{{ $t('leaderboard.note') }}</p>
  </section>
</template>

<style scoped>
.leaderboard {
  display: grid;
  gap: 12px;
}
.board-me {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px 12px;
  padding: 14px;
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-control);
}
.board-me-id {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.board-code {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.board-me-stats {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  font-size: 0.8125rem;
  color: rgb(var(--color-app-muted));
}
.board-me-stats b {
  color: rgb(var(--color-app-green-ink));
}
.board-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.board-list li {
  display: grid;
  grid-template-columns: 2rem 1.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 8px;
  border-radius: var(--radius-control);
  font-variant-numeric: tabular-nums;
}
.board-list li.board-self {
  background: rgb(var(--color-app-green-dim));
}
.board-rank {
  color: rgb(var(--color-app-muted));
  font-weight: 600;
  text-align: right;
}
.board-flag {
  font-size: 1.25rem;
  line-height: 1;
  text-align: center;
}
.board-name {
  min-width: 0;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.board-name em {
  margin-left: 8px;
  font-size: 0.6875rem;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-app-green-ink));
}
.board-value {
  font-size: 0.8125rem;
  color: rgb(var(--color-app-muted));
}
</style>
