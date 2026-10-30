<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

interface StatCardProps {
  label: string;
  value: string;
  supportingText?: string;
  icon?: string;
  tone?: 'normal' | 'warning' | 'good';
}

withDefaults(defineProps<StatCardProps>(), {
  supportingText: '',
  icon: '',
  tone: 'normal'
});
</script>

<template>
  <article class="stat-card">
    <div class="mb-3 flex items-start justify-between gap-2">
      <p class="min-w-0 text-[0.75rem] font-medium leading-4 text-app-muted">{{ label }}</p>
      <MaterialIcon
        v-if="icon"
        :name="icon"
        :size="20"
        :class="{
          'text-app-green': tone === 'good',
          'text-app-yellow': tone === 'warning',
          'text-app-muted': tone === 'normal'
        }"
      />
    </div>
    <p class="break-words text-[1.5rem] font-semibold leading-7 text-app-on">{{ value }}</p>
    <p v-if="supportingText" class="mt-1 text-[0.75rem] leading-[1.125rem] text-app-muted">
      {{ supportingText }}
    </p>
  </article>
</template>
