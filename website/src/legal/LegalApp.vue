<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { renderMarkdown } from '../docs/markdown';
import SiteFooter from '../site/SiteFooter.vue';
import SiteHeader from '../site/SiteHeader.vue';
import privacy from './privacy.md?raw';
import terms from './terms.md?raw';

// Bump when the text changes in a way readers should notice.
const updated = 'November 6, 2026';

const pages = {
  '/privacy': { title: 'Privacy policy', source: privacy },
  '/terms': { title: 'Terms of use', source: terms }
} as const;
type Path = keyof typeof pages;

const path = (location.pathname.replace(/\/+$/, '') || '/privacy') as Path;
const page = computed(() => pages[path] ?? pages['/terms']);
const rendered = computed(() => renderMarkdown(page.value.source));

onMounted(() => {
  document.title = `${page.value.title} · AndroMiner`;
});
</script>

<template>
  <SiteHeader />
  <div
    class="mx-auto grid max-w-[88rem] gap-x-12 px-gutter py-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-12"
  >
    <nav
      aria-label="Legal"
      class="mb-6 flex gap-2 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:mb-0 lg:grid lg:self-start"
    >
      <a
        v-for="(item, href) in pages"
        :key="href"
        :href="href"
        class="rounded-control px-3.5 py-2.5 text-[.9375rem] font-semibold no-underline"
        :class="
          href === path ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'
        "
        :aria-current="href === path ? 'page' : undefined"
        >{{ item.title }}</a
      >
    </nav>
    <main class="min-w-0">
      <article class="prose">
        <div v-html="rendered.html"></div>
      </article>
      <p class="mt-10 font-mono text-xs text-muted">Last updated {{ updated }}</p>
    </main>
  </div>
  <SiteFooter />
</template>
