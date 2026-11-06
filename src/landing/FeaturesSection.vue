<script setup lang="ts">
import { features, images, shot } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section id="features" class="features" aria-labelledby="features-title">
    <div class="features-copy">
      <h2 id="features-title" v-reveal>A miner that treats the phone like a phone.</h2>
      <div v-for="(feature, index) in features" :key="feature.title" v-reveal="index % 4">
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.body }}</p>
      </div>
    </div>
    <img
      v-reveal
      class="features-shot"
      :src="images.minerSetup.src"
      :alt="images.minerSetup.alt"
      :width="shot.width"
      :height="shot.height"
      loading="lazy"
    />
  </section>
</template>
