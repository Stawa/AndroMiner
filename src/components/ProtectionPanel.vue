<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatNumber, t } from '../i18n';
import type { DeviceTelemetry, ProtectionEvent, ProtectionSnapshot } from '../types/mining';
import { freshness, stateTone, thermalHeadroomC } from '../utils/protection';
import ProtectionEventList from './ProtectionEventList.vue';

const props = defineProps<{
  device: DeviceTelemetry;
  protection: ProtectionSnapshot | null;
  events: ProtectionEvent[];
  temperatureLimitC: number;
}>();

const STALE_AFTER_MS = 10_000;
const now = ref(Date.now());
let tick = 0;
onMounted(() => {
  tick = window.setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => window.clearInterval(tick));

const missing = (): string => t('device.notReported');
const live = computed(() => props.protection);
const state = computed(() => live.value?.state ?? null);
const percent = (value: number): string => `${formatNumber(Math.round(value))}%`;

const summary = computed(() =>
  live.value
    ? t(`protection.summary.${live.value.state}`, {
        percent: Math.round(live.value.targetIntensity)
      })
    : t('protection.summary.idle')
);

const recoverySeconds = computed(() => {
  const ms = live.value?.recoveryRemainingMs ?? -1;
  return ms >= 0 ? Math.ceil(ms / 1000) : null;
});

const limit = computed(() => live.value?.temperatureLimitC ?? props.temperatureLimitC);
const batteryTemperature = computed(() =>
  live.value ? live.value.batteryTemperatureC : props.device.batteryTemperatureC
);
const cpuTemperature = computed(() =>
  live.value ? live.value.cpuTemperatureC : props.device.cpuTemperatureC
);
const batteryPercent = computed(() =>
  live.value ? live.value.batteryPercent : props.device.batteryLevel
);
const thermalName = computed(() => {
  if (live.value) {
    if (!live.value.androidThermalSupported) return 'unsupported';
    const level = live.value.androidThermalLevel;
    return (
      ['none', 'light', 'moderate', 'severe', 'critical', 'emergency', 'shutdown'][level ?? -1] ??
      'unavailable'
    );
  }
  return props.device.androidThermalStatus;
});
const headroom = computed(() => thermalHeadroomC(batteryTemperature.value, limit.value));

const age = (source: keyof ProtectionSnapshot['ageMs']): string => {
  const status = live.value
    ? freshness(live.value.ageMs[source], live.value.staleAfterMs)
    : props.device.sampledAt === null
      ? freshness(undefined, STALE_AFTER_MS)
      : freshness(Math.max(0, now.value - props.device.sampledAt), STALE_AFTER_MS);
  if (status.status === 'never') return t('protection.never');
  return status.status === 'stale'
    ? t('protection.stale', { seconds: status.seconds })
    : t('protection.age', { seconds: status.seconds });
};

const rows = computed(() => [
  {
    label: t('protection.batteryTemp'),
    value: batteryTemperature.value === null ? missing() : `${batteryTemperature.value} °C`,
    note: age('batteryTemperature'),
    off: batteryTemperature.value === null
  },
  {
    label: t('protection.androidThermal'),
    value: t(`protection.thermal.${thermalName.value}`),
    note: thermalName.value === 'unsupported' ? '' : age('androidThermalStatus'),
    off: ['unsupported', 'unavailable'].includes(thermalName.value)
  },
  {
    label: t('protection.cpuTemp'),
    value:
      cpuTemperature.value === null ? t('protection.cpuUnavailable') : `${cpuTemperature.value} °C`,
    note: cpuTemperature.value === null ? '' : age('cpuTemperature'),
    off: cpuTemperature.value === null
  },
  {
    label: t('protection.battery'),
    value: batteryPercent.value === null ? missing() : `${Math.round(batteryPercent.value)}%`,
    note: age('batteryPercent'),
    off: batteryPercent.value === null
  },
  {
    label: t('protection.headroom'),
    value:
      limit.value <= 0
        ? t('protection.headroomOff')
        : headroom.value === null
          ? missing()
          : t('protection.headroomValue', { value: headroom.value, limit: limit.value }),
    note: '',
    off: limit.value <= 0 || headroom.value === null
  }
]);
</script>

<template>
  <section class="dv-group dv-protection" :aria-label="$t('protection.title')">
    <div class="dv-hero-top">
      <h2 class="eyebrow">{{ $t('protection.title') }}</h2>
      <span class="status-chip" :data-tone="stateTone(state)">{{
        state ? $t(`protection.state.${state}`) : $t('protection.state.idle')
      }}</span>
    </div>
    <p class="dv-note dv-summary" role="status" aria-live="polite">{{ summary }}</p>

    <p v-if="live" class="dv-note">{{ $t('protection.throttleNote') }}</p>

    <dl v-if="live" class="dv-list">
      <div>
        <dt>{{ $t('protection.configured') }}</dt>
        <dd>{{ percent(live.configuredIntensity) }}</dd>
      </div>
      <div>
        <dt>{{ $t('protection.current') }}</dt>
        <dd>{{ percent(live.targetIntensity) }}</dd>
      </div>
      <div>
        <dt>{{ $t('protection.measured') }}</dt>
        <dd>{{ percent(live.measuredIntensity) }}</dd>
      </div>
    </dl>
    <p v-if="recoverySeconds !== null" class="dv-note">
      {{ $t('protection.recovery', { seconds: recoverySeconds }) }}
    </p>

    <h3 class="eyebrow">{{ $t('protection.readings') }}</h3>
    <dl class="dv-list">
      <div v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd :data-unavailable="row.off">
          {{ row.value }}
          <small v-if="row.note" class="dv-age">{{ row.note }}</small>
        </dd>
      </div>
    </dl>

    <h3 class="eyebrow">{{ $t('protection.events') }}</h3>
    <ProtectionEventList :events="events" />
  </section>
</template>
