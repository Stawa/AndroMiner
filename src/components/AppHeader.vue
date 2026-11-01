<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import type { AppTab } from './BottomNav.vue';
import type { MinerBackendState } from '../composables/useMiningController';
import { t } from '../i18n';

interface AppHeaderProps {
  connected: boolean;
  sessionState?: string;
  activeTab: AppTab;
  backendState: MinerBackendState;
}

const props = defineProps<AppHeaderProps>();
const header = ref<HTMLElement | null>(null);
let sizeObserver: ResizeObserver | undefined;
onMounted(() => {
  sizeObserver = new ResizeObserver(() => {
    if (header.value)
      document.documentElement.style.setProperty(
        '--app-header-height',
        `${Math.ceil(header.value.getBoundingClientRect().height)}px`
      );
  });
  if (header.value) sizeObserver.observe(header.value);
});
onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  document.documentElement.style.removeProperty('--app-header-height');
});

const emit = defineEmits<{
  openDrawer: [];
  back: [];
  notifications: [];
}>();

const titles: Record<AppTab, string> = {
  dashboard: 'header.dashboard',
  mining: 'header.mining',
  statistics: 'header.statistics',
  device: 'nav.device',
  settings: 'nav.settings',
  profiles: 'nav.profiles',
  help: 'nav.helpSupport',
  about: 'nav.about'
};

const showBack = (): boolean =>
  props.activeTab === 'mining' ||
  props.activeTab === 'profiles' ||
  props.activeTab === 'help' ||
  props.activeTab === 'about';

const dashboardStatus = computed(() => {
  if (props.sessionState)
    return {
      label: t(`state.${props.sessionState}`),
      dot: props.sessionState === 'mining' ? 'bg-app-green' : 'bg-app-yellow',
      text: 'text-app-muted'
    };
  if (props.connected) {
    return { label: t('header.poolConnected'), dot: 'bg-app-green', text: 'text-app-muted' };
  }

  const labels: Record<MinerBackendState, { label: string; dot: string; text: string }> = {
    checking: { label: t('backend.checking'), dot: 'bg-app-yellow', text: 'text-app-muted' },
    ready: { label: t('backend.ready'), dot: 'bg-app-green', text: 'text-app-muted' },
    missing: { label: t('backend.missing'), dot: 'bg-app-yellow', text: 'text-app-muted' },
    downloading: { label: t('backend.downloading'), dot: 'bg-app-yellow', text: 'text-app-muted' },
    'web-unavailable': {
      label: t('backend.webUnavailable'),
      dot: 'bg-app-yellow',
      text: 'text-app-muted'
    },
    error: { label: t('backend.error'), dot: 'bg-red-300', text: 'text-red-300' }
  };

  return labels[props.backendState];
});
</script>

<template>
  <header ref="header" class="app-header sticky top-0 z-35 bg-app-bg pt-[var(--app-inset-top)]">
    <div class="app-header-inner mx-auto flex min-h-16 items-center justify-between gap-3 py-2.5">
      <div class="min-w-0">
        <div class="app-wordmark"><MaterialIcon name="memory" :size="23" />AndroMiner</div>
        <p class="header-section hidden md:block">
          {{ $t(titles[activeTab]) }}
        </p>
      </div>
      <div class="header-actions flex shrink-0 items-center gap-1.5">
        <span class="mr-3 hidden items-center gap-2 text-caption text-app-muted md:inline-flex"
          ><span class="h-2 w-2 rounded-full" :class="dashboardStatus.dot" />{{
            dashboardStatus.label
          }}</span
        >
        <button
          v-if="showBack()"
          class="outline-button"
          :aria-label="$t('nav.back')"
          @click="emit('back')"
        >
          <MaterialIcon name="arrow_back" :size="20" /></button
        ><button
          class="outline-button"
          :aria-label="$t('nav.openMenu')"
          @click="emit('openDrawer')"
        >
          <MaterialIcon name="menu" :size="20" />
        </button>
      </div>
    </div>
  </header>
</template>
