<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
defineProps<{ title: string; message: string }>();
const emit = defineEmits<{ view: []; dismiss: [] }>();
</script>
<template>
  <div
    class="app-banner-wrap mx-auto w-full max-w-phone pt-layout md:max-w-workspace"
    role="status"
    aria-live="polite"
  >
    <div
      class="app-update-banner relative overflow-hidden rounded-panel border border-app-green/30 bg-app-card"
    >
      <button
        type="button"
        class="update-banner-link flex w-full items-center gap-3 p-4 pr-16 text-left"
        :aria-label="`${title}. ${message}. Open update details`"
        @click="emit('view')"
      >
        <span
          class="grid size-9 shrink-0 place-items-center rounded-control bg-app-green-dim text-app-green"
        >
          <MaterialIcon name="new_releases" :size="22" />
        </span>
        <span class="banner-copy min-w-0 [overflow-wrap:anywhere]">
          <strong class="block text-sm font-semibold">{{ title }}</strong>
          <span class="mt-1 block text-caption text-app-muted">{{ message }}</span>
        </span>
      </button>
      <button
        type="button"
        class="absolute right-2 top-1/2 inline-flex size-11 min-h-11 -translate-y-1/2 items-center justify-center rounded-control text-app-muted hover:bg-app-elevated"
        aria-label="Dismiss update notification"
        @click.stop="emit('dismiss')"
      >
        <MaterialIcon name="close" :size="20" />
      </button>
    </div>
  </div>
</template>
