<script setup lang="ts">
import { vReveal } from '../site/reveal';

// Intensities from docs/device-protection.md.
const states = [
  { name: 'Normal', note: 'Full speed', level: 100 },
  { name: 'Caution', note: 'Close to a limit', level: 75 },
  { name: 'Throttled', note: 'Paused in cycles', level: 40 },
  { name: 'Stop', note: 'Run ends', level: 0 }
];
</script>

<template>
  <section aria-labelledby="safety-title">
    <div class="grid gap-[clamp(28px,6vw,96px)] lg:grid-cols-2">
      <div>
        <p class="eyebrow">Device protection</p>
        <h2 id="safety-title" v-reveal class="max-w-[18ch] text-h2">
          Heat decides, not the clock.
        </h2>
        <p v-reveal class="mt-5 text-lead text-muted">
          AndroMiner reads the phone's own sensors and lowers or stops the work before the phone
          does it for you.
        </p>
        <p class="text-muted">
          Limits for temperature and battery are yours to set. When one is reached the app steps
          down through Caution and Throttled to Stop, tells you why, and keeps that reason with the
          session history. Mining on a phone earns very little: treat it as an experiment, and never
          leave a hot phone running unattended.
        </p>
        <a class="font-bold text-accent-text underline" href="/docs/features/device-protection"
          >How protection works</a
        >
      </div>
      <ol class="m-0 grid list-none content-start gap-3 p-0" aria-label="Protection states">
        <li
          v-for="(state, index) in states"
          :key="state.name"
          v-reveal="index"
          class="card grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 p-5"
        >
          <div>
            <strong class="block">{{ state.name }}</strong>
            <span class="text-sm text-muted">{{ state.note }}</span>
          </div>
          <span class="font-mono text-sm">{{ state.level ? `${state.level}%` : 'stopped' }}</span>
          <span class="col-span-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span
              class="block h-full rounded-full bg-accent"
              :style="{ width: `${state.level}%` }"
            />
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
