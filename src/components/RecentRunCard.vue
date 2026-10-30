<script setup lang="ts">
import { computed } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import CoinIcon from './CoinIcon.vue';
import { formatHashrate } from '../utils/miningTelemetry';
import type { MiningSessionHistoryItem } from '../types/mining';

const props = defineProps<{ run: MiningSessionHistoryItem }>();
const emit = defineEmits<{ select: [run: MiningSessionHistoryItem] }>();
const ended = computed(() =>
  new Date(props.run.endedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
);
const runtime = computed(() => {
  const seconds = props.run.durationSeconds;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
});
</script>

<template>
  <button
    type="button"
    class="recent-run-card"
    :aria-label="`View ${run.coinSymbol} session from ${ended}`"
    @click="emit('select', run)"
  >
    <CoinIcon :symbol="run.coinSymbol" :size="36" />
    <span class="recent-run-identity">
      <strong>{{ run.coinSymbol }} session</strong>
      <time :datetime="run.endedAt">{{ ended }} · {{ runtime }}</time>
      <small
        >{{ run.acceptedShares.toLocaleString() }} accepted ·
        <span :class="{ 'text-app-yellow': run.rejectedShares > 0 }"
          >{{ run.rejectedShares.toLocaleString() }} rejected</span
        ></small
      >
    </span>
    <span class="recent-run-speed">
      <strong>{{ formatHashrate(run.averageHashrate) }}</strong>
      <small>Average speed</small>
    </span>
    <MaterialIcon name="chevron_right" :size="18" />
  </button>
</template>
