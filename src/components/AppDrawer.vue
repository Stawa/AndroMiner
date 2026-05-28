<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAppVersion } from '../composables/useAppVersion';
import BrandLogo from './BrandLogo.vue';
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
  activeTab: AppTab;
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
  { label: 'Mining Setup', icon: 'handyman', tab: 'mining' },
  { label: 'Insights', icon: 'insights', tab: 'statistics' },
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
const { displayVersion, refreshAppVersion } = useAppVersion();
const versionLabel = computed(() => `Version ${displayVersion.value}`);
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

const isSelected = (item: DrawerItem): boolean => item.tab === props.activeTab;

const backdropStyle = (open: boolean): Record<string, string> => ({
  '--drawer-backdrop-opacity': open ? '1' : '0',
  '--drawer-backdrop-delay': '0s'
});

const drawerStyle = (open: boolean): Record<string, string> => ({
  '--drawer-y': open ? '0px' : '14px',
  '--drawer-scale': open ? '1' : '0.96',
  '--drawer-opacity': open ? '1' : '0',
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

onMounted(() => {
  void refreshAppVersion();
});

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
    <div class="flex items-center gap-3 border-b border-app-line pb-4">
      <div class="h-12 w-12 rounded-xl">
        <BrandLogo />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[17px] font-semibold leading-6 text-white">AndroMiner</p>
        <p class="text-[13px] leading-5 text-app-muted">{{ versionLabel }}</p>
      </div>
      <button
        class="ripple grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-muted active:bg-app-elevated"
        type="button"
        aria-label="Close menu"
        @click="emit('close')"
      >
        <MaterialIcon name="close" :size="22" />
      </button>
    </div>

    <nav class="mt-4 grid grid-cols-2 gap-2" aria-label="Primary navigation">
      <button
        v-for="item in primaryItems"
        :key="item.label"
        class="menu-tile ripple"
        :class="{ 'menu-tile-selected': isSelected(item) }"
        type="button"
        @click="selectItem(item)"
      >
        <span class="menu-tile-icon">
          <MaterialIcon :name="item.icon" :size="22" :filled="isSelected(item)" />
        </span>
        <span class="truncate">{{ item.label }}</span>
      </button>
    </nav>

    <nav
      class="mt-4 space-y-1 rounded-lg border border-app-line bg-app-elevated/45 p-1"
      aria-label="Profile and configuration"
    >
      <button
        v-for="item in secondaryItems.slice(0, 3)"
        :key="item.label"
        class="drawer-row ripple"
        :class="{ 'drawer-row-selected': isSelected(item) }"
        type="button"
        @click="selectItem(item)"
      >
        <span class="drawer-row-icon">
          <MaterialIcon :name="item.icon" :size="21" :filled="isSelected(item)" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
        <MaterialIcon
          v-if="isSelected(item)"
          class="shrink-0 text-app-green"
          name="check"
          :size="20"
        />
      </button>
    </nav>

    <nav
      class="mt-3 space-y-1 rounded-lg border border-app-line bg-app-elevated/45 p-1"
      aria-label="Support"
    >
      <button
        v-for="item in secondaryItems.slice(3)"
        :key="item.label"
        class="drawer-row ripple"
        :class="{ 'drawer-row-selected': isSelected(item) }"
        type="button"
        @click="selectItem(item)"
      >
        <span class="drawer-row-icon">
          <MaterialIcon :name="item.icon" :size="21" :filled="isSelected(item)" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
        <MaterialIcon
          v-if="isSelected(item)"
          class="shrink-0 text-app-green"
          name="check"
          :size="20"
        />
      </button>
    </nav>
  </aside>
</template>
