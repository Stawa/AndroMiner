<script setup lang="ts">
import { formatSensor } from '../utils/miningTelemetry';
import { computed } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import type { DeviceTelemetry } from '../types/mining';

interface SystemCheckViewProps {
  device: DeviceTelemetry;
}

interface CheckItem {
  label: string;
  value: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  detail: string;
  icon: string;
}

const props = defineProps<SystemCheckViewProps>();

const emit = defineEmits<{
  continue: [];
}>();

const isAndroidLike = computed(() =>
  ['android', 'web'].includes(props.device.platform.toLowerCase())
);

const memoryLabel = computed(() =>
  props.device.deviceMemoryGb === null ? 'Unknown' : `${props.device.deviceMemoryGb} GB`
);

const thermalLabel = computed(() =>
  props.device.temperatureC === null
    ? props.device.thermalStatus
    : `${Math.round(props.device.temperatureC)} °C`
);

const checkItems = computed<CheckItem[]>(() => [
  {
    label: 'Platform',
    value:
      props.device.platform === 'web'
        ? 'Browser preview'
        : `${props.device.operatingSystem || props.device.platform} ${props.device.osVersion}`,
    status: isAndroidLike.value ? (props.device.platform === 'web' ? 'warn' : 'pass') : 'fail',
    detail:
      props.device.platform === 'web'
        ? 'The browser can preview the interface. Mining needs the Android app.'
        : isAndroidLike.value
          ? 'Compatible with the Android miner runtime.'
          : 'This app is designed for Android mining devices.',
    icon: 'android'
  },
  {
    label: 'CPU threads',
    value: `${props.device.cpuThreads} detected`,
    status:
      props.device.cpuThreads >= 6
        ? 'pass'
        : props.device.cpuThreads >= 4
          ? 'warn'
          : props.device.cpuThreads >= 2
            ? 'warn'
            : 'fail',
    detail:
      props.device.cpuThreads >= 6
        ? 'Enough headroom for balanced or performance profiles.'
        : props.device.cpuThreads >= 2
          ? 'Use Battery Saver or a low custom thread count.'
          : 'At least 2 CPU threads are required for a useful mining session.',
    icon: 'memory'
  },
  {
    label: 'Memory',
    value: memoryLabel.value,
    status:
      props.device.deviceMemoryGb === null
        ? 'unknown'
        : props.device.deviceMemoryGb >= 4
          ? 'pass'
          : props.device.deviceMemoryGb >= 2
            ? 'warn'
            : 'fail',
    detail:
      props.device.deviceMemoryGb === null
        ? 'Memory is not exposed by this runtime, so the app will use conservative defaults.'
        : props.device.deviceMemoryGb >= 4
          ? 'Memory capacity is reported by the device; actual miner allocation may still fail.'
          : props.device.deviceMemoryGb >= 2
            ? 'Close background apps before mining.'
            : 'Too little available memory for safe native mining.',
    icon: 'developer_board'
  },
  {
    label: 'Thermals',
    value: thermalLabel.value,
    status:
      props.device.thermalStatus === 'hot'
        ? 'fail'
        : props.device.thermalStatus === 'warm'
          ? 'warn'
          : ['unavailable', 'unknown'].includes(props.device.thermalStatus)
            ? 'unknown'
            : 'pass',
    detail:
      props.device.thermalStatus === 'hot'
        ? 'Let the device cool before starting a mining session.'
        : props.device.thermalStatus === 'warm'
          ? 'Start with Battery Saver and monitor temperature closely.'
          : props.device.thermalStatus === 'unavailable'
            ? 'Thermal readings are unavailable, so safety limits should stay conservative.'
            : props.device.thermalStatus === 'unknown'
              ? 'Waiting for thermal readings.'
              : 'Thermal state is acceptable for a low-intensity start.',
    icon: 'device_thermostat'
  },
  {
    label: 'Battery',
    value: formatSensor(props.device.batteryLevel, '%'),
    status:
      props.device.batteryLevel === null
        ? 'unknown'
        : props.device.isCharging ||
            (props.device.batteryLevel !== null && props.device.batteryLevel >= 50)
          ? 'pass'
          : props.device.batteryLevel !== null && props.device.batteryLevel >= 25
            ? 'warn'
            : 'fail',
    detail:
      props.device.batteryLevel === null
        ? 'Battery level is unavailable. Check the device before starting.'
        : props.device.isCharging
          ? 'Charging is recommended for longer mining sessions.'
          : props.device.batteryLevel !== null && props.device.batteryLevel >= 50
            ? 'Battery level is acceptable, but charging is still recommended.'
            : props.device.batteryLevel !== null && props.device.batteryLevel >= 25
              ? 'Short sessions only unless plugged in.'
              : 'Battery is too low for mining.',
    icon: props.device.isCharging ? 'battery_charging_full' : 'battery_5_bar'
  }
]);

const warnings = computed(() =>
  checkItems.value.filter((item) => item.status === 'warn' || item.status === 'unknown')
);

const failures = computed(() => checkItems.value.filter((item) => item.status === 'fail'));
</script>
<template>
  <main class="onboarding-page redesign-page">
    <header class="screen-heading">
      <h1>Device check</h1>
      <p>Reported hardware and power readings, before your first run.</p>
    </header>
    <div class="notice">
      <MaterialIcon name="info" :size="20" />
      <div>
        <strong>{{
          failures.length
            ? 'This device needs attention'
            : warnings.length
              ? 'Some readings need review'
              : 'Readings available'
        }}</strong>
        <p>
          This is a basic readiness check, not a speed benchmark. Begin with a low thread count and
          watch the phone.
        </p>
      </div>
    </div>
    <section class="surface">
      <div class="section-heading">
        <h3>{{ device.model }}</h3>
        <span class="supporting-label">Local check</span>
      </div>
      <article v-for="item in checkItems" :key="item.label" class="check-row">
        <MaterialIcon :name="item.icon" :size="21" />
        <div>
          <div class="check-label">
            <strong>{{ item.label }}</strong
            ><span>{{ item.value }}</span>
          </div>
          <p>{{ item.detail }}</p>
        </div>
        <MaterialIcon
          :name="
            item.status === 'pass'
              ? 'check_circle'
              : item.status === 'fail'
                ? 'error'
                : item.status === 'unknown'
                  ? 'help'
                  : 'info'
          "
          :size="18"
          :class="item.status === 'fail' ? 'danger-text' : 'text-app-muted'"
        />
      </article>
    </section>
    <p class="section-copy">
      These readings stay on this screen and are not uploaded by this check. Unavailable sensors
      cannot confirm that a device is cool.
    </p>
    <button class="primary-button" :disabled="failures.length > 0" @click="emit('continue')">
      {{ failures.length ? 'Resolve failed checks to continue' : 'Continue to setup'
      }}<MaterialIcon name="arrow_forward" :size="20" />
    </button>
  </main>
</template>
