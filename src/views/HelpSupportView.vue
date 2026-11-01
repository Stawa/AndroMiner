<script setup lang="ts">
import MaterialIcon from '../components/MaterialIcon.vue';

const troubleshooting = [
  'waiting',
  'poolConnect',
  'stale',
  'background',
  'timeLimit',
  'testPool',
  'verification',
  'sensors',
  'shares',
  'affinity'
];
const firstRun = ['coin', 'pool', 'gentle', 'watch'];
</script>
<template>
  <div class="app-page phone-page help-page md:grid md:grid-cols-2 md:items-stretch">
    <header class="screen-heading">
      <h1>{{ $t('nav.helpSupport') }}</h1>
      <p>{{ $t('help.subtitle') }}</p>
    </header>
    <section class="surface">
      <h3 class="section-title">{{ $t('help.firstRun') }}</h3>
      <ol class="quick-start">
        <li v-for="step in firstRun" :key="step">
          <strong>{{ $t(`help.steps.${step}.title`) }}</strong>
          <p>{{ $t(`help.steps.${step}.body`) }}</p>
        </li>
      </ol>
    </section>
    <section class="surface">
      <h3 class="section-title">{{ $t('help.troubleshooting') }}</h3>
      <details v-for="item in troubleshooting" :key="item" class="help-item">
        <summary>{{ $t(`help.items.${item}.title`) }}</summary>
        <p class="section-copy">{{ $t(`help.items.${item}.body`) }}</p>
      </details>
    </section>
    <a
      class="outline-button"
      href="https://github.com/Stawa/AndroMiner"
      target="_blank"
      rel="noopener noreferrer"
      ><MaterialIcon name="code" :size="20" />{{ $t('help.project')
      }}<MaterialIcon name="open_in_new" :size="18"
    /></a>
  </div>
</template>
