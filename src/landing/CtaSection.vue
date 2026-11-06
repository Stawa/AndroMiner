<script setup lang="ts">
import { links } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section class="cta" aria-labelledby="cta-title">
    <h2 id="cta-title" v-reveal>Measure your phone.</h2>
    <a class="button button-large" :href="links.download">Download the APK</a>
  </section>
</template>
