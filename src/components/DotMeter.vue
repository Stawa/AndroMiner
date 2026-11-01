<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number | null;
    count?: number;
    label?: string;
    tone?: 'accent' | 'warn' | 'danger' | 'muted';
  }>(),
  { count: 20, label: '', tone: 'accent' }
);

const lit = computed(() =>
  props.value === null ? 0 : Math.round(Math.min(1, Math.max(0, props.value)) * props.count)
);
</script>

<template>
  <div
    class="dot-meter"
    :data-tone="tone"
    role="img"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : true"
  >
    <span v-for="n in count" :key="n" :data-on="n <= lit" />
  </div>
</template>
