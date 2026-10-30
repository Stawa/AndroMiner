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
  <main class="onboarding-page redesign-page">
    <header class="screen-heading">
      <h1>Before you mine</h1>
      <p>AndroMiner runs CPU mining on your phone. Review the risks before setting up a run.</p>
    </header>
    <section class="risk-banner">
      <MaterialIcon name="warning" :size="28" />
      <h3>Mining can permanently damage a phone</h3>
      <p>Use a spare device, start gently, and keep every test supervised.</p>
      <div class="risk-facts">
        <span v-for="item in summaryItems" :key="item.label"
          ><small>{{ item.label }}</small
          ><strong>{{ item.value }}</strong></span
        >
      </div>
    </section>
    <section class="surface">
      <article v-for="risk in risks" :key="risk.title" class="risk-row">
        <MaterialIcon :name="risk.icon" :size="23" />
        <div>
          <strong>{{ risk.title }}</strong>
          <p>{{ risk.body }}</p>
        </div>
      </article>
    </section>
    <section>
      <h3 class="section-title">A safer starting point</h3>
      <article v-for="item in safeguards" :key="item.title" class="risk-row">
        <MaterialIcon :name="item.icon" :size="21" />
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.body }}</p>
        </div>
      </article>
    </section>
    <button class="primary-button" @click="emit('continue')">
      I understand · check my device<MaterialIcon name="arrow_forward" :size="20" />
    </button>
  </main>
</template>
