<script setup lang="ts">
import { computed } from 'vue';
import type { HistoryPoint } from '../types/mining';
const props = defineProps<{ points: HistoryPoint[] }>();
const values = computed(() =>
  props.points.map((p) => p.value).filter((v) => Number.isFinite(v) && v >= 0)
);
const rangeLabel = computed(() =>
  values.value.length
    ? `${Math.min(...values.value).toFixed(1)}–${Math.max(...values.value).toFixed(1)} H/s`
    : ''
);
const path = computed(() => {
  const a = values.value;
  const max = Math.max(1, ...a);
  return a
    .map(
      (v, i) =>
        (i ? 'L' : 'M') +
        ((i * 300) / Math.max(1, a.length - 1)).toFixed(1) +
        ' ' +
        (72 - (v / max) * 60).toFixed(1)
    )
    .join(' ');
});
</script>
<template>
  <div v-if="values.length > 1" class="sparkline">
    <svg
      v-if="values.length > 1"
      viewBox="0 0 300 80"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`Measured hashrate trend, ${rangeLabel}, ${points[0]?.label} to ${points[points.length - 1]?.label}`"
    >
      <path
        :d="path"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div v-if="values.length > 1" class="chart-caption">
      <small>{{ points[0]?.label }} – {{ points[points.length - 1]?.label }}</small
      ><small>{{ rangeLabel }}</small>
    </div>
  </div>
</template>
