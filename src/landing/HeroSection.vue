<script setup lang="ts">
import { images, links, shot } from './content';
</script>

<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-disc" aria-hidden="true"></div>
    <div class="hero-text">
      <h1 id="hero-title">Your phone, measured.</h1>
      <p class="lead">
        AndroMiner is an open-source Android app that mines RandomX coins on the phone's CPU,
        watches its heat and battery, and benchmarks the chip honestly.
      </p>
      <div class="actions">
        <a class="button button-large" :href="links.download">Download the APK</a>
        <a class="link" href="#benchmarks">See what phones hash</a>
      </div>
    </div>
    <img
      class="hero-phone"
      :src="images.overview.src"
      :alt="images.overview.alt"
      :width="shot.width"
      :height="shot.height"
    />
  </section>
</template>
