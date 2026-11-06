<script setup lang="ts">
import { ref } from 'vue';
import { images, nav } from './content';

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
        <a class="btn shrink-0 !px-4 text-sm sm:!px-5 sm:text-base" href="/#download">Download</a>
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
