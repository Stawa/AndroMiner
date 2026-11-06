<script setup lang="ts">
import { steps } from '../site/content';
import { vReveal } from '../site/reveal';
</script>

<template>
  <section aria-labelledby="start-title">
    <p class="eyebrow">How it works</p>
    <h2 id="start-title" v-reveal class="max-w-[22ch] text-h2">From download to first share</h2>
    <ol
      class="m-0 mt-[clamp(24px,4vw,48px)] grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4"
    >
      <li
        v-for="(step, index) in steps"
        :key="step.title"
        v-reveal="index"
        class="card p-6 leading-snug"
      >
        <span class="mb-5 block font-mono text-sm text-accent-text">0{{ index + 1 }}</span>
        <strong class="mb-2 block text-h3">{{ step.title }}</strong>
        <span class="text-[.9375rem] text-muted">{{ step.body }}</span>
      </li>
    </ol>
  </section>
</template>
