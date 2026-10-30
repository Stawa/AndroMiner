<script setup lang="ts">
import { formatSensor } from '../utils/miningTelemetry';
import { computed, onMounted } from 'vue';

import BrandLogo from '../components/BrandLogo.vue';
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
    detail: 'Allows access to network connectivity information.'
  },
  {
    name: 'WAKE_LOCK',
    detail: 'Declared permission; no wake lock is acquired by this build.'
  },
  {
    name: 'POST_NOTIFICATIONS',
    detail: 'Shows mining status notifications on supported Android versions.'
  },
  {
    name: 'FOREGROUND_SERVICE',
    detail: 'Keeps native protection and the Stop notification active during a user-started run.'
  },
  {
    name: 'FOREGROUND_SERVICE_SPECIAL_USE',
    detail:
      'Declares user-initiated CPU mining and continuous device protection on Android 14 and later.'
  },
  {
    name: 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    detail: 'Android may ask once to allow the app to run without battery optimization.'
  },
  {
    name: 'VIBRATE',
    detail: 'Declared for notification support; no direct vibration control is exposed.'
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
  <div class="app-page phone-page redesign-page about-page md:grid md:grid-cols-2 md:items-stretch">
    <header class="screen-heading">
      <h1>About AndroMiner</h1>
      <p>{{ versionLabel }}</p>
    </header>
    <section class="brand-banner">
      <div class="brand-logo"><BrandLogo /></div>
      <div>
        <strong>AndroMiner</strong>
        <p>Local CPU mining with XMRig.</p>
      </div>
    </section>
    <section class="surface">
      <h3 class="section-title">Your device</h3>
      <dl class="definition-list">
        <div>
          <dt>Model</dt>
          <dd>{{ device.model }}</dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>{{ device.operatingSystem }} {{ device.osVersion }}</dd>
        </div>
        <div>
          <dt>CPU</dt>
          <dd>{{ device.cpuName }}</dd>
        </div>
        <div>
          <dt>Threads</dt>
          <dd>{{ device.cpuThreads }}</dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>
            {{ device.deviceMemoryGb === null ? 'Unavailable' : device.deviceMemoryGb + ' GB' }}
          </dd>
        </div>
        <div>
          <dt>Clock</dt>
          <dd>{{ device.cpuClockLabel }}</dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>{{ formatSensor(device.batteryLevel, '%') }}</dd>
        </div>
        <div>
          <dt>Temperature</dt>
          <dd>{{ formatSensor(device.temperatureC, ' °C') }} · {{ device.thermalSource }}</dd>
        </div>
      </dl>
    </section>
    <details class="surface" open>
      <summary>Installed mining engine</summary>
      <dl class="definition-list">
        <div v-for="row in minerDetails" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </details>
    <details class="surface">
      <summary>Android permissions</summary>
      <div v-for="permission in androidPermissions" :key="permission.name" class="permission-row">
        <strong>{{ permission.name }}</strong>
        <p class="section-copy">{{ permission.detail }}</p>
      </div>
    </details>
    <div class="notice">
      <div>
        <strong>Experimental phone mining</strong>
        <p>
          Performance depends on your hardware, algorithm, and Android restrictions. Long runs can
          heat the phone and wear the battery. There is no earnings estimate or guaranteed profit.
        </p>
      </div>
    </div>
  </div>
</template>
