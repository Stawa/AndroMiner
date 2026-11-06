<script setup lang="ts">
import { features, images, shot } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section
    id="features"
    class="grid grid-cols-1 items-start gap-[clamp(32px,6vw,96px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]"
    aria-labelledby="features-title"
  >
    <div>
      <h2 id="features-title" v-reveal class="max-w-[20ch] text-h2">
        A miner that treats the phone like a phone.
      </h2>
      <div class="mt-[clamp(28px,4vw,48px)] grid gap-4 sm:grid-cols-2">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          v-reveal="index % 4"
          class="rounded-2xl bg-surface p-6 sm:p-7"
        >
          <h3 class="mb-2 text-h3">{{ feature.title }}</h3>
          <p class="mb-0 text-muted">{{ feature.body }}</p>
        </div>
      </div>
    </div>
    <img
      v-reveal
      class="mx-auto w-full max-w-[360px] rounded-3xl lg:sticky lg:top-24 lg:max-w-none"
      :src="images.minerSetup.src"
      :alt="images.minerSetup.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
