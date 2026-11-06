<script setup lang="ts">
import { images, shot, steps } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section
    class="grid grid-cols-1 items-center gap-[clamp(28px,6vw,96px)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]"
    aria-labelledby="start-title"
  >
    <div>
      <h2 id="start-title" v-reveal class="max-w-[20ch] text-h2">From download to first share</h2>
      <ol class="mt-[clamp(24px,4vw,48px)] grid list-none gap-6 p-0">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          v-reveal="index"
          class="max-w-[34ch] leading-snug"
        >
          <strong class="block text-h3">{{ step.title }}</strong> {{ step.body }}
        </li>
      </ol>
    </div>
    <img
      v-reveal
      class="mx-auto w-full max-w-[360px] rounded-3xl md:max-w-none"
      :src="images.settings.src"
      :alt="images.settings.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
