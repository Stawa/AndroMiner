<script setup lang="ts">
import { images, shot, steps } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section class="start" aria-labelledby="start-title">
    <div class="start-copy">
      <h2 id="start-title" v-reveal>From download to first share</h2>
      <ol>
        <li v-for="(step, index) in steps" :key="step.title" v-reveal="index">
          <strong>{{ step.title }}</strong> {{ step.body }}
        </li>
      </ol>
    </div>
    <img
      v-reveal
      :src="images.settings.src"
      :alt="images.settings.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
