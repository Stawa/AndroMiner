<script setup lang="ts">
import { computed } from 'vue';
import DotMeter from '../components/DotMeter.vue';
import { formatNumber, t } from '../i18n';
import type { DeviceTelemetry, MiningConfig } from '../types/mining';

const props = defineProps<{ device: DeviceTelemetry; config: MiningConfig }>();

const missing = (): string => t('device.notReported');
const present = (value: string | number | null | undefined, suffix = ''): string =>
  value === null || value === undefined || value === '' ? missing() : `${value}${suffix}`;

const temperatureShare = computed(() =>
  props.device.temperatureC === null
    ? null
    : Math.min(1, Math.max(0, (props.device.temperatureC - 20) / 60))
);
const thermalTone = computed(() => {
  const status = props.device.thermalStatus;
  if (status === 'hot') return 'danger';
  if (status === 'warm') return 'warn';
  return status === 'unavailable' || status === 'unknown' ? 'muted' : 'accent';
});
const thermalLabel = computed(() => t(`device.status.${props.device.thermalStatus}`));
const sensorLabel = computed(() =>
  props.device.thermalSource === 'battery' ? t('metric.batteryTemp') : t('metric.temperature')
);
const threads = computed(() => props.device.cpuThreads || props.config.totalDetectedThreads);

const processor = computed(() => [
  { label: t('device.processor'), value: present(props.device.cpuName) },
  {
    label: t('device.maxClock'),
    value: present(props.device.cpuMaxClockLabel === '-' ? null : props.device.cpuMaxClockLabel)
  },
  { label: t('metric.cpuThreads'), value: threads.value ? formatNumber(threads.value) : missing() },
  { label: 'GPU', value: present(props.device.gpuName) },
  {
    label: t('device.memory'),
    value: present(props.device.deviceMemoryGb, ' GB')
  }
]);

const power = computed(() => [
  { label: t('device.current'), value: present(props.device.batteryCurrentMa, ' mA') },
  { label: t('device.voltage'), value: present(props.device.batteryVoltageV, ' V') },
  { label: t('device.draw'), value: present(props.device.powerDrawW, ' W') }
]);

const system = computed(() => [
  { label: t('device.model'), value: present(props.device.model) },
  { label: t('device.maker'), value: present(props.device.manufacturer) },
  {
    label: props.device.operatingSystem || 'OS',
    value: present(props.device.osVersion)
  }
]);
</script>

<template>
  <div class="app-page phone-page device-page">
    <header class="screen-heading">
      <h1>{{ $t('nav.device') }}</h1>
      <p>{{ $t('device.subtitle') }}</p>
    </header>

    <section class="dv-hero" :aria-label="$t('device.thermal')">
      <div class="dv-hero-top">
        <span class="eyebrow">{{ sensorLabel }}</span>
        <span class="status-chip" :data-tone="thermalTone">{{ thermalLabel }}</span>
      </div>
      <p class="dv-reading" :data-unavailable="device.temperatureC === null">
        <template v-if="device.temperatureC === null">{{ missing() }}</template>
        <template v-else>{{ device.temperatureC }}<span>°C</span></template>
      </p>
      <DotMeter :value="temperatureShare" :count="24" :tone="thermalTone" />
      <p v-if="device.thermalSensorName" class="dv-note">
        {{ $t('device.sensor') }} · {{ device.thermalSensorName }}
      </p>
    </section>

    <section class="dv-group" :aria-label="$t('device.power')">
      <h2 class="eyebrow">{{ $t('metric.battery') }}</h2>
      <div class="dv-battery">
        <p class="dv-reading dv-reading-sm" :data-unavailable="device.batteryLevel === null">
          <template v-if="device.batteryLevel === null">{{ missing() }}</template>
          <template v-else>{{ device.batteryLevel }}<span>%</span></template>
        </p>
        <span v-if="device.batteryLevel !== null" class="status-chip" data-tone="accent">{{
          device.isCharging ? $t('metric.charging') : $t('dashboard.onBattery')
        }}</span>
      </div>
      <DotMeter
        :value="device.batteryLevel === null ? null : device.batteryLevel / 100"
        :count="24"
      />
      <dl class="dv-list">
        <div v-for="row in power" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd :data-unavailable="row.value === missing()">{{ row.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="dv-group" :aria-label="$t('device.processor')">
      <h2 class="eyebrow">{{ $t('device.processor') }}</h2>
      <dl class="dv-list">
        <div v-for="row in processor" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd :data-unavailable="row.value === missing()">{{ row.value }}</dd>
        </div>
      </dl>
    </section>

    <section class="dv-group" :aria-label="$t('device.system')">
      <h2 class="eyebrow">{{ $t('device.system') }}</h2>
      <dl class="dv-list">
        <div v-for="row in system" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd :data-unavailable="row.value === missing()">{{ row.value }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
