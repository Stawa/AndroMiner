<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import type { AppTab } from './BottomNav.vue';

interface DrawerItem {
  label: string;
  icon: string;
  tab?: AppTab;
  action?: 'export' | 'import';
}

interface AppDrawerProps {
  open: boolean;
}

const props = defineProps<AppDrawerProps>();

const emit = defineEmits<{
  close: [];
  navigate: [value: AppTab];
  exportConfig: [];
  importConfig: [];
}>();

const primaryItems: DrawerItem[] = [
  { label: 'Dashboard', icon: 'space_dashboard', tab: 'dashboard' },
  { label: 'Mining setup', icon: 'handyman', tab: 'mining' },
  { label: 'Statistics', icon: 'bar_chart_4_bars', tab: 'statistics' },
  { label: 'Settings', icon: 'settings', tab: 'settings' }
];

const secondaryItems: DrawerItem[] = [
  { label: 'Profiles', icon: 'tune', tab: 'profiles' },
  { label: 'Export configuration', icon: 'upload_file', action: 'export' },
  { label: 'Import configuration', icon: 'download_for_offline', action: 'import' },
  { label: 'Help & support', icon: 'help', tab: 'help' },
  { label: 'About', icon: 'info', tab: 'about' }
];

const rendered = ref(props.open);
const active = ref(false);
let closeTimer = 0;
let openTimer = 0;

const clearCloseTimer = (): void => {
  if (closeTimer > 0) {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  }
};

const clearOpenTimer = (): void => {
  if (openTimer > 0) {
    window.clearTimeout(openTimer);
    openTimer = 0;
  }
};

const selectItem = (item: DrawerItem): void => {
  if (item.tab) {
    emit('navigate', item.tab);
  }

  if (item.action === 'export') {
    emit('exportConfig');
  }

  if (item.action === 'import') {
    emit('importConfig');
  }

  emit('close');
};

const backdropStyle = (open: boolean): Record<string, string> => ({
  '--drawer-backdrop-opacity': open ? '1' : '0',
  '--drawer-backdrop-delay': '0s'
});

const drawerStyle = (open: boolean): Record<string, string> => ({
  '--drawer-x': open ? '0%' : '-104%',
  '--drawer-opacity': open ? '1' : '0.64',
  '--drawer-delay': '0s, 0s'
});

watch(
  () => props.open,
  async (open) => {
    clearCloseTimer();
    clearOpenTimer();

    if (open) {
      rendered.value = true;
      active.value = false;
      await nextTick();
      openTimer = window.setTimeout(() => {
        active.value = true;
        openTimer = 0;
      }, 20);
      return;
    }

    active.value = false;
    closeTimer = window.setTimeout(() => {
      rendered.value = false;
      closeTimer = 0;
    }, 260);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  clearCloseTimer();
  clearOpenTimer();
});
</script>

<template>
  <div
    v-if="rendered"
    class="drawer-backdrop"
    :class="{ 'drawer-backdrop-open': active }"
    :style="backdropStyle(active)"
    @click="emit('close')"
  />
  <aside
    v-if="rendered"
    class="app-drawer"
    :class="{ 'app-drawer-open': active }"
    :style="drawerStyle(active)"
    :aria-hidden="!active"
    :inert="!active"
    @click.stop
  >
    <div class="flex items-center gap-3 border-b border-app-line pb-6">
      <div
        class="grid h-14 w-14 place-items-center rounded-full border-2 border-app-green text-app-green"
      >
        <MaterialIcon name="power_settings_new" :size="30" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-[18px] font-semibold leading-6 text-white">AndroMiner</p>
        <p class="text-[13px] leading-5 text-app-muted">Version 1.0.0</p>
      </div>
    </div>

    <nav class="mt-5 space-y-1">
      <button
        v-for="item in primaryItems"
        :key="item.label"
        class="drawer-row ripple"
        type="button"
        @click="selectItem(item)"
      >
        <MaterialIcon :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <nav class="mt-5 space-y-1 border-y border-app-line py-5">
      <button
        v-for="item in secondaryItems.slice(0, 3)"
        :key="item.label"
        class="drawer-row ripple"
        type="button"
        @click="selectItem(item)"
      >
        <MaterialIcon :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <nav class="mt-5 space-y-1">
      <button
        v-for="item in secondaryItems.slice(3)"
        :key="item.label"
        class="drawer-row ripple"
        type="button"
        @click="selectItem(item)"
      >
        <MaterialIcon :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
