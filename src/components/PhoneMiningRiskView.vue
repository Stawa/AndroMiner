<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

const emit = defineEmits<{
  continue: [];
}>();

const summaryItems = [
  { label: 'risk.factReturn', value: 'risk.factReturnValue' },
  { label: 'risk.factHeat', value: 'risk.factHeatValue' },
  { label: 'risk.factDevice', value: 'risk.factDeviceValue' }
];

const risks = [
  {
    icon: 'trending_down',
    title: 'risk.returnTitle',
    body: 'risk.returnBody',
    tone: 'bg-app-yellow/15 text-app-yellow'
  },
  {
    icon: 'device_thermostat',
    title: 'risk.thermalTitle',
    body: 'risk.thermalBody',
    tone: 'bg-red-500/15 text-red-600 dark:text-red-300'
  },
  {
    icon: 'battery_alert',
    title: 'risk.batteryTitle',
    body: 'risk.batteryBody',
    tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
  }
];

const safeguards = [
  {
    icon: 'phonelink_erase',
    title: 'risk.oldPhoneTitle',
    body: 'risk.oldPhoneBody'
  },
  {
    icon: 'air',
    title: 'risk.airflowTitle',
    body: 'risk.airflowBody'
  },
  {
    icon: 'speed',
    title: 'risk.lowTitle',
    body: 'risk.lowBody'
  }
];
</script>

<template>
  <main class="onboarding-page redesign-page">
    <header class="screen-heading">
      <h1>{{ $t('risk.title') }}</h1>
      <p>{{ $t('risk.intro') }}</p>
    </header>
    <section class="risk-banner">
      <MaterialIcon name="warning" :size="28" />
      <h3>{{ $t('risk.bannerTitle') }}</h3>
      <p>{{ $t('risk.bannerBody') }}</p>
      <div class="risk-facts">
        <span v-for="item in summaryItems" :key="item.label"
          ><small>{{ $t(item.label) }}</small
          ><strong>{{ $t(item.value) }}</strong></span
        >
      </div>
    </section>
    <section class="surface">
      <article v-for="risk in risks" :key="risk.title" class="risk-row">
        <MaterialIcon :name="risk.icon" :size="23" />
        <div>
          <strong>{{ $t(risk.title) }}</strong>
          <p>{{ $t(risk.body) }}</p>
        </div>
      </article>
    </section>
    <section>
      <h3 class="section-title">{{ $t('risk.safeTitle') }}</h3>
      <article v-for="item in safeguards" :key="item.title" class="risk-row">
        <MaterialIcon :name="item.icon" :size="21" />
        <div>
          <strong>{{ $t(item.title) }}</strong>
          <p>{{ $t(item.body) }}</p>
        </div>
      </article>
    </section>
    <button class="primary-button" @click="emit('continue')">
      {{ $t('risk.continue') }}<MaterialIcon name="arrow_forward" :size="20" />
    </button>
  </main>
</template>
