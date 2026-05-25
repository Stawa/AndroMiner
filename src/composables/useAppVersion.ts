import { computed, readonly, ref } from 'vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNativeMinerInfo } from './useNativeMinerInfo';

const bundledVersion = import.meta.env.VITE_APP_VERSION || __APP_VERSION__;
const nativePlatform = Capacitor.isNativePlatform();
const { apkVariantLabel, refreshNativeMinerInfo } = useNativeMinerInfo();
const version = ref(bundledVersion);
const build = ref('');
const displayVersion = computed(() => `${version.value} (${apkVariantLabel.value})`);
let activeRefresh: Promise<void> | null = null;

const refreshAppVersion = async (): Promise<void> => {
  if (!nativePlatform) {
    version.value = bundledVersion;
    build.value = '';
    return;
  }

  try {
    const info = await CapacitorApp.getInfo();
    version.value = info.version || bundledVersion;
    build.value = info.build || '';
  } catch {
    version.value = bundledVersion;
    build.value = '';
  }

  await refreshNativeMinerInfo();
};

const refreshOnce = (): Promise<void> => {
  if (!activeRefresh) {
    activeRefresh = refreshAppVersion().finally(() => {
      activeRefresh = null;
    });
  }

  return activeRefresh;
};

export const useAppVersion = () => ({
  build: readonly(build),
  displayVersion,
  refreshAppVersion: refreshOnce,
  variantLabel: apkVariantLabel,
  version: readonly(version)
});
