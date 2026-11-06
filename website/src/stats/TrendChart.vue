<script setup lang="ts">
import { computed, ref } from 'vue';

interface Point {
  label: string;
  value: number;
}

const props = defineProps<{
  points: Point[];
  title: string;
  kind?: 'line' | 'bar';
}>();

const width = 640;
const height = 220;
const pad = { top: 16, right: 12, bottom: 28, left: 40 };
const innerWidth = width - pad.left - pad.right;
const innerHeight = height - pad.top - pad.bottom;

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat();

const formatLabel = (label: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    return new Date(`${label}-01T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    });
  }
  return label;
};

// A flat or empty series still gets a sensible scale; whole-number ticks only.
const niceMax = computed(() => {
  const peak = Math.max(1, ...props.points.map((point) => point.value));
  const step = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / step) * step;
});
const ticks = computed(() => [0, 0.5, 1].map((fraction) => Math.round(niceMax.value * fraction)));

const isBar = computed(() => props.kind === 'bar');
const slot = computed(() => innerWidth / Math.max(1, props.points.length));
const xFor = (index: number): number =>
  isBar.value || props.points.length < 2
    ? pad.left + slot.value * (index + 0.5)
    : pad.left + (index / (props.points.length - 1)) * innerWidth;
const yFor = (value: number): number =>
  pad.top + innerHeight - (value / niceMax.value) * innerHeight;
const barWidth = computed(() => Math.max(3, Math.min(36, slot.value * 0.7)));

const path = computed(() =>
  props.points
    .map((point, i) => `${i ? 'L' : 'M'}${xFor(i).toFixed(1)},${yFor(point.value).toFixed(1)}`)
    .join('')
);

const hovered = ref<number | null>(null);
const active = computed(() =>
  props.points.length ? (hovered.value ?? props.points.length - 1) : null
);
const readout = computed(() => (active.value === null ? null : props.points[active.value]));
const caption = computed(() => (hovered.value === null ? 'Latest' : 'Selected'));

const indexAt = (event: PointerEvent): number => {
  const box = (event.currentTarget as SVGElement).getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * width;
  const raw = isBar.value
    ? (x - pad.left) / slot.value - 0.5
    : ((x - pad.left) / innerWidth) * (props.points.length - 1);
  return Math.min(props.points.length - 1, Math.max(0, Math.round(raw)));
};
const onMove = (event: PointerEvent): void => {
  if (props.points.length) hovered.value = indexAt(event);
};
const onKey = (event: KeyboardEvent): void => {
  if (!props.points.length) return;
  const last = props.points.length - 1;
  const current = hovered.value ?? last;
  if (event.key === 'ArrowLeft') hovered.value = Math.max(0, current - 1);
  else if (event.key === 'ArrowRight') hovered.value = Math.min(last, current + 1);
  else if (event.key === 'Escape') hovered.value = null;
  else return;
  event.preventDefault();
};

const edgeLabels = computed(() =>
  props.points.length > 1
    ? [
        { text: formatLabel(props.points[0].label), x: pad.left, anchor: 'start' },
        {
          text: formatLabel(props.points[props.points.length - 1].label),
          x: width - pad.right,
          anchor: 'end'
        }
      ]
    : props.points.length === 1
      ? [{ text: formatLabel(props.points[0].label), x: xFor(0), anchor: 'middle' }]
      : []
);
const summary = computed(() =>
  props.points.length
    ? `${props.title}: ${props.points.map((p) => `${p.label} ${p.value}`).join(', ')}`
    : `${props.title}: no data yet`
);
</script>

<template>
  <figure class="m-0">
    <div class="mb-2 flex min-h-8 items-baseline gap-2.5" aria-live="polite">
      <template v-if="readout">
        <strong class="text-2xl font-extrabold tabular-nums">{{
          full.format(readout.value)
        }}</strong>
        <span class="text-[.8125rem] text-muted"
          >{{ caption }} · {{ formatLabel(readout.label) }}</span
        >
      </template>
      <span v-else class="text-[.8125rem] text-muted">No data yet</span>
    </div>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="block h-auto w-full touch-pan-y rounded-lg"
      role="img"
      tabindex="0"
      :aria-label="summary"
      @pointermove="onMove"
      @pointerleave="hovered = null"
      @keydown="onKey"
      @blur="hovered = null"
    >
      <g class="fill-muted text-[11px] tabular-nums [&_line]:stroke-line [&_line]:opacity-70">
        <template v-for="tick in ticks" :key="tick">
          <line :x1="pad.left" :x2="width - pad.right" :y1="yFor(tick)" :y2="yFor(tick)" />
          <text :x="pad.left - 8" :y="yFor(tick) + 4" text-anchor="end">
            {{ compact.format(tick) }}
          </text>
        </template>
      </g>
      <template v-if="points.length">
        <template v-if="isBar">
          <rect
            v-for="(point, i) in points"
            :key="point.label"
            class="fill-accent transition-opacity duration-100 motion-reduce:transition-none"
            :class="active !== i ? 'opacity-45' : ''"
            :x="xFor(i) - barWidth / 2"
            :y="yFor(point.value)"
            :width="barWidth"
            :height="Math.max(1, pad.top + innerHeight - yFor(point.value))"
            rx="3"
          />
        </template>
        <template v-else>
          <path
            v-if="points.length > 1"
            :d="path"
            class="fill-none stroke-accent stroke-[2.25] [stroke-linecap:round] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]"
          />
          <line
            v-if="hovered !== null"
            class="stroke-muted [stroke-dasharray:3_3]"
            :x1="xFor(hovered)"
            :x2="xFor(hovered)"
            :y1="pad.top"
            :y2="pad.top + innerHeight"
          />
          <circle
            v-if="active !== null"
            :cx="xFor(active)"
            :cy="yFor(points[active].value)"
            r="4.5"
            class="fill-accent stroke-surface stroke-2"
          />
        </template>
      </template>
      <text
        v-for="edge in edgeLabels"
        :key="edge.text"
        class="fill-muted text-[11px] tabular-nums"
        :x="edge.x"
        :y="height - 6"
        :text-anchor="edge.anchor"
      >
        {{ edge.text }}
      </text>
      <text
        v-if="!points.length"
        class="fill-muted text-[11px]"
        :x="width / 2"
        :y="height / 2"
        text-anchor="middle"
      >
        Not enough data yet
      </text>
    </svg>
    <figcaption class="sr-only">{{ summary }}</figcaption>
  </figure>
</template>
