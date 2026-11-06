<script setup lang="ts">
import { faqs, links } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section id="faq" class="faq" aria-labelledby="faq-title">
    <h2 id="faq-title" v-reveal>Questions people ask</h2>
    <div class="faq-list">
      <details v-for="(item, index) in faqs" :key="item.q" v-reveal="index">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
      <details v-reveal="faqs.length">
        <summary>Is the source available?</summary>
        <p>
          Yes. Everything is on <a :href="links.repo">GitHub</a>, including the scripts that build
          each engine. The app is MIT licensed and the miners are GPL-3.0 upstream projects.
        </p>
      </details>
    </div>
  </section>
</template>
