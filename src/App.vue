<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import AppDrawer from './components/AppDrawer.vue';
import AppHeader from './components/AppHeader.vue';
import BottomNav, { type AppTab } from './components/BottomNav.vue';
import MinerDownloadWarningSheet from './components/MinerDownloadWarningSheet.vue';
import { useDeviceTelemetry } from './composables/useDeviceTelemetry';
import { useGitHubReleaseUpdater } from './composables/useGitHubReleaseUpdater';
import { useMiningController, type MinerBinaryVariant } from './composables/useMiningController';
import { useTheme } from './composables/useTheme';
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
const activeTab = ref<AppTab>('dashboard');
const drawerOpen = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const systemCheckComplete = ref(false);
const minerDownloadWarningOpen = ref(false);
const miner = useMiningController();
const settings = useSettingsStore();
const profiles = useProfilesStore();
const { device } = useDeviceTelemetry();
const updater = useGitHubReleaseUpdater();
useTheme();
const sessionActive = computed(() => miner.state.value !== 'idle');
const configAutosaveReady = ref(false);
let configAutosaveHandle = 0;
const updateCheckIntervalMs = 10 * 60 * 1000;

interface MiningNotificationPlugin {
  show: (options: { title: string; body: string }) => Promise<void>;
  cancel: () => Promise<void>;
}

const MiningNotification = registerPlugin<MiningNotificationPlugin>('MiningNotification');

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
  miner.applySavedProfile(profile);
  activeTab.value = 'mining';
};

const requestStartMining = (): void => {
  if (miner.backendState.value === 'missing') {
    minerDownloadWarningOpen.value = true;
    return;
  }

  void miner.startMining();
};

const saveAndStartMining = (): void => {
  profiles.saveActiveConfig(miner.config);
  requestStartMining();
};

const confirmMinerDownloadAndStart = async (variant: MinerBinaryVariant): Promise<void> => {
  const ready = await miner.downloadMiner(variant);
  if (!ready) {
    return;
  }

  minerDownloadWarningOpen.value = false;
  await miner.startMining();
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

const runAutoUpdateCheck = (minIntervalMs = 0): void => {
  if (!settings.updates.autoUpdate) {
    return;
  }

  void updater.checkForUpdates({ minIntervalMs });
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

const exportConfig = async (): Promise<void> => {
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
      title: 'Export AndroMiner config',
      text: 'AndroMiner configuration export',
      url: result.uri,
      dialogTitle: 'Save or share config'
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

const openImportPicker = (): void => {
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
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file) {
    return;
  }

  const raw = await file.text();
  const parsed = JSON.parse(raw) as unknown;

  if (!isConfigBundle(parsed)) {
    return;
  }

  profiles.replaceAll(parsed.profiles, parsed.activeProfileId);
  settings.replace(parsed.settings);
  Object.assign(miner.config, parsed.currentConfig);
};

onMounted(() => {
  systemCheckComplete.value = localStorage.getItem(systemCheckKey) === 'true';
  settings.load();
  profiles.load();

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
  () => settings.persist(),
  { deep: true }
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
  () =>
    [
      miner.state.value,
      miner.stats.hashrate,
      miner.stats.temperature,
      miner.stats.acceptedShares,
      miner.stats.rejectedShares,
      settings.notifications.miningStatus
    ] as const,
  ([state]) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (state === 'idle' || !settings.notifications.miningStatus) {
      void MiningNotification.cancel();
      return;
    }

    const status = state === 'paused' ? 'Paused' : state === 'starting' ? 'Starting' : 'Mining';
    const body = `${status} ${miner.config.coin.symbol} at ${miner.stats.hashrate.toFixed(
      1
    )} H/s · ${Math.round(miner.stats.temperature)} °C · ${
      miner.stats.acceptedShares
    } accepted / ${miner.stats.rejectedShares} rejected`;

    void MiningNotification.show({
      title: `AndroMiner ${status}`,
      body
    });
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  flushConfigAutosave();
  document.removeEventListener('visibilitychange', flushConfigAutosave);
  document.removeEventListener('visibilitychange', checkUpdatesWhenVisible);
  window.removeEventListener('pagehide', flushConfigAutosave);
});
</script>

<template>
  <div
    class="min-h-screen bg-app-bg text-app-on"
    :class="{ 'motion-reduced': !settings.performance.animationsEnabled }"
  >
    <SystemCheckView
      v-if="!systemCheckComplete && !sessionActive"
      :device="device"
      @continue="completeSystemCheck"
    />

    <AppHeader
      v-if="systemCheckComplete && !sessionActive"
      :connected="miner.connected.value"
      :backend-state="miner.backendState.value"
      :active-tab="activeTab"
      @open-drawer="drawerOpen = true"
      @back="activeTab = 'dashboard'"
      @notifications="activeTab = 'settings'"
    />

    <MiningSessionView
      v-if="sessionActive"
      :state="miner.state.value"
      :config="miner.config"
      :stats="miner.stats"
      :connected="miner.connected.value"
      :uptime="miner.uptimeLabel.value"
      :backend-message="miner.backendMessage.value"
      :logs="miner.minerLogs.value"
      :api-telemetry="miner.apiTelemetry.value"
      :hashrate-history="miner.hashrateHistory.value"
      @pause="miner.pauseMining"
      @stop="miner.stopMining"
      @profile="miner.updateProfile"
      @resume="miner.pauseMining"
    />

    <main v-else-if="systemCheckComplete">
      <DashboardView
        v-if="activeTab === 'dashboard'"
        :config="miner.config"
        :device="device"
        :connected="miner.connected.value"
        :backend-state="miner.backendState.value"
        :backend-message="miner.backendMessage.value"
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
        :config="miner.config"
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
        @export-config="exportConfig"
        @import-config="openImportPicker"
        @open-about="activeTab = 'about'"
      />
      <ProfilesView
        v-else-if="activeTab === 'profiles'"
        :config="miner.config"
        @apply="applyProfile"
        @save-current="saveCurrentProfile"
      />
      <HelpSupportView v-else-if="activeTab === 'help'" />
      <AboutView v-else :device="device" />
    </main>

    <BottomNav v-if="systemCheckComplete && !sessionActive" v-model="activeTab" />
    <MinerDownloadWarningSheet
      :open="minerDownloadWarningOpen"
      :downloading="miner.backendState.value === 'downloading'"
      :progress="miner.downloadProgress.value"
      @confirm="confirmMinerDownloadAndStart"
      @cancel="minerDownloadWarningOpen = false"
    />
    <AppDrawer
      v-if="systemCheckComplete && !sessionActive"
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
  </div>
</template>
