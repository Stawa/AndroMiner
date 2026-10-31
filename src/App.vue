<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { validateMiningSetup } from './utils/configValidation';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import AppDrawer from './components/AppDrawer.vue';
import UpdateBanner from './components/UpdateBanner.vue';
import AppHeader from './components/AppHeader.vue';
import BottomNav, { type AppTab } from './components/BottomNav.vue';
import MaterialIcon from './components/MaterialIcon.vue';
import MinerDownloadWarningSheet from './components/MinerDownloadWarningSheet.vue';
import PhoneMiningRiskView from './components/PhoneMiningRiskView.vue';
import StartMiningWarningSheet from './components/StartMiningWarningSheet.vue';
import { useDeviceTelemetry } from './composables/useDeviceTelemetry';
import { useGitHubReleaseUpdater } from './composables/useGitHubReleaseUpdater';
import { useMiningController, type MinerBinaryVariant } from './composables/useMiningController';
import { useTelemetry } from './composables/useTelemetry';
import { useTheme } from './composables/useTheme';
import { t } from './i18n';
import { usePageSwipe } from './composables/usePageSwipe';
import { useProfilesStore } from './stores/profiles';
import { useSettingsStore, type SettingsState } from './stores/settings';
import DashboardView from './views/DashboardView.vue';
import AboutView from './views/AboutView.vue';
import HelpSupportView from './views/HelpSupportView.vue';
import MiningConfigView from './views/MiningConfigView.vue';
import MiningSessionView from './views/MiningSessionView.vue';
import ProfilesView from './views/ProfilesView.vue';
import SettingsView from './views/SettingsView.vue';
import StatisticsView from './views/StatisticsView.vue';
import SystemCheckView from './views/SystemCheckView.vue';
import type { MiningConfig, MiningProfile, SavedMiningProfile } from './types/mining';

const systemCheckKey = 'androminer-system-check-complete';
const phoneRiskWarningKey = 'androminer-phone-risk-warning-accepted';
const activeTab = ref<AppTab>('dashboard');
const drawerOpen = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const systemCheckComplete = ref(false);
const phoneRiskWarningAccepted = ref(localStorage.getItem(phoneRiskWarningKey) === 'true');
const minerDownloadWarningOpen = ref(false);
const minerDownloadError = ref('');
const startWarningOpen = ref(false);
const dataFeedback = ref('');
let removeBackListener: (() => Promise<void>) | undefined;
const updateBanner = ref({
  visible: false,
  title: '',
  message: ''
});
const miner = useMiningController();
const settings = useSettingsStore();
const profiles = useProfilesStore();
const { device } = useDeviceTelemetry();
const updater = useGitHubReleaseUpdater();
useTheme();
const telemetry = useTelemetry();
const sessionActive = computed(() => !['idle', 'error'].includes(miner.state.value));
const sessionFullscreen = ref(false);
const sessionView = ref<InstanceType<typeof MiningSessionView> | null>(null);
const pageSwipe = usePageSwipe<AppTab>(
  ['dashboard', 'mining', 'statistics', 'settings'],
  activeTab,
  () =>
    systemCheckComplete.value &&
    phoneRiskWarningAccepted.value &&
    !sessionFullscreen.value &&
    !drawerOpen.value
);
watch(sessionActive, (active) => {
  if (!active) sessionFullscreen.value = false;
});
const configAutosaveReady = ref(false);
let configAutosaveHandle = 0;
let lastNotifiedUpdateVersion = '';
const updateCheckIntervalMs = 10 * 60 * 1000;

interface ConfigBundle {
  version: 1;
  exportedAt: string;
  currentConfig: MiningConfig;
  profiles: SavedMiningProfile[];
  activeProfileId: string;
  settings: SettingsState;
}

const updateProfile = (profile: MiningProfile): void => {
  miner.updateProfile(profile);
};

const saveCurrentProfile = (name: string): void => {
  profiles.saveFromConfig(name, miner.config);
};

const applyProfile = (profile: SavedMiningProfile): void => {
  if (sessionActive.value) return;
  miner.applySavedProfile(profile);
  activeTab.value = 'mining';
};

const requestStartMining = (): void => {
  if (sessionActive.value || startWarningOpen.value || minerDownloadWarningOpen.value) return;
  if (Object.values(validateMiningSetup(miner.config)).some(Boolean)) {
    activeTab.value = 'mining';
    return;
  }
  if (miner.backendState.value === 'missing') {
    minerDownloadError.value = '';
    minerDownloadWarningOpen.value = true;
    return;
  }

  startWarningOpen.value = true;
};

const saveAndStartMining = (): void => {
  profiles.saveActiveConfig(miner.config);
  requestStartMining();
};

const confirmMinerDownloadAndStart = async (variant: MinerBinaryVariant): Promise<void> => {
  minerDownloadError.value = '';
  const ready = await miner.downloadMiner(variant);
  if (!ready) {
    minerDownloadError.value = miner.backendMessage.value;
    return;
  }

  minerDownloadWarningOpen.value = false;
  startWarningOpen.value = true;
};

const confirmStartMining = async (): Promise<void> => {
  startWarningOpen.value = false;
  activeTab.value = 'dashboard';
  await miner.startMining();
};

const requestResumeMining = (): void => {
  startWarningOpen.value = true;
};

const acceptPhoneRiskWarning = (): void => {
  phoneRiskWarningAccepted.value = true;
  localStorage.setItem(phoneRiskWarningKey, 'true');
};

const autosaveCurrentConfig = (): void => {
  if (!configAutosaveReady.value) {
    return;
  }

  profiles.saveActiveConfig(miner.config);
};

const scheduleConfigAutosave = (): void => {
  if (!configAutosaveReady.value) {
    return;
  }

  window.clearTimeout(configAutosaveHandle);
  configAutosaveHandle = window.setTimeout(autosaveCurrentConfig, 300);
};

const flushConfigAutosave = (): void => {
  window.clearTimeout(configAutosaveHandle);
  autosaveCurrentConfig();
};

const hideUpdateBanner = (): void => {
  updateBanner.value.visible = false;
};

const showUpdateBanner = (version: string): void => {
  updateBanner.value = {
    visible: true,
    title: t('app.updateAvailable'),
    message: t('app.updateReady', { version })
  };
};

const notifyForAvailableUpdate = (): void => {
  if (
    !settings.updates.autoUpdate ||
    updater.status.value !== 'ready' ||
    !updater.availableVersion.value
  ) {
    return;
  }

  if (lastNotifiedUpdateVersion === updater.availableVersion.value) {
    return;
  }

  lastNotifiedUpdateVersion = updater.availableVersion.value;
  showUpdateBanner(updater.availableVersion.value);
};

const runAutoUpdateCheck = (minIntervalMs = 0): void => {
  if (!settings.updates.autoUpdate) {
    return;
  }

  void updater.checkForUpdates({ minIntervalMs }).then(notifyForAvailableUpdate);
};

const checkUpdatesWhenVisible = (): void => {
  if (document.visibilityState !== 'visible') {
    return;
  }

  runAutoUpdateCheck(updateCheckIntervalMs);
};

const navigateToSetup = (): void => {
  activeTab.value = 'mining';
};

const navigateToStatistics = (): void => {
  activeTab.value = 'statistics';
};

const navigateToProfiles = (): void => {
  activeTab.value = 'profiles';
};

let pendingUpdateScroll = false;
const revealUpdateSettings = (): void => {
  if (!pendingUpdateScroll || activeTab.value !== 'settings') return;
  const updates = document.querySelector('.updates-card');
  if (updates) {
    updates.scrollIntoView({ block: 'start' });
    pendingUpdateScroll = false;
  }
};

const openUpdateSettings = async (): Promise<void> => {
  pendingUpdateScroll = true;
  activeTab.value = 'settings';
  hideUpdateBanner();
  await nextTick();
  revealUpdateSettings();
};

const completeSystemCheck = (): void => {
  systemCheckComplete.value = true;
  localStorage.setItem(systemCheckKey, 'true');
};

const createBundle = (): ConfigBundle => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  currentConfig: {
    ...miner.config,
    coin: { ...miner.config.coin }
  },
  profiles: profiles.profiles,
  activeProfileId: profiles.activeProfileId,
  settings: settings.$state
});

const performExport = async (): Promise<void> => {
  const fileName = `androminer-config-${new Date().toISOString().slice(0, 10)}.json`;
  const content = JSON.stringify(createBundle(), null, 2);

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });

    await Share.share({
      title: t('app.shareTitle'),
      text: t('app.shareText'),
      url: result.uri,
      dialogTitle: t('app.shareDialog')
    });
    return;
  }

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const exportConfig = async (): Promise<void> => {
  try {
    await performExport();
  } catch {
    dataFeedback.value = t('app.exportFailed');
  }
};

const openImportPicker = (): void => {
  if (sessionActive.value) {
    dataFeedback.value = t('app.importBlocked');
    return;
  }
  importInput.value?.click();
};

const isConfigBundle = (value: unknown): value is ConfigBundle => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ConfigBundle>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.profiles) &&
    Boolean(candidate.currentConfig) &&
    Boolean(candidate.settings)
  );
};

const importConfig = async (event: Event): Promise<void> => {
  if (sessionActive.value) {
    window.alert(t('app.importBlocked'));
    return;
  }
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (
      !isConfigBundle(parsed) ||
      !isMiningConfig(parsed.currentConfig) ||
      !parsed.profiles.every(
        (profile) =>
          profile &&
          typeof profile.id === 'string' &&
          typeof profile.name === 'string' &&
          isMiningConfig(profile.config)
      ) ||
      !parsed.settings ||
      typeof parsed.settings !== 'object'
    ) {
      throw new Error('Invalid configuration');
    }
    profiles.replaceAll(parsed.profiles, parsed.activeProfileId);
    settings.replace(parsed.settings);
    Object.assign(miner.config, parsed.currentConfig);
    dataFeedback.value = t('app.imported');
  } catch {
    dataFeedback.value = t('app.importFailed');
  }
};

const isMiningConfig = (value: unknown): value is MiningConfig => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as MiningConfig;
  return (
    Boolean(
      candidate.coin &&
      typeof candidate.coin.id === 'string' &&
      typeof candidate.coin.symbol === 'string'
    ) &&
    ['walletAddress', 'poolUrl', 'workerName', 'password', 'algorithm', 'protocol'].every(
      (key) => typeof candidate[key as keyof MiningConfig] === 'string'
    ) &&
    [
      'threadCount',
      'customThreadCount',
      'totalDetectedThreads',
      'poolPort',
      'thermalThreshold'
    ].every(
      (key) =>
        typeof candidate[key as keyof MiningConfig] === 'number' &&
        Number.isFinite(candidate[key as keyof MiningConfig])
    )
  );
};

watch(
  () => settings.performance.animationsEnabled,
  (enabled) => {
    document.documentElement.classList.toggle('motion-reduced', !enabled);
  },
  { immediate: true }
);

watch(
  [activeTab, systemCheckComplete, phoneRiskWarningAccepted, sessionActive],
  () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  },
  { flush: 'post' }
);

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    void NativeApp.addListener('backButton', () => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else if (sessionFullscreen.value) {
        void sessionView.value?.exitFullscreenMode();
      } else if (activeTab.value !== 'dashboard') {
        activeTab.value = 'dashboard';
      } else {
        void NativeApp.minimizeApp();
      }
    }).then((listener) => {
      removeBackListener = () => listener.remove();
    });
  }
  phoneRiskWarningAccepted.value = localStorage.getItem(phoneRiskWarningKey) === 'true';
  systemCheckComplete.value = localStorage.getItem(systemCheckKey) === 'true';
  settings.load();
  profiles.load();
  telemetry.start();

  if (profiles.profiles.length === 0) {
    profiles.createDefaults(miner.config);
  }

  if (profiles.activeProfile) {
    miner.applySavedProfile(profiles.activeProfile);
  }

  runAutoUpdateCheck();
  window.setTimeout(() => {
    configAutosaveReady.value = true;
  }, 0);
  document.addEventListener('visibilitychange', flushConfigAutosave);
  document.addEventListener('visibilitychange', checkUpdatesWhenVisible);
  window.addEventListener('pagehide', flushConfigAutosave);
});

watch(
  () => settings.$state,
  () => {
    if (!settings.persist()) dataFeedback.value = t('app.settingsSaveFailed');
  },
  { deep: true }
);
watch(
  () => profiles.storageError,
  (message) => {
    if (message) dataFeedback.value = message;
  }
);

watch(
  () => settings.updates.autoUpdate,
  (enabled) => {
    if (!enabled) {
      hideUpdateBanner();
      return;
    }

    lastNotifiedUpdateVersion = '';
    runAutoUpdateCheck();
  }
);

watch(() => miner.config, scheduleConfigAutosave, { deep: true });

watch(
  () => device.cpuThreads,
  (threads) => {
    if (threads > 0) {
      miner.config.totalDetectedThreads = threads;
      miner.config.threadCount = Math.min(miner.config.threadCount, threads);
      miner.config.customThreadCount = Math.min(miner.config.customThreadCount, threads);
    }
  },
  { immediate: true }
);

watch(
  () => [device.batteryLevel, device.isCharging, device.temperatureC] as const,
  ([batteryLevel, isCharging, temperatureC]) => {
    miner.syncDeviceTelemetry(batteryLevel, isCharging, temperatureC);
  },
  { immediate: true }
);

watch(
  () => [settings.batterySafety.stopBelowPercent, settings.batterySafety.mineOnlyCharging],
  () => {
    void miner.syncSafetySettings().catch(() => {
      dataFeedback.value = t('app.protectionSyncFailed');
      void miner.stopMining();
    });
  }
);

onBeforeUnmount(() => {
  void removeBackListener?.();
  flushConfigAutosave();
  document.removeEventListener('visibilitychange', flushConfigAutosave);
  document.removeEventListener('visibilitychange', checkUpdatesWhenVisible);
  window.removeEventListener('pagehide', flushConfigAutosave);
});
</script>

<template>
  <div
    class="app-shell min-h-screen bg-app-bg text-app-on"
    @touchstart.passive="pageSwipe.onTouchStart"
    @touchmove.passive="pageSwipe.onTouchMove"
    @touchend.passive="pageSwipe.onTouchEnd"
    @touchcancel.passive="pageSwipe.cancel"
    :class="{
      'motion-reduced': !settings.performance.animationsEnabled,
      'app-shell-ready': systemCheckComplete && phoneRiskWarningAccepted && !sessionFullscreen
    }"
  >
    <PhoneMiningRiskView v-if="!phoneRiskWarningAccepted" @continue="acceptPhoneRiskWarning" />

    <template v-else>
      <SystemCheckView
        v-if="!systemCheckComplete && !sessionActive"
        :device="device"
        @continue="completeSystemCheck"
      />

      <AppHeader
        :session-state="sessionActive ? miner.state.value : undefined"
        v-if="systemCheckComplete && !sessionFullscreen"
        :connected="miner.connected.value"
        :backend-state="miner.backendState.value"
        :active-tab="activeTab"
        @open-drawer="drawerOpen = true"
        @back="activeTab = 'dashboard'"
        @notifications="activeTab = 'settings'"
      />

      <div
        v-if="sessionActive && activeTab !== 'dashboard'"
        class="active-session-bar"
        role="status"
      >
        <button class="text-button" @click="activeTab = 'dashboard'">
          {{ $t('app.viewSession', { status: miner.statusLabel.value }) }}
        </button>
        <button
          class="stop-button"
          :disabled="miner.state.value === 'stopping'"
          @click="miner.stopMining"
        >
          <MaterialIcon name="stop" :size="20" />{{ $t('app.stopMining') }}
        </button>
      </div>

      <Transition name="banner">
        <UpdateBanner
          v-if="systemCheckComplete && !sessionActive && updateBanner.visible"
          :title="updateBanner.title"
          :message="updateBanner.message"
          @view="openUpdateSettings"
          @dismiss="hideUpdateBanner"
        />
      </Transition>

      <MiningSessionView
        ref="sessionView"
        v-if="sessionActive"
        v-show="activeTab === 'dashboard'"
        @fullscreen="sessionFullscreen = $event"
        :state="miner.state.value"
        :config="miner.config"
        :stats="miner.stats"
        :device="device"
        :connected="miner.connected.value"
        :uptime="miner.uptimeLabel.value"
        :backend-message="miner.backendMessage.value"
        :logs="miner.minerLogs.value"
        :api-telemetry="miner.apiTelemetry.value"
        :hashrate-history="miner.hashrateHistory.value"
        @pause="miner.pauseMining"
        @stop="miner.stopMining"
        @profile="miner.updateProfile"
        @resume="requestResumeMining"
      />

      <div v-if="dataFeedback" class="app-page phone-page data-feedback" role="status">
        <div class="notice">
          <p>{{ dataFeedback }}</p>
          <button
            class="text-button"
            :aria-label="$t('app.dismissMessage')"
            @click="dataFeedback = ''"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
      </div>
      <main v-if="systemCheckComplete && (!sessionActive || activeTab !== 'dashboard')">
        <Transition name="view" mode="out-in" @after-enter="revealUpdateSettings">
          <DashboardView
            v-if="activeTab === 'dashboard'"
            :config="miner.config"
            :device="device"
            :connected="miner.connected.value"
            :backend-state="miner.backendState.value"
            :backend-message="miner.backendMessage.value"
            :logs="miner.minerLogs.value"
            :session-history="miner.sessionHistory.value"
            :active-profile="profiles.activeProfile"
            @start="requestStartMining"
            @configure="navigateToSetup"
            @statistics="navigateToStatistics"
            @profiles="navigateToProfiles"
            @delete-session="miner.deleteSessionHistoryItem"
            @clear-sessions="miner.clearSessionHistory"
          />
          <MiningConfigView
            v-else-if="activeTab === 'mining'"
            :locked="sessionActive"
            :config="miner.config"
            :device="device"
            :backend-state="miner.backendState.value"
            :backend-message="miner.backendMessage.value"
            @profile="updateProfile"
            @coin="miner.updateCoin"
            @apply-profile="applyProfile"
            @start="saveAndStartMining"
          />
          <StatisticsView
            v-else-if="activeTab === 'statistics'"
            :config="miner.config"
            :session-history="miner.sessionHistory.value"
          />
          <SettingsView
            v-else-if="activeTab === 'settings'"
            :config="miner.config"
            :device="device"
            :locked="sessionActive"
            @export-config="exportConfig"
            @import-config="openImportPicker"
            @open-about="activeTab = 'about'"
          />
          <ProfilesView
            v-else-if="activeTab === 'profiles'"
            :locked="sessionActive"
            :config="miner.config"
            @apply="applyProfile"
            @save-current="saveCurrentProfile"
          />
          <HelpSupportView v-else-if="activeTab === 'help'" />
          <AboutView v-else :device="device" />
        </Transition>
      </main>

      <BottomNav v-if="systemCheckComplete && !sessionFullscreen" v-model="activeTab" />
      <MinerDownloadWarningSheet
        :open="minerDownloadWarningOpen"
        :downloading="miner.backendState.value === 'downloading'"
        :progress="miner.downloadProgress.value"
        :error="minerDownloadError"
        @confirm="confirmMinerDownloadAndStart"
        @cancel="minerDownloadWarningOpen = false"
      />
      <StartMiningWarningSheet
        :open="startWarningOpen"
        :config="miner.config"
        @confirm="confirmStartMining"
        @cancel="startWarningOpen = false"
      />
      <AppDrawer
        v-if="systemCheckComplete"
        :open="drawerOpen"
        :active-tab="activeTab"
        @close="drawerOpen = false"
        @navigate="activeTab = $event"
        @export-config="exportConfig"
        @import-config="openImportPicker"
      />
      <input
        ref="importInput"
        class="hidden"
        type="file"
        accept="application/json,.json"
        @change="importConfig"
      />
    </template>
  </div>
</template>
