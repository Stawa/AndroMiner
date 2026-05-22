<script setup lang="ts">
import { computed } from 'vue';

interface StatusIndicatorProps {
  connected: boolean;
  label?: string;
  tone?: 'good' | 'warning' | 'danger' | 'muted';
}

const props = withDefaults(defineProps<StatusIndicatorProps>(), {
  label: '',
  tone: undefined
});

const toneClasses: Record<NonNullable<StatusIndicatorProps['tone']>, string> = {
  good: 'text-app-green',
  warning: 'text-app-yellow',
  danger: 'text-red-300',
  muted: 'text-app-muted'
};

const dotClasses: Record<NonNullable<StatusIndicatorProps['tone']>, string> = {
  good: 'bg-app-green',
  warning: 'bg-app-yellow',
  danger: 'bg-red-300',
  muted: 'bg-app-muted'
};

const resolvedTone = computed(() => props.tone || (props.connected ? 'good' : 'warning'));
</script>

<template>
  <span
    class="inline-flex min-w-0 items-center gap-1.5 text-[12px] leading-4"
    :class="toneClasses[resolvedTone]"
  >
    <span class="h-2 w-2 shrink-0 rounded-full" :class="dotClasses[resolvedTone]" />
    <span class="truncate">{{ label || (connected ? 'Connected' : 'Reconnecting') }}</span>
  </span>
</template>
