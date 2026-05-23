<script setup lang="ts">
import { computed } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import type { AppTab } from './BottomNav.vue';
import type { MinerBackendState } from '../composables/useMiningController';

interface AppHeaderProps {
  connected: boolean;
  activeTab: AppTab;
  backendState: MinerBackendState;
}

const props = defineProps<AppHeaderProps>();

const emit = defineEmits<{
  openDrawer: [];
  back: [];
  notifications: [];
}>();

const titles: Record<AppTab, string> = {
  dashboard: 'AndroMiner',
  mining: 'Mining setup',
  statistics: 'Statistics',
  settings: 'Settings',
  profiles: 'Profiles',
  help: 'Help & support',
  about: 'About'
};

const showBack = (): boolean =>
  props.activeTab === 'mining' ||
  props.activeTab === 'profiles' ||
  props.activeTab === 'help' ||
  props.activeTab === 'about';

const dashboardStatus = computed(() => {
  if (props.connected) {
    return { label: 'Pool connected', dot: 'bg-app-green', text: 'text-app-muted' };
  }

  const labels: Record<MinerBackendState, { label: string; dot: string; text: string }> = {
    checking: { label: 'Checking backend', dot: 'bg-app-yellow', text: 'text-app-muted' },
    ready: { label: 'Miner ready', dot: 'bg-app-green', text: 'text-app-muted' },
    missing: { label: 'Miner download required', dot: 'bg-app-yellow', text: 'text-app-muted' },
    downloading: { label: 'Downloading miner', dot: 'bg-app-yellow', text: 'text-app-muted' },
    'web-unavailable': {
      label: 'Android app required',
      dot: 'bg-app-yellow',
      text: 'text-app-muted'
    },
    error: { label: 'Miner stopped', dot: 'bg-red-300', text: 'text-red-300' }
  };

  return labels[props.backendState];
});
</script>

<template>
  <header
    class="sticky top-0 z-30 bg-app-bg/96 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur"
  >
    <div class="mx-auto w-full max-w-[420px]">
      <div class="flex h-16 items-center gap-2">
        <button
          class="top-icon-button"
          type="button"
          :aria-label="showBack() ? 'Back' : 'Open menu'"
          @click="showBack() ? emit('back') : emit('openDrawer')"
        >
          <MaterialIcon :name="showBack() ? 'arrow_back' : 'menu'" :size="25" />
        </button>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-[19px] font-semibold leading-6 text-white">
            {{ titles[props.activeTab] }}
          </h1>
          <p
            v-if="props.activeTab === 'dashboard'"
            class="mt-0.5 flex items-center gap-1.5 text-[12px] leading-4 text-app-muted"
          >
            <span class="h-2 w-2 rounded-full" :class="dashboardStatus.dot" />
            <span :class="dashboardStatus.text">{{ dashboardStatus.label }}</span>
          </p>
        </div>

        <button
          v-if="props.activeTab === 'dashboard'"
          class="top-icon-button"
          type="button"
          aria-label="Open notification settings"
          @click="emit('notifications')"
        >
          <MaterialIcon name="notifications" :size="23" />
        </button>
        <span v-else class="h-12 w-12 shrink-0" />
      </div>
    </div>
  </header>
</template>
