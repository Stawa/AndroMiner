<script setup lang="ts">
import { computed, onMounted } from 'vue';
import BrandLogo from '../components/BrandLogo.vue';
import { useAppVersion } from '../composables/useAppVersion';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import MaterialIcon from '../components/MaterialIcon.vue';
import { formatNumber, t } from '../i18n';

const { build, variantLabel, version, refreshAppVersion } = useAppVersion();
const { minerInfo } = useNativeMinerInfo();
const appDetails = computed(() => [
  { label: t('about.versionLabel'), value: version.value },
  { label: t('about.build'), value: build.value || t('common.unavailable') },
  { label: t('about.variant'), value: variantLabel.value },
  { label: t('check.platform'), value: 'Capacitor Android' }
]);

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
  <div class="app-page phone-page about-page">
    <header class="screen-heading">
      <h1>{{ $t('settings.about') }}</h1>
    </header>

    <section class="about-id">
      <div class="about-logo"><BrandLogo /></div>
      <p>{{ $t('about.tagline') }}</p>
    </section>

    <section class="dv-group" :aria-label="$t('about.app')">
      <h2 class="eyebrow">{{ $t('about.app') }}</h2>
      <dl class="dv-list">
        <div v-for="row in appDetails" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="dv-group" :aria-label="$t('about.engine')">
      <h2 class="eyebrow">{{ $t('about.engine') }}</h2>
      <dl class="dv-list">
        <div v-for="row in minerDetails.slice(0, 8)" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
        <div class="about-stack">
          <dt>{{ minerDetails[8].label }}</dt>
          <dd>{{ minerDetails[8].value }}</dd>
        </div>
      </dl>
    </section>

    <details class="dv-group about-permissions">
      <summary>
        <h2 class="eyebrow">{{ $t('about.permissions') }}</h2>
        <MaterialIcon name="expand_more" :size="20" />
      </summary>
      <ul class="dv-list">
        <li v-for="permission in androidPermissions" :key="permission.name">
          <code>{{ permission.name }}</code>
          <p>{{ $t(`about.permission.${permission.key}`) }}</p>
        </li>
      </ul>
    </details>

    <p class="about-note">
      <strong>{{ $t('about.experimental') }}</strong>
      {{ $t('about.experimentalBody') }}
    </p>
  </div>
</template>
