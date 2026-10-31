<script setup lang="ts">
import { formatSensor } from '../utils/miningTelemetry';
import { computed } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import type { DeviceTelemetry } from '../types/mining';
import { t } from '../i18n';

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
  props.device.deviceMemoryGb === null ? t('common.unknown') : `${props.device.deviceMemoryGb} GB`
);

const thermalLabel = computed(() =>
  props.device.temperatureC === null
    ? t(`thermalStatus.${props.device.thermalStatus}`)
    : `${Math.round(props.device.temperatureC)} °C`
);

const checkItems = computed<CheckItem[]>(() => [
  {
    label: t('check.platform'),
    value:
      props.device.platform === 'web'
        ? t('check.browserPreview')
        : `${props.device.operatingSystem || props.device.platform} ${props.device.osVersion}`,
    status: isAndroidLike.value ? (props.device.platform === 'web' ? 'warn' : 'pass') : 'fail',
    detail:
      props.device.platform === 'web'
        ? t('check.platformWeb')
        : isAndroidLike.value
          ? t('check.platformOk')
          : t('check.platformBad'),
    icon: 'android'
  },
  {
    label: t('check.threads'),
    value: t('check.threadsDetected', { count: props.device.cpuThreads }),
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
        ? t('check.threadsGood')
        : props.device.cpuThreads >= 2
          ? t('check.threadsLow')
          : t('check.threadsBad'),
    icon: 'memory'
  },
  {
    label: t('check.memory'),
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
        ? t('check.memoryUnknown')
        : props.device.deviceMemoryGb >= 4
          ? t('check.memoryGood')
          : props.device.deviceMemoryGb >= 2
            ? t('check.memoryLow')
            : t('check.memoryBad'),
    icon: 'developer_board'
  },
  {
    label: t('check.thermals'),
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
        ? t('check.thermalHot')
        : props.device.thermalStatus === 'warm'
          ? t('check.thermalWarm')
          : props.device.thermalStatus === 'unavailable'
            ? t('check.thermalUnavailable')
            : props.device.thermalStatus === 'unknown'
              ? t('check.thermalWaiting')
              : t('check.thermalOk'),
    icon: 'device_thermostat'
  },
  {
    label: t('check.battery'),
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
        ? t('check.batteryUnknown')
        : props.device.isCharging
          ? t('check.batteryCharging')
          : props.device.batteryLevel !== null && props.device.batteryLevel >= 50
            ? t('check.batteryOk')
            : props.device.batteryLevel !== null && props.device.batteryLevel >= 25
              ? t('check.batteryLow')
              : t('check.batteryBad'),
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
      <h1>{{ $t('check.title') }}</h1>
      <p>{{ $t('check.intro') }}</p>
    </header>
    <div class="notice">
      <MaterialIcon name="info" :size="20" />
      <div>
        <strong>{{
          failures.length
            ? $t('check.attention')
            : warnings.length
              ? $t('check.review')
              : $t('check.available')
        }}</strong>
        <p>
          {{ $t('check.note') }}
        </p>
      </div>
    </div>
    <section class="surface">
      <div class="section-heading">
        <h3>{{ device.model }}</h3>
        <span class="supporting-label">{{ $t('check.local') }}</span>
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
      {{ $t('check.privacy') }}
    </p>
    <button class="primary-button" :disabled="failures.length > 0" @click="emit('continue')">
      {{ failures.length ? $t('check.resolve') : $t('check.continue')
      }}<MaterialIcon name="arrow_forward" :size="20" />
    </button>
  </main>
</template>
