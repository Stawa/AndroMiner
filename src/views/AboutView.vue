<script setup lang="ts">
import { computed, onMounted } from 'vue';
import SettingGroup from '../components/SettingGroup.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import { useAppVersion } from '../composables/useAppVersion';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import type { DeviceTelemetry } from '../types/mining';

interface AboutViewProps {
  device: DeviceTelemetry;
}

defineProps<AboutViewProps>();

const { displayVersion, refreshAppVersion } = useAppVersion();
const { minerInfo } = useNativeMinerInfo();
const versionLabel = computed(() => `Version ${displayVersion.value} · Capacitor Android`);

const androidPermissions = [
  {
    name: 'INTERNET',
    detail: 'Connects to mining pools and downloads the optional miner binary.'
  },
  {
    name: 'ACCESS_NETWORK_STATE',
    detail: 'Checks whether network connectivity is available before mining.'
  },
  {
    name: 'WAKE_LOCK',
    detail: 'Keeps the device awake during active mining sessions.'
  },
  {
    name: 'POST_NOTIFICATIONS',
    detail: 'Shows mining status notifications on supported Android versions.'
  },
  {
    name: 'FOREGROUND_SERVICE',
    detail: 'Allows long-running mining work to continue as a foreground task.'
  },
  {
    name: 'FOREGROUND_SERVICE_DATA_SYNC',
    detail: 'Declares the foreground service type used by the Android build.'
  },
  {
    name: 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    detail: 'Lets the app ask Android to reduce battery restrictions.'
  },
  {
    name: 'VIBRATE',
    detail: 'Supports notification or warning feedback.'
  }
];

const formatBytes = (bytes: number | null): string => {
  if (!bytes) {
    return 'Unavailable';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatVersionOutput = (output: string): string => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return 'Unavailable until an Android miner binary is installed.';
  }

  return lines.slice(0, 3).join(' · ');
};

const minerDetails = computed(() => {
  const miner = minerInfo.value;

  return [
    { label: 'Status', value: miner.installed ? 'Installed' : 'Not installed' },
    { label: 'Version', value: miner.version || (miner.installed ? 'Unknown' : 'Unavailable') },
    { label: 'Variant', value: miner.installed ? miner.variantLabel : 'None' },
    { label: 'Source', value: miner.sourceLabel },
    { label: 'Binary name', value: miner.fileName },
    { label: 'ABI', value: miner.abi },
    {
      label: 'Target SDK',
      value: miner.targetSdkVersion === null ? 'Unknown' : String(miner.targetSdkVersion)
    },
    { label: 'Size', value: formatBytes(miner.sizeBytes) },
    { label: 'Version output', value: formatVersionOutput(miner.versionOutput) }
  ];
});

onMounted(() => {
  void refreshAppVersion();
});
</script>

<template>
  <div class="phone-page">
    <section class="app-card p-4">
      <div class="flex items-center gap-3">
        <div
          class="grid h-14 w-14 place-items-center rounded-full border-2 border-app-green text-app-green"
        >
          <MaterialIcon name="power_settings_new" :size="30" />
        </div>
        <div>
          <h2 class="text-[20px] font-semibold text-white">AndroMiner</h2>
          <p class="text-[13px] text-app-muted">{{ versionLabel }}</p>
        </div>
      </div>
    </section>

    <SettingGroup title="Detected Android device" icon="phone_android">
      <div class="divide-y divide-app-line border-t border-app-line">
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Model</span
          ><strong class="text-right font-medium text-white">{{ device.model }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Platform</span
          ><strong class="text-right font-medium text-white">{{ device.platform }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">OS</span
          ><strong class="text-right font-medium text-white"
            >{{ device.operatingSystem }} {{ device.osVersion }}</strong
          >
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">CPU threads</span
          ><strong class="text-right font-medium text-white">{{ device.cpuThreads }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">CPU</span
          ><strong class="text-right font-medium text-white"
            >{{ device.cpuName }} · {{ device.cpuClockLabel }}</strong
          >
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Battery</span
          ><strong class="text-right font-medium text-white"
            >{{ Math.round(device.batteryLevel) }}% ·
            {{ device.isCharging ? 'Charging' : 'Unplugged' }}</strong
          >
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Temperature</span
          ><strong class="text-right font-medium text-white">{{
            device.temperatureC === null ? 'Unavailable' : `${Math.round(device.temperatureC)} °C`
          }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Thermal source</span
          ><strong class="text-right font-medium text-white">{{
            device.thermalSensorName
              ? `${device.thermalSource} · ${device.thermalSensorName}`
              : device.thermalSource
          }}</strong>
        </div>
      </div>
    </SettingGroup>

    <SettingGroup title="Android permissions" icon="admin_panel_settings">
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="permission in androidPermissions"
          :key="permission.name"
          class="px-4 py-3 text-[13px] leading-5"
        >
          <p class="font-semibold text-white">{{ permission.name }}</p>
          <p class="mt-1 text-app-muted">{{ permission.detail }}</p>
        </div>
      </div>
    </SettingGroup>

    <SettingGroup title="Miner binary" icon="memory">
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="item in minerDetails"
          :key="item.label"
          class="flex min-h-12 items-start justify-between gap-3 px-4 py-3 text-[14px]"
        >
          <span class="shrink-0 text-app-muted">{{ item.label }}</span>
          <strong class="min-w-0 break-words text-right font-medium text-white">{{
            item.value
          }}</strong>
        </div>
      </div>
    </SettingGroup>
  </div>
</template>
