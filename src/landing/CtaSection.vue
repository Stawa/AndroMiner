<script setup lang="ts">
import { links } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section class="grid justify-items-start gap-8" aria-labelledby="cta-title">
    <h2 id="cta-title" v-reveal class="max-w-[12ch] text-cta">Measure your phone.</h2>
    <a class="btn btn-lg" :href="links.download">Download the APK</a>
  </section>
</template>
