<script setup lang="ts">
import { images, shot } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section class="safety" aria-labelledby="safety-title">
    <div class="safety-copy">
      <h2 id="safety-title" v-reveal>Heat decides, not the clock.</h2>
      <p v-reveal class="statement">
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
      :src="images.safety.src"
      :alt="images.safety.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
    <img
      v-reveal="1"
      :src="images.history.src"
      :alt="images.history.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
