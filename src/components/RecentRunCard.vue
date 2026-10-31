<script setup lang="ts">
import { computed } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import CoinIcon from './CoinIcon.vue';
import { formatHashrate } from '../utils/miningTelemetry';
import { formatDate, formatDuration, formatNumber } from '../i18n';
import type { MiningSessionHistoryItem } from '../types/mining';

const props = defineProps<{ run: MiningSessionHistoryItem }>();
const emit = defineEmits<{ select: [run: MiningSessionHistoryItem] }>();
const ended = computed(() =>
  formatDate(props.run.endedAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
);
const runtime = computed(() => formatDuration(props.run.durationSeconds));
</script>

<template>
  <button
    type="button"
    class="recent-run-card"
    :aria-label="$t('run.viewAria', { symbol: run.coinSymbol, date: ended })"
    @click="emit('select', run)"
  >
    <CoinIcon :symbol="run.coinSymbol" :size="36" />
    <span class="recent-run-identity">
      <strong>{{ $t('run.sessionTitle', { symbol: run.coinSymbol }) }}</strong>
      <time :datetime="run.endedAt">{{ ended }} · {{ runtime }}</time>
      <small
        >{{ $t('run.acceptedCount', { count: formatNumber(run.acceptedShares) }) }} ·
        <span :class="{ 'text-app-yellow': run.rejectedShares > 0 }">{{
          $t('run.rejectedCount', { count: formatNumber(run.rejectedShares) })
        }}</span></small
      >
    </span>
    <span class="recent-run-speed">
      <strong>{{ formatHashrate(run.averageHashrate) }}</strong>
      <small>{{ $t('run.averageSpeed') }}</small>
    </span>
    <MaterialIcon name="chevron_right" :size="18" />
  </button>
</template>
