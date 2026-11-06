<script setup lang="ts">
import { images, shot } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section
    class="grid grid-cols-2 items-start gap-[clamp(20px,4vw,56px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.8fr)]"
    aria-labelledby="safety-title"
  >
    <div class="col-span-2 lg:col-auto">
      <h2 id="safety-title" v-reveal class="max-w-[20ch] text-h2">Heat decides, not the clock.</h2>
      <p v-reveal class="mt-4 text-lead">
        Phone CPUs throttle and batteries age. AndroMiner reads the phone's own sensors and lowers
        or stops the work before the phone does it for you.
      </p>
      <p>
        Limits for temperature and battery are yours to set. When one is reached the app steps down
        through Caution and Throttled to Stop, tells you why, and keeps that reason with the session
        history. Mining on a phone earns very little: treat it as an experiment, not an income, and
        never leave a hot phone running unattended.
      </p>
    </div>
    <img
      v-reveal
      class="rounded-3xl"
      :src="images.safety.src"
      :alt="images.safety.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
    <img
      v-reveal="1"
      class="rounded-3xl lg:mt-[clamp(40px,8vw,120px)]"
      :src="images.history.src"
      :alt="images.history.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
