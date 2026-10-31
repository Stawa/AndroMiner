<script setup lang="ts">
import { formatSensor } from '../utils/miningTelemetry';
import { computed, onMounted } from 'vue';
import BrandLogo from '../components/BrandLogo.vue';
import { useAppVersion } from '../composables/useAppVersion';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import { formatNumber, t } from '../i18n';
import type { DeviceTelemetry } from '../types/mining';

interface AboutViewProps {
  device: DeviceTelemetry;
}

defineProps<AboutViewProps>();

const { displayVersion, refreshAppVersion } = useAppVersion();
const { minerInfo } = useNativeMinerInfo();
const versionLabel = computed(() => t('about.version', { version: displayVersion.value }));

// Permission names are Android identifiers and stay as-is; only the explanation is localized.
const androidPermissions = [
  { name: 'INTERNET', key: 'internet' },
  { name: 'ACCESS_NETWORK_STATE', key: 'networkState' },
  { name: 'WAKE_LOCK', key: 'wakeLock' },
  { name: 'POST_NOTIFICATIONS', key: 'notifications' },
  { name: 'FOREGROUND_SERVICE', key: 'foregroundService' },
  { name: 'FOREGROUND_SERVICE_SPECIAL_USE', key: 'specialUse' },
  { name: 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', key: 'batteryOptimization' },
  { name: 'VIBRATE', key: 'vibrate' }
];

const formatBytes = (bytes: number | null): string => {
  if (!bytes) {
    return t('common.unavailable');
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${formatNumber(value, {
    minimumFractionDigits: unitIndex === 0 ? 0 : 1,
    maximumFractionDigits: unitIndex === 0 ? 0 : 1
  })} ${units[unitIndex]}`;
};

// First lines of `xmrig --version` are raw command output and are shown verbatim.
const formatVersionOutput = (output: string): string => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return t('about.noVersionOutput');
  }

  return lines.slice(0, 3).join(' · ');
};

const minerDetails = computed(() => {
  const miner = minerInfo.value;
  const source = miner.installed
    ? t(`about.source.${miner.source}`)
    : miner.source === 'missing'
      ? t('about.source.missing')
      : t('backend.webUnavailable');

  return [
    {
      label: t('about.status'),
      value: miner.installed ? t('about.installed') : t('about.notInstalled')
    },
    {
      label: t('about.versionLabel'),
      value: miner.version || (miner.installed ? t('common.unknown') : t('common.unavailable'))
    },
    {
      label: t('about.variant'),
      value: !miner.installed
        ? t('about.none')
        : miner.variant === 'unknown'
          ? t('common.unknown')
          : miner.variantLabel
    },
    { label: t('about.sourceLabel'), value: source },
    { label: t('about.binaryName'), value: miner.fileName },
    { label: 'ABI', value: miner.abi },
    {
      label: t('about.targetSdk'),
      value: miner.targetSdkVersion === null ? t('common.unknown') : String(miner.targetSdkVersion)
    },
    { label: t('about.size'), value: formatBytes(miner.sizeBytes) },
    { label: t('about.versionOutput'), value: formatVersionOutput(miner.versionOutput) }
  ];
});

onMounted(() => {
  void refreshAppVersion();
});
</script>
<template>
  <div class="app-page phone-page redesign-page about-page md:grid md:grid-cols-2 md:items-stretch">
    <header class="screen-heading">
      <h1>{{ $t('settings.about') }}</h1>
      <p>{{ versionLabel }}</p>
    </header>
    <section class="brand-banner">
      <div class="brand-logo"><BrandLogo /></div>
      <div>
        <strong>AndroMiner</strong>
        <p>{{ $t('about.tagline') }}</p>
      </div>
    </section>
    <section class="surface">
      <h3 class="section-title">{{ $t('about.yourDevice') }}</h3>
      <dl class="definition-list">
        <div>
          <dt>{{ $t('about.model') }}</dt>
          <dd>{{ device.model }}</dd>
        </div>
        <div>
          <dt>{{ $t('check.platform') }}</dt>
          <dd>{{ device.operatingSystem }} {{ device.osVersion }}</dd>
        </div>
        <div>
          <dt>CPU</dt>
          <dd>{{ device.cpuName }}</dd>
        </div>
        <div>
          <dt>{{ $t('about.threads') }}</dt>
          <dd>{{ device.cpuThreads }}</dd>
        </div>
        <div>
          <dt>{{ $t('check.memory') }}</dt>
          <dd>
            {{
              device.deviceMemoryGb === null
                ? $t('common.unavailable')
                : device.deviceMemoryGb + ' GB'
            }}
          </dd>
        </div>
        <div>
          <dt>{{ $t('about.clock') }}</dt>
          <dd>{{ device.cpuClockLabel }}</dd>
        </div>
        <div>
          <dt>{{ $t('metric.battery') }}</dt>
          <dd>{{ formatSensor(device.batteryLevel, '%') }}</dd>
        </div>
        <div>
          <dt>{{ $t('metric.temperature') }}</dt>
          <dd>
            {{ formatSensor(device.temperatureC, ' °C') }} ·
            {{ $t(`thermalSource.${device.thermalSource}`) }}
          </dd>
        </div>
      </dl>
    </section>
    <details class="surface" open>
      <summary>{{ $t('about.engine') }}</summary>
      <dl class="definition-list">
        <div v-for="row in minerDetails" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </details>
    <details class="surface">
      <summary>{{ $t('about.permissions') }}</summary>
      <div v-for="permission in androidPermissions" :key="permission.name" class="permission-row">
        <strong>{{ permission.name }}</strong>
        <p class="section-copy">{{ $t(`about.permission.${permission.key}`) }}</p>
      </div>
    </details>
    <div class="notice">
      <div>
        <strong>{{ $t('about.experimental') }}</strong>
        <p>{{ $t('about.experimentalBody') }}</p>
      </div>
    </div>
  </div>
</template>
