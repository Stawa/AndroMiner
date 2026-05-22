<script setup lang="ts">
interface MiningMetricProps {
  label: string;
  value: string;
  tone?: 'normal' | 'good' | 'warning' | 'danger';
}

withDefaults(defineProps<MiningMetricProps>(), {
  tone: 'normal'
});
</script>

<template>
  <article class="min-w-0 rounded-xl bg-app-card p-3 text-center">
    <p class="truncate text-[11px] font-medium uppercase leading-4 text-app-muted">{{ label }}</p>
    <p
      class="mt-1 break-words text-[20px] font-semibold leading-6"
      :class="{
        'text-white': tone === 'normal',
        'text-app-green': tone === 'good',
        'text-app-yellow': tone === 'warning',
        'text-red-400': tone === 'danger'
      }"
    >
      {{ value }}
    </p>
  </article>
</template>
