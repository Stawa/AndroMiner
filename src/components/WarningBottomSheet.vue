<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

export type WarningType = 'thermal' | 'battery';

interface WarningBottomSheetProps {
  open: boolean;
  type: WarningType;
  threshold: number;
}

defineProps<WarningBottomSheetProps>();

const emit = defineEmits<{
  resume: [];
  lowerPerformance: [];
  ignore: [];
  dismiss: [];
}>();
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 bg-black/[0.62]" @click="emit('dismiss')" />
  </Transition>
  <Transition name="sheet">
    <section
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-[28px] border border-app-line bg-app-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 text-center"
    >
      <div
        class="mx-auto grid h-16 w-16 place-items-center rounded-full border-2"
        :class="
          type === 'thermal' ? 'border-red-500 text-red-400' : 'border-app-yellow text-app-yellow'
        "
      >
        <MaterialIcon
          :name="type === 'thermal' ? 'device_thermostat' : 'battery_alert'"
          :size="34"
        />
      </div>
      <h2 class="mt-5 text-[22px] font-semibold leading-7 text-white">Mining Paused</h2>
      <p class="mx-auto mt-3 max-w-[280px] text-[15px] leading-6 text-white/82">
        <template v-if="type === 'thermal'">
          Temperature reached the configured threshold ({{ threshold }} °C)
        </template>
        <template v-else> Battery level is below the safety limit ({{ threshold }}%) </template>
      </p>
      <div class="mt-6 space-y-3">
        <button
          class="ripple h-14 w-full rounded-xl bg-app-green-dim text-[16px] font-semibold text-app-green"
          type="button"
          @click="emit('resume')"
        >
          <MaterialIcon
            class="mr-2 inline-block align-middle"
            name="play_arrow"
            :size="22"
            filled
          />
          Resume Mining
        </button>
        <button
          class="ripple h-14 w-full rounded-xl border border-app-line bg-app-elevated text-[16px] font-medium text-white"
          type="button"
          @click="type === 'thermal' ? emit('lowerPerformance') : emit('ignore')"
        >
          {{ type === 'thermal' ? 'Lower Performance' : 'Ignore & Continue' }}
        </button>
        <button
          class="ripple h-12 w-full rounded-xl text-[15px] font-medium text-app-green"
          type="button"
          @click="emit('dismiss')"
        >
          Dismiss
        </button>
      </div>
    </section>
  </Transition>
</template>
