<script setup lang="ts">
import { faqs, links } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section
    id="faq"
    class="grid grid-cols-1 items-start gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]"
    aria-labelledby="faq-title"
  >
    <h2 id="faq-title" v-reveal class="max-w-[20ch] text-h2">Questions people ask</h2>
    <div class="grid gap-3">
      <details
        v-for="(item, index) in faqs"
        :key="item.q"
        v-reveal="index"
        class="group rounded-2xl bg-surface px-5 py-1 open:bg-surface-2"
      >
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold after:text-2xl after:leading-none after:text-accent after:transition-transform after:content-['+'] group-open:after:rotate-45 motion-reduce:after:transition-none [&::-webkit-details-marker]:hidden"
        >
          {{ item.q }}
        </summary>
        <p class="text-muted">{{ item.a }}</p>
      </details>
      <details
        v-reveal="faqs.length"
        class="group rounded-2xl bg-surface px-5 py-1 open:bg-surface-2"
      >
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold after:text-2xl after:leading-none after:text-accent after:transition-transform after:content-['+'] group-open:after:rotate-45 motion-reduce:after:transition-none [&::-webkit-details-marker]:hidden"
        >
          Is the source available?
        </summary>
        <p class="text-muted">
          Yes. Everything is on <a class="text-ink underline" :href="links.repo">GitHub</a>,
          including the scripts that build each engine. The app is MIT licensed and the miners are
          GPL-3.0 upstream projects.
        </p>
      </details>
    </div>
  </section>
</template>
