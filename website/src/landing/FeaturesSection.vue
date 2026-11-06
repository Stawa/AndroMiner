<script setup lang="ts">
import { vReveal } from '../site/reveal';

// Every entry maps to behaviour documented in the README and docs/ and present in the source.
const items = [
  {
    title: 'CPU mining',
    body: 'Mines RandomX, GhostRider and CryptoNight-CCX coins on the phone CPU through a native foreground service.',
    icon: 'M4 4h16v16H4zM9 9h6v6H9zM15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2'
  },
  {
    title: 'XMRig compatibility',
    body: 'XMRig 6.26 is the supported engine. XMRigCC and XLArig are available as experimental engines.',
    icon: 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0'
  },
  {
    title: 'Pool configuration',
    body: 'Choose a coin, wallet, worker and pool over TCP or TLS. Test DNS, TCP and TLS reachability without sending credentials.',
    icon: 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01'
  },
  {
    title: 'CPU profiles',
    body: 'Pick a profile, or set threads, priority and core affinity yourself. Save setups and reuse them.',
    icon: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4'
  },
  {
    title: 'Hashrate monitoring',
    body: 'Measured hashrate and miner output update live. Readings the phone does not report show as not reported, never guessed.',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
  },
  {
    title: 'Share monitoring',
    body: 'Accepted and rejected shares are tracked per session and kept with the run in History.',
    icon: 'M18 6L7 17l-5-5M22 10l-7.5 7.5L13 16'
  },
  {
    title: 'Temperature and battery',
    body: 'Battery temperature, Android thermal status, battery level and charging state, wherever the device exposes them.',
    icon: 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z'
  },
  {
    title: 'Device safety limits',
    body: 'Your temperature and battery limits drive Normal, Caution, Throttled and Stop. Every change is explained and recorded.',
    icon: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4'
  },
  {
    title: 'Local storage',
    body: 'Setups and session history stay on the phone. Configuration can be exported and imported as a file.',
    icon: 'M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01'
  }
];
</script>

<template>
  <section id="features" aria-labelledby="features-title">
    <p class="eyebrow">Features</p>
    <h2 id="features-title" v-reveal class="max-w-[22ch] text-h2">
      A miner that treats the phone like a phone.
    </h2>
    <ul
      class="m-0 mt-[clamp(28px,4vw,48px)] grid list-none gap-px overflow-hidden rounded-card border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      <li
        v-for="(item, index) in items"
        :key="item.title"
        v-reveal="index % 3"
        class="bg-surface p-6"
      >
        <svg
          class="mb-4 text-accent-text"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="item.icon" />
        </svg>
        <h3 class="mb-2 text-h3">{{ item.title }}</h3>
        <p class="mb-0 text-[.9375rem] text-muted">{{ item.body }}</p>
      </li>
    </ul>
  </section>
</template>
