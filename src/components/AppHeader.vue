<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
import type { AppTab } from './BottomNav.vue';

interface AppHeaderProps {
  connected: boolean;
  activeTab: AppTab;
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
            <span
              class="h-2 w-2 rounded-full"
              :class="connected ? 'bg-app-green' : 'bg-app-yellow'"
            />
            {{ connected ? 'Pool connected' : 'Reconnecting' }}
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
