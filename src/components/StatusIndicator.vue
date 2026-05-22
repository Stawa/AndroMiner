<script setup lang="ts">
interface StatusIndicatorProps {
  connected: boolean;
  label?: string;
}

withDefaults(defineProps<StatusIndicatorProps>(), {
  label: ''
});
</script>

<template>
  <span
    class="inline-flex min-w-0 items-center gap-1.5 text-[12px] leading-4"
    :class="connected ? 'text-app-green' : 'text-app-yellow'"
  >
    <span
      class="h-2 w-2 shrink-0 rounded-full"
      :class="connected ? 'bg-app-green' : 'bg-app-yellow'"
    />
    <span class="truncate">{{ label || (connected ? 'Connected' : 'Reconnecting') }}</span>
  </span>
</template>
