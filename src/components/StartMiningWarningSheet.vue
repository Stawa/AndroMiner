<script setup lang="ts">
import { computed } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import type { MiningConfig } from '../types/mining';

interface StartMiningWarningSheetProps {
  open: boolean;
  config: MiningConfig;
}

const props = defineProps<StartMiningWarningSheetProps>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const coreLabel = computed(() => {
  const labels: Record<MiningConfig['affinity'], string> = {
    auto: 'All cores',
    little: 'Efficiency cores',
    big: 'Performance cores',
    custom: 'Custom affinity'
  };

  return labels[props.config.affinity];
});

const threadLabel = computed(
  () => `${props.config.threadCount}/${props.config.totalDetectedThreads}`
);
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 bg-black/[0.62]" @click="emit('cancel')" />
  </Transition>
  <Transition name="sheet">
    <section
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] overflow-hidden rounded-t-[28px] border border-app-line bg-app-card pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
    >
      <div class="px-5 pt-3">
        <button
          class="ripple mx-auto mb-2 block h-8 min-h-8 w-24 rounded-full"
          type="button"
          aria-label="Close start warning"
          @click="emit('cancel')"
        >
          <span class="mx-auto block h-1 w-10 rounded-full bg-white/25" />
        </button>

        <div class="flex items-start gap-3">
          <div
            class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-app-yellow/15 text-app-yellow"
          >
            <MaterialIcon name="warning" :size="27" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-yellow">
              High device load
            </p>
            <h2 class="mt-0.5 text-[22px] font-semibold leading-7 text-white">Start mining?</h2>
            <p class="mt-1 text-[13px] leading-5 text-app-muted">
              Phone mining is low-return and can damage hardware if heat runs away.
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-2">
          <div class="min-w-0 rounded-lg bg-app-elevated px-3 py-2">
            <p class="truncate text-[10px] font-medium uppercase leading-4 text-app-muted">
              Engine
            </p>
            <p class="mt-0.5 truncate text-[13px] font-semibold leading-5 text-white">XMRig CPU</p>
          </div>
          <div class="min-w-0 rounded-lg bg-app-elevated px-3 py-2">
            <p class="truncate text-[10px] font-medium uppercase leading-4 text-app-muted">Cores</p>
            <p class="mt-0.5 truncate text-[13px] font-semibold leading-5 text-white">
              {{ coreLabel }}
            </p>
          </div>
          <div class="min-w-0 rounded-lg bg-app-elevated px-3 py-2">
            <p class="truncate text-[10px] font-medium uppercase leading-4 text-app-muted">
              Threads
            </p>
            <p class="mt-0.5 truncate text-[13px] font-semibold leading-5 text-white">
              {{ threadLabel }}
            </p>
          </div>
        </div>

        <div class="mt-4 grid gap-2">
          <div
            class="flex min-h-[58px] items-center gap-3 rounded-lg border border-app-line bg-app-elevated px-3"
          >
            <MaterialIcon class="shrink-0 text-app-yellow" name="device_thermostat" :size="21" />
            <p class="min-w-0 text-[12px] leading-[18px] text-app-muted">
              Stop if the phone feels hot, slows down, reboots, or shows battery swelling.
            </p>
          </div>
          <div
            class="flex min-h-[58px] items-center gap-3 rounded-lg border border-app-line bg-app-elevated px-3"
          >
            <MaterialIcon class="shrink-0 text-app-yellow" name="battery_alert" :size="21" />
            <p class="min-w-0 text-[12px] leading-[18px] text-app-muted">
              Use a spare phone, keep it ventilated, and avoid charging while the device is hot.
            </p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-[0.82fr_1.18fr] gap-2">
          <button
            class="ripple min-h-14 rounded-xl border border-app-line bg-app-elevated px-3 text-[15px] font-medium text-white"
            type="button"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="ripple min-h-14 rounded-xl bg-app-green px-3 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgb(25_128_88/0.22)]"
            type="button"
            @click="emit('confirm')"
          >
            Start Anyway
          </button>
        </div>
      </div>
    </section>
  </Transition>
</template>
