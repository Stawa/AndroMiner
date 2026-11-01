<script setup lang="ts">
import { computed } from 'vue';
import { useTweenedNumber } from '../composables/useTweenedNumber';

interface HashrateRingProps {
  value: number | null;
  peak: number | null;
  active: boolean;
}

const props = defineProps<HashrateRingProps>();

const dotCount = 72;
const radius = 120;
const dots = Array.from({ length: dotCount }, (_, index) => {
  const angle = (index / dotCount) * Math.PI * 2 - Math.PI / 2;
  return { x: 140 + radius * Math.cos(angle), y: 140 + radius * Math.sin(angle) };
});

const progress = computed(() =>
  props.value === null || !props.peak ? 0 : Math.min(1, props.value / props.peak)
);
const lit = computed(() => Math.round(progress.value * dotCount));
const shown = useTweenedNumber(() => props.value);
</script>

<template>
  <div class="relative mx-auto grid aspect-square w-full max-w-[300px] place-items-center">
    <svg class="absolute inset-0 h-full w-full" viewBox="0 0 280 280" aria-hidden="true">
      <circle
        v-for="(dot, index) in dots"
        :key="index"
        class="ring-dot"
        :class="{ 'ring-dot-on': index < lit, 'ring-dot-head': active && index === lit - 1 }"
        :cx="dot.x"
        :cy="dot.y"
        :r="index < lit ? 3.4 : 2.4"
      />
    </svg>
    <div class="relative z-10 grid place-items-center text-center">
      <div>
        <p class="eyebrow">{{ $t('hashrate.label') }}</p>
        <p class="ring-number">{{ shown === null ? '—' : shown.toFixed(1) }}</p>
        <p class="mt-1 text-sm font-medium text-app-muted">H/s</p>
      </div>
    </div>
  </div>
</template>
