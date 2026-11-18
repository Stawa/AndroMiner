<script setup lang="ts">
import { ref } from 'vue';
import { images, links, nav } from './content';

const open = ref(false);
const here = typeof location === 'undefined' ? '' : location.pathname;
const current = (href: string): boolean =>
  href !== '/' && !href.includes('#') && here.startsWith(href);
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur-md">
    <div
      class="mx-auto flex h-[calc(var(--header-h)-1px)] max-w-[88rem] items-center justify-between gap-2 px-gutter sm:gap-4"
    >
      <a
        class="flex min-w-0 items-center gap-2.5 font-extrabold no-underline"
        href="/"
        aria-label="AndroMiner home"
      >
        <img class="rounded-lg" :src="images.logo" alt="" width="28" height="28" />
        <span class="truncate">AndroMiner</span>
      </a>
      <nav class="hidden gap-[clamp(14px,2.5vw,32px)] md:flex" aria-label="Primary">
        <a
          v-for="item in nav"
          :key="item.href"
          class="py-2 text-[.9375rem] font-semibold no-underline transition-colors hover:text-ink"
          :class="current(item.href) ? 'text-ink' : 'text-muted'"
          :aria-current="current(item.href) ? 'page' : undefined"
          :href="item.href"
          >{{ item.label }}</a
        >
      </nav>
      <div class="flex items-center gap-2">
        <a
          class="btn-ghost shrink-0 !px-4 text-sm sm:!px-5 sm:text-base"
          :href="links.repo"
          target="_blank"
          rel="noreferrer"
          aria-label="Star AndroMiner on GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.62-2.8 5.64-5.48 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.57A12 12 0 0 0 24 12C24 5.37 18.63 0 12 0Z" />
          </svg>
          Star
        </a>
        <button
          type="button"
          class="grid size-11 cursor-pointer place-items-center rounded-full text-ink hover:bg-surface-2 md:hidden"
          :aria-expanded="open"
          aria-controls="mobile-nav"
          aria-label="Site menu"
          @click="open = !open"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              :d="open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
    <nav
      v-show="open"
      id="mobile-nav"
      class="grid border-t border-line px-gutter pb-3 md:hidden"
      aria-label="Primary mobile"
    >
      <a
        v-for="item in nav"
        :key="item.href"
        class="py-3.5 text-lg font-semibold no-underline"
        :href="item.href"
        @click="open = false"
        >{{ item.label }}</a
      >
    </nav>
  </header>
</template>
