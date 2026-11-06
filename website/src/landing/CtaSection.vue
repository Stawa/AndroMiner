<script setup lang="ts">
import { vReveal } from '../site/reveal';
</script>

<template>
  <section class="grid justify-items-start gap-8" aria-labelledby="cta-title">
    <h2 id="cta-title" v-reveal class="max-w-[12ch] text-cta">Try it on your phone.</h2>
    <div class="flex flex-wrap gap-3">
      <a class="btn btn-lg" href="#download">Download APK</a>
      <a class="btn-ghost btn-lg" href="/docs">Read the docs</a>
    </div>
  </section>
</template>
