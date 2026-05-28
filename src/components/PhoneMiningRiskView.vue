<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

const emit = defineEmits<{
  continue: [];
}>();

const summaryItems = [
  { label: 'Return', value: 'Tiny' },
  { label: 'Heat load', value: 'Sustained' },
  { label: 'Device', value: 'Spare only' }
];

const risks = [
  {
    icon: 'trending_down',
    tag: 'Economics',
    title: 'Poor return',
    body: 'Phone hashrate is tiny compared with dedicated mining hardware.',
    tone: 'bg-app-yellow/15 text-app-yellow'
  },
  {
    icon: 'device_thermostat',
    tag: 'Thermals',
    title: 'Thermal stress',
    body: 'Sustained heat can damage the battery, screen, storage, or mainboard.',
    tone: 'bg-red-500/15 text-red-600 dark:text-red-300'
  },
  {
    icon: 'battery_alert',
    tag: 'Battery',
    title: 'Battery wear',
    body: 'Charging while hot can accelerate aging, swelling, or failure.',
    tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
  }
];

const safeguards = [
  {
    icon: 'phonelink_erase',
    title: 'Use an old phone',
    body: 'Do not mine on a daily driver or a device with important data.'
  },
  {
    icon: 'air',
    title: 'Keep airflow open',
    body: 'Use a flat, ventilated surface and stop if the case gets hot.'
  },
  {
    icon: 'speed',
    title: 'Start at low intensity',
    body: 'Begin with conservative threads and watch temperature before raising load.'
  }
];
</script>

<template>
  <main
    class="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
  >
    <header class="pt-2">
      <div
        class="inline-flex min-h-9 items-center gap-2 rounded-full border border-app-yellow/35 bg-app-yellow/10 px-3 text-[12px] font-semibold uppercase leading-4 text-app-yellow"
      >
        <MaterialIcon name="warning" :size="18" />
        Hardware Risk
      </div>

      <h1 class="mt-4 text-[30px] font-semibold leading-9 text-app-on">
        Mining can permanently damage a phone
      </h1>
      <p class="mt-3 text-[15px] leading-6 text-app-muted">
        AndroMiner can run CPU mining, but phones are not built to sit under mining load for long
        sessions.
      </p>
    </header>

    <section class="mt-5 overflow-hidden rounded-2xl border border-app-line bg-app-card shadow-sm">
      <div class="relative px-5 py-5">
        <div class="flex items-start gap-4">
          <div
            class="relative grid h-32 w-24 shrink-0 place-items-center rounded-[24px] border border-app-line bg-app-bg shadow-[inset_0_0_0_4px_rgb(var(--color-app-card)),0_14px_28px_rgb(15_23_42/0.10)] dark:shadow-[inset_0_0_0_4px_rgb(var(--color-app-card)),0_14px_28px_rgb(0_0_0/0.28)]"
          >
            <span class="absolute top-3 h-1 w-8 rounded-full bg-app-line" />
            <span
              class="grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300"
            >
              <MaterialIcon name="local_fire_department" :size="34" filled />
            </span>
            <span
              class="absolute -right-2 bottom-4 grid h-10 w-10 place-items-center rounded-full border border-app-line bg-app-card text-app-yellow shadow-sm"
            >
              <MaterialIcon name="priority_high" :size="22" />
            </span>
          </div>

          <div class="min-w-0 flex-1 pt-1">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">
              Reality check
            </p>
            <h2 class="mt-2 text-[24px] font-semibold leading-8 text-app-on">
              Low reward. Real wear.
            </h2>
            <p class="mt-2 text-[13px] leading-5 text-app-muted">
              A phone can earn very little while still absorbing heat, battery stress, and crash
              risk.
            </p>
          </div>
        </div>

        <div
          class="mt-5 grid grid-cols-3 divide-x divide-app-line overflow-hidden rounded-lg border border-app-line bg-app-elevated/70"
        >
          <div v-for="item in summaryItems" :key="item.label" class="min-w-0 px-3 py-3">
            <p class="truncate text-[10px] font-semibold uppercase leading-4 text-app-muted">
              {{ item.label }}
            </p>
            <p class="mt-0.5 truncate text-[14px] font-semibold leading-5 text-app-on">
              {{ item.value }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-4 grid gap-2">
      <article
        v-for="risk in risks"
        :key="risk.title"
        class="flex min-h-[88px] gap-3 rounded-lg border border-app-line bg-app-card px-3 py-3 shadow-sm"
      >
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full" :class="risk.tone">
          <MaterialIcon :name="risk.icon" :size="23" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <p class="text-[14px] font-semibold leading-5 text-app-on">{{ risk.title }}</p>
            <span
              class="rounded-full bg-app-elevated px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 text-app-muted"
            >
              {{ risk.tag }}
            </span>
          </div>
          <p class="mt-1 text-[12px] leading-[18px] text-app-muted">{{ risk.body }}</p>
        </div>
      </article>
    </section>

    <section class="mt-4 rounded-2xl border border-app-green/30 bg-app-green-dim/70 p-4">
      <div class="flex items-start gap-3">
        <div
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-card text-app-green"
        >
          <MaterialIcon name="shield" :size="22" />
        </div>
        <div class="min-w-0">
          <h2 class="text-[16px] font-semibold leading-6 text-app-on">
            Proceed only with safeguards
          </h2>
          <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
            These do not remove the risk, but they reduce the chance of ruining a useful device.
          </p>
        </div>
      </div>

      <div class="mt-3 divide-y divide-app-green/20">
        <div v-for="item in safeguards" :key="item.title" class="flex min-h-[58px] gap-3 py-3">
          <MaterialIcon class="mt-0.5 shrink-0 text-app-green" :name="item.icon" :size="21" />
          <div class="min-w-0">
            <p class="text-[13px] font-semibold leading-5 text-app-on">{{ item.title }}</p>
            <p class="text-[12px] leading-[18px] text-app-muted">{{ item.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="mt-auto pt-4">
      <p
        class="mb-3 rounded-lg border border-app-line bg-app-elevated/70 px-3 py-2 text-[12px] leading-[18px] text-app-muted"
      >
        If this is your main phone, the safer move is to stop here.
      </p>
      <button
        class="ripple flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-app-green px-3 py-3 text-[15px] font-semibold leading-5 text-white shadow-[0_8px_18px_rgb(25_128_88/0.22)]"
        type="button"
        @click="emit('continue')"
      >
        <MaterialIcon name="verified_user" :size="21" />
        I Understand
      </button>
    </div>
  </main>
</template>
