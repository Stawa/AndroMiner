<script setup lang="ts">
import PhoneFrame from '../site/PhoneFrame.vue';
import { images } from '../site/content';
import { vReveal } from '../site/reveal';

const screens = [
  {
    image: images.overview,
    title: 'Overview',
    caption: 'Mining status, device readings and the start control in one place.'
  },
  {
    image: images.minerSetup,
    title: 'Miner setup',
    caption: 'Coin, wallet, worker and pool. Saved setups can be applied in one tap.'
  },
  {
    image: images.engine,
    title: 'Engine',
    caption: 'Thread allocation and CPU power profiles for the selected engine.'
  },
  {
    image: images.safety,
    title: 'Safety',
    caption: 'Temperature and battery limits that decide when mining slows or stops.'
  },
  {
    image: images.history,
    title: 'History',
    caption: 'Completed runs with their share results and stop reasons.'
  },
  {
    image: images.settings,
    title: 'Settings',
    caption: 'Appearance, configuration export and import, and update information.'
  }
];
</script>

<template>
  <section id="screens" aria-labelledby="screens-title">
    <div>
      <p class="eyebrow">The app</p>
      <h2 id="screens-title" v-reveal class="max-w-[22ch] text-h2">Six screens, as they ship.</h2>
      <p class="mt-4 max-w-[56ch] text-muted">
        Captured on an Android 16 device. Mining was stopped, History shows existing runs, and the
        wallet is a placeholder.
      </p>
    </div>
    <ul
      class="m-0 mx-auto mt-[clamp(28px,4vw,48px)] flex snap-x snap-mandatory list-none gap-5 overflow-x-auto p-0 pb-4 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-12 md:overflow-visible lg:grid-cols-6 lg:gap-5"
      tabindex="0"
      aria-label="App screens, scrollable"
    >
      <li
        v-for="(screen, index) in screens"
        :key="screen.title"
        v-reveal="index % 3"
        class="w-[62vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"
      >
        <PhoneFrame :src="screen.image.src" :alt="screen.image.alt" />
        <h3 class="mt-4 mb-1 text-base font-bold">{{ screen.title }}</h3>
        <p class="mb-0 text-sm text-muted">{{ screen.caption }}</p>
      </li>
    </ul>
  </section>
</template>
