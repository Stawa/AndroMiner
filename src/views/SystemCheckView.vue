<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import type { DeviceTelemetry } from '../types/mining';

type SystemRating = 'best' | 'good' | 'decent' | 'fine' | 'warning' | 'not_supported';

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

const checking = ref(false);

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
        ? 'Mining must run through the Android app and native miner service.'
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
          ? 'Enough RAM for stable app and miner operation.'
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
          : props.device.thermalStatus === 'unavailable'
            ? 'unknown'
            : 'pass',
    detail:
      props.device.thermalStatus === 'hot'
        ? 'Let the device cool before starting a mining session.'
        : props.device.thermalStatus === 'warm'
          ? 'Start with Battery Saver and monitor temperature closely.'
          : props.device.thermalStatus === 'unavailable'
            ? 'Thermal readings are unavailable, so safety limits should stay conservative.'
            : 'Thermal state is acceptable for a low-intensity start.',
    icon: 'device_thermostat'
  },
  {
    label: 'Battery',
    value: `${Math.round(props.device.batteryLevel)}%`,
    status:
      props.device.isCharging || props.device.batteryLevel >= 50
        ? 'pass'
        : props.device.batteryLevel >= 25
          ? 'warn'
          : 'fail',
    detail: props.device.isCharging
      ? 'Charging is recommended for longer mining sessions.'
      : props.device.batteryLevel >= 50
        ? 'Battery level is acceptable, but charging is still recommended.'
        : props.device.batteryLevel >= 25
          ? 'Short sessions only unless plugged in.'
          : 'Battery is too low for mining.',
    icon: props.device.isCharging ? 'battery_charging_full' : 'battery_5_bar'
  }
]);

const warnings = computed(() =>
  checkItems.value.filter((item) => item.status === 'warn' || item.status === 'unknown')
);

const failures = computed(() => checkItems.value.filter((item) => item.status === 'fail'));

const systemScore = computed(() => {
  if (failures.value.length > 0) {
    return 0;
  }

  let score = 0;
  score +=
    props.device.cpuThreads >= 8
      ? 32
      : props.device.cpuThreads >= 6
        ? 27
        : props.device.cpuThreads >= 4
          ? 19
          : 10;
  score +=
    props.device.deviceMemoryGb === null
      ? 12
      : props.device.deviceMemoryGb >= 6
        ? 26
        : props.device.deviceMemoryGb >= 4
          ? 22
          : props.device.deviceMemoryGb >= 2
            ? 12
            : 0;
  score +=
    props.device.thermalStatus === 'cool'
      ? 20
      : props.device.thermalStatus === 'normal'
        ? 18
        : props.device.thermalStatus === 'warm'
          ? 9
          : 8;
  score += props.device.isCharging
    ? 12
    : props.device.batteryLevel >= 70
      ? 10
      : props.device.batteryLevel >= 50
        ? 8
        : 4;
  score += props.device.platform === 'android' ? 10 : 5;

  return Math.min(100, score);
});

const rating = computed<SystemRating>(() => {
  if (failures.value.length > 0) {
    return 'not_supported';
  }

  if (systemScore.value >= 88) {
    return 'best';
  }

  if (systemScore.value >= 74) {
    return 'good';
  }

  if (systemScore.value >= 60) {
    return 'decent';
  }

  if (systemScore.value >= 44) {
    return 'fine';
  }

  return 'warning';
});

const ratingMeta = computed(() => {
  const meta: Record<SystemRating, { title: string; body: string; icon: string; tone: string }> = {
    best: {
      title: 'Best for mining',
      body: 'This device has strong headroom for balanced and performance profiles.',
      icon: 'workspace_premium',
      tone: 'text-app-green'
    },
    good: {
      title: 'Good for mining',
      body: 'This device should mine reliably with balanced settings.',
      icon: 'verified',
      tone: 'text-app-green'
    },
    decent: {
      title: 'Decent for mining',
      body: 'Start conservatively and increase intensity after watching temperature.',
      icon: 'thumb_up',
      tone: 'text-app-green'
    },
    fine: {
      title: 'Fine with limits',
      body: 'Use Battery Saver and keep sessions short until a real miner backend confirms stability.',
      icon: 'tune',
      tone: 'text-app-yellow'
    },
    warning: {
      title: 'Warnings found',
      body: 'Mining may work, but the app recommends conservative limits before starting.',
      icon: 'warning',
      tone: 'text-app-yellow'
    },
    not_supported: {
      title: 'Not supported',
      body: 'One or more checks failed. Actual mining should stay disabled on this device.',
      icon: 'block',
      tone: 'text-red-300'
    }
  };

  return meta[rating.value];
});

const recommendedProfile = computed(() => {
  if (rating.value === 'best' || rating.value === 'good') {
    return 'Balanced';
  }

  if (rating.value === 'decent' || rating.value === 'fine' || rating.value === 'warning') {
    return 'Battery Saver';
  }

  return 'Not recommended';
});

const statusClass = (status: CheckItem['status']): string => {
  if (status === 'pass') {
    return 'bg-app-green-dim text-app-green';
  }

  if (status === 'fail') {
    return 'bg-red-500/15 text-red-300';
  }

  return 'bg-app-yellow/15 text-app-yellow';
};

const runCheckAgain = (): void => {
  checking.value = true;
  window.setTimeout(() => {
    checking.value = false;
  }, 900);
};
</script>

<template>
  <main
    class="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
  >
    <header class="flex min-h-16 items-center gap-3">
      <div
        class="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-app-green/40 text-app-green"
      >
        <MaterialIcon name="health_and_safety" :size="28" />
      </div>
      <div class="min-w-0">
        <h1 class="text-[22px] font-semibold leading-7 text-white">System check</h1>
        <p class="text-[13px] leading-5 text-app-muted">Verify this device before mining</p>
      </div>
    </header>

    <section class="app-card mt-3 p-5 text-center">
      <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-app-elevated">
        <MaterialIcon
          :name="checking ? 'sync' : ratingMeta.icon"
          :size="42"
          :class="[ratingMeta.tone, { 'animate-ringPulse': checking }]"
        />
      </div>
      <p class="mt-4 text-[12px] font-semibold uppercase leading-4 text-app-green">
        Score {{ systemScore }}/100
      </p>
      <h2 class="mt-1 text-[24px] font-semibold leading-8 text-white">{{ ratingMeta.title }}</h2>
      <p class="mx-auto mt-2 max-w-[300px] text-[14px] leading-5 text-app-muted">
        {{ ratingMeta.body }}
      </p>

      <div class="mt-5 grid grid-cols-2 gap-2">
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Profile</p>
          <p class="mt-1 text-[17px] font-semibold leading-6 text-white">
            {{ recommendedProfile }}
          </p>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <p class="text-[11px] uppercase leading-4 text-app-muted">Warnings</p>
          <p class="mt-1 text-[17px] font-semibold leading-6 text-white">
            {{ warnings.length + failures.length }}
          </p>
        </div>
      </div>
    </section>

    <section v-if="warnings.length || failures.length" class="app-card mt-3 overflow-hidden">
      <div class="settings-heading">
        <span>Warnings</span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="item in [...failures, ...warnings]"
          :key="item.label"
          class="flex min-h-[70px] gap-3 px-4 py-3"
        >
          <div
            class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
            :class="statusClass(item.status)"
          >
            <MaterialIcon :name="item.status === 'fail' ? 'error' : 'warning'" :size="21" />
          </div>
          <div class="min-w-0">
            <p class="text-[14px] font-semibold leading-5 text-white">{{ item.label }}</p>
            <p class="mt-1 text-[12px] leading-4 text-app-muted">{{ item.detail }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="app-card mt-3 overflow-hidden">
      <div class="settings-heading">
        <span>Device checks</span>
      </div>
      <div class="divide-y divide-app-line border-t border-app-line">
        <div
          v-for="item in checkItems"
          :key="item.label"
          class="flex min-h-[74px] items-center gap-3 px-4 py-3"
        >
          <div
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            :class="statusClass(item.status)"
          >
            <MaterialIcon :name="item.icon" :size="22" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-medium text-white">{{ item.label }}</p>
            <p class="truncate text-[12px] text-app-muted">{{ item.detail }}</p>
          </div>
          <p class="max-w-[92px] shrink-0 truncate text-right text-[13px] font-semibold text-white">
            {{ item.value }}
          </p>
        </div>
      </div>
    </section>

    <section class="mt-3 rounded-xl border border-app-line bg-app-elevated p-4">
      <div class="flex gap-3">
        <MaterialIcon class="shrink-0 text-app-green" name="privacy_tip" :size="23" />
        <p class="text-[13px] leading-5 text-app-muted">
          These checks run locally. Device model, CPU, RAM, battery, and thermal details are not
          sent anywhere by this screen.
        </p>
      </div>
    </section>

    <div class="mt-auto grid grid-cols-2 gap-2 pt-4">
      <button
        class="ripple h-14 rounded-xl border border-app-line bg-app-elevated text-[15px] font-medium text-white"
        type="button"
        @click="runCheckAgain"
      >
        Check again
      </button>
      <button
        class="ripple h-14 rounded-xl bg-app-green-dim text-[15px] font-semibold text-app-green disabled:opacity-45"
        type="button"
        :disabled="rating === 'not_supported'"
        @click="emit('continue')"
      >
        {{ rating === 'not_supported' ? 'Blocked' : 'Continue' }}
      </button>
    </div>
  </main>
</template>
