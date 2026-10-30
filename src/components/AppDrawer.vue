<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAppVersion } from '../composables/useAppVersion';
import BrandLogo from './BrandLogo.vue';
import MaterialIcon from './MaterialIcon.vue';
import type { AppTab } from './BottomNav.vue';
import { useDialogFocus } from '../composables/useDialogFocus';

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
  { label: 'Overview', icon: 'speed', tab: 'dashboard' },
  { label: 'Miner', icon: 'tune', tab: 'mining' },
  { label: 'History', icon: 'history', tab: 'statistics' },
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
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => active.value,
  panel,
  () => emit('close')
);
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
    ref="panel"
    tabindex="-1"
    v-if="rendered"
    class="app-drawer"
    :class="{ 'app-drawer-open': active }"
    :style="drawerStyle(active)"
    :aria-hidden="!active"
    :inert="!active"
    role="dialog"
    aria-modal="true"
    aria-label="Application menu"
    @keydown.esc="emit('close')"
    @click.stop
  >
    <div class="flex items-center gap-3 border-b border-app-line pb-4">
      <div class="h-12 w-12 rounded-xl">
        <BrandLogo />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[1.0625rem] font-semibold leading-6 text-app-on">AndroMiner</p>
        <p class="text-[0.8125rem] leading-5 text-app-muted">{{ versionLabel }}</p>
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

    <p class="supporting-label menu-label">WORKSPACE</p>
    <nav class="menu-list" aria-label="Primary navigation">
      <button
        v-for="item in primaryItems"
        :key="item.label"
        class="drawer-row"
        :class="{ 'drawer-row-selected': isSelected(item) }"
        @click="selectItem(item)"
      >
        <MaterialIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span
        ><MaterialIcon v-if="isSelected(item)" name="check" :size="18" />
      </button>
    </nav>
    <p class="supporting-label menu-label">TOOLS & SUPPORT</p>
    <nav class="menu-list" aria-label="Tools and support">
      <button
        v-for="item in secondaryItems"
        :key="item.label"
        class="drawer-row"
        :class="{ 'drawer-row-selected': isSelected(item) }"
        @click="selectItem(item)"
      >
        <MaterialIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
