<script setup lang="ts">
import { computed } from 'vue';

interface Point {
  label: string;
  value: number;
}

const props = defineProps<{
  points: Point[];
  title: string;
  kind?: 'line' | 'bar';
  unit?: string;
}>();

const width = 640;
const height = 200;
const pad = { top: 12, right: 12, bottom: 26, left: 44 };

const max = computed(() => Math.max(1, ...props.points.map((point) => point.value)));
const innerWidth = width - pad.left - pad.right;
const innerHeight = height - pad.top - pad.bottom;

const xFor = (index: number): number =>
  props.points.length < 2
    ? pad.left + innerWidth / 2
    : pad.left + (index / (props.points.length - 1)) * innerWidth;
const yFor = (value: number): number => pad.top + innerHeight - (value / max.value) * innerHeight;

const path = computed(() =>
  props.points
    .map((point, i) => `${i ? 'L' : 'M'}${xFor(i).toFixed(1)},${yFor(point.value).toFixed(1)}`)
    .join('')
);
const barWidth = computed(() =>
  Math.max(2, Math.min(40, innerWidth / Math.max(1, props.points.length) - 4))
);
const ticks = computed(() => [0, 0.5, 1].map((fraction) => Math.round(max.value * fraction)));
const edgeLabels = computed(() =>
  props.points.length ? [props.points[0], props.points[props.points.length - 1]] : []
);
const summary = computed(() =>
  props.points.length
    ? `${props.title}: ${props.points.map((p) => `${p.label} ${p.value}`).join(', ')}`
    : `${props.title}: no data yet`
);
</script>

<template>
  <figure class="chart">
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="summary">
      <g class="grid">
        <template v-for="tick in ticks" :key="tick">
          <line :x1="pad.left" :x2="width - pad.right" :y1="yFor(tick)" :y2="yFor(tick)" />
          <text :x="pad.left - 8" :y="yFor(tick) + 4" text-anchor="end">{{ tick }}</text>
        </template>
      </g>
      <template v-if="points.length">
        <path v-if="kind !== 'bar'" :d="path" class="series" />
        <template v-else>
          <rect
            v-for="(point, i) in points"
            :key="point.label"
            class="bar"
            :x="xFor(i) - barWidth / 2"
            :y="yFor(point.value)"
            :width="barWidth"
            :height="pad.top + innerHeight - yFor(point.value)"
            rx="3"
          />
        </template>
        <circle
          v-if="kind !== 'bar' && points.length === 1"
          :cx="xFor(0)"
          :cy="yFor(points[0].value)"
          r="4"
          class="dot"
        />
      </template>
      <text
        v-for="(point, i) in edgeLabels"
        :key="point.label"
        class="axis"
        :x="i === 0 ? pad.left : width - pad.right"
        :y="height - 6"
        :text-anchor="i === 0 ? 'start' : 'end'"
      >
        {{ point.label }}
      </text>
      <text v-if="!points.length" class="axis" :x="width / 2" :y="height / 2" text-anchor="middle">
        Not enough data yet
      </text>
    </svg>
    <figcaption class="sr-only">{{ summary }}</figcaption>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.grid line {
  stroke: rgb(var(--color-app-line));
  stroke-width: 1;
}
text {
  fill: rgb(var(--color-app-muted));
  font-size: 11px;
}
.series {
  fill: none;
  stroke: rgb(var(--color-app-green));
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.bar,
.dot {
  fill: rgb(var(--color-app-green));
}
</style>
