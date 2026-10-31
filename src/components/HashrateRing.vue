<script setup lang="ts">
import { computed } from 'vue';

interface HashrateRingProps {
  value: number | null;
  peak: number | null;
  active: boolean;
}

const props = defineProps<HashrateRingProps>();

const radius = 106;
const circumference = 2 * Math.PI * radius;
const progress = computed(() =>
  props.value === null || !props.peak ? 0 : Math.min(1, props.value / props.peak)
);
</script>

<template>
  <div class="relative mx-auto grid aspect-square w-full max-w-[286px] place-items-center">
    <svg class="absolute inset-0 h-full w-full" viewBox="0 0 280 280" aria-hidden="true">
      <circle
        cx="140"
        cy="140"
        r="124"
        fill="none"
        stroke="rgb(var(--color-app-line))"
        stroke-width="2"
      />
      <circle
        cx="140"
        cy="140"
        r="106"
        fill="none"
        stroke="rgb(var(--color-app-line))"
        stroke-width="18"
      />
      <circle
        class="origin-center -rotate-90 transition-all duration-700"
        cx="140"
        cy="140"
        :r="radius"
        fill="none"
        stroke="rgb(var(--color-app-green))"
        stroke-linecap="round"
        stroke-width="18"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - progress)"
      />
      <circle v-if="active" class="animate-ringPulse" cx="140" cy="34" r="5" fill="#5ad989" />
    </svg>
    <div
      class="relative z-10 grid h-[196px] w-[196px] place-items-center rounded-full border border-app-line bg-app-card text-center"
    >
      <div>
        <p class="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-app-muted">
          {{ $t('hashrate.label') }}
        </p>

        <p class="mt-3 text-[3rem] font-bold leading-none text-app-on">
          {{ value === null ? '—' : value.toFixed(1) }}
        </p>

        <p class="mt-1 text-sm font-medium text-app-muted">H/s</p>
      </div>
    </div>
  </div>
</template>
