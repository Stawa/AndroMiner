<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

const emit = defineEmits<{
  continue: [];
}>();

const risks = [
  {
    icon: 'trending_down',
    title: 'Poor return',
    body: 'Phone hashrate is tiny compared with dedicated mining hardware.'
  },
  {
    icon: 'device_thermostat',
    title: 'Thermal stress',
    body: 'Sustained heat can damage battery, screen, storage, or mainboard.'
  },
  {
    icon: 'battery_alert',
    title: 'Battery wear',
    body: 'Charging while hot can accelerate aging, swelling, or failure.'
  }
];

const safeguards = ['Old or unused phone', 'Ventilated surface', 'Low intensity first'];
</script>

<template>
  <main
    class="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
  >
    <section class="app-card overflow-hidden">
      <div class="border-b border-app-line bg-app-elevated/70 px-4 py-3">
        <div class="flex items-center gap-3">
          <div
            class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-app-yellow/15 text-app-yellow"
          >
            <MaterialIcon name="warning" :size="25" />
          </div>
          <div class="min-w-0">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-yellow">
              Before you mine
            </p>
            <h1 class="mt-0.5 text-[22px] font-semibold leading-7 text-white">
              Phones are not mining rigs
            </h1>
          </div>
        </div>
      </div>

      <div class="p-4">
        <p class="text-[15px] leading-6 text-white/82">
          Mining on a phone is usually not worth it and can permanently damage or brick the device.
        </p>

        <div class="mt-4 grid gap-2">
          <div
            v-for="risk in risks"
            :key="risk.title"
            class="flex min-h-[72px] gap-3 rounded-lg border border-app-line bg-app-card px-3 py-3"
          >
            <div
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-elevated text-app-yellow"
            >
              <MaterialIcon :name="risk.icon" :size="22" />
            </div>
            <div class="min-w-0">
              <p class="text-[14px] font-semibold leading-5 text-white">{{ risk.title }}</p>
              <p class="mt-0.5 text-[12px] leading-[18px] text-app-muted">{{ risk.body }}</p>
            </div>
          </div>
        </div>

        <section class="mt-4 rounded-lg border border-app-green/30 bg-app-green-dim/60 p-3">
          <div class="flex items-center gap-2">
            <MaterialIcon class="shrink-0 text-app-green" name="shield" :size="20" />
            <p class="text-[13px] font-semibold leading-5 text-white">Recommended setup</p>
          </div>
          <div class="mt-3 grid gap-2">
            <div
              v-for="item in safeguards"
              :key="item"
              class="flex min-h-9 items-center gap-2 rounded-md bg-app-card/70 px-2 text-[12px] font-medium text-app-muted"
            >
              <MaterialIcon class="text-app-green" name="check_circle" :size="17" />
              <span class="truncate">{{ item }}</span>
            </div>
          </div>
        </section>
      </div>
    </section>

    <div class="mt-auto pt-4">
      <button
        class="ripple min-h-14 w-full rounded-xl bg-app-green px-3 py-3 text-[15px] font-semibold leading-5 text-white shadow-[0_8px_18px_rgb(25_128_88/0.22)]"
        type="button"
        @click="emit('continue')"
      >
        I Understand
      </button>
    </div>
  </main>
</template>
