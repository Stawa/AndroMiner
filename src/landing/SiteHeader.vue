<script setup lang="ts">
import { ref } from 'vue';
import { images, links, nav } from './content';

const open = ref(false);
</script>

<template>
  <header class="sticky top-0 z-10 bg-ground/90 backdrop-blur-md">
    <div class="flex items-center justify-between gap-4 px-gutter py-3">
      <a
        class="flex items-center gap-2.5 text-lg font-extrabold no-underline"
        href="/"
        aria-label="AndroMiner home"
      >
        <img class="rounded-lg" :src="images.logo" alt="" width="32" height="32" />
        <span>AndroMiner</span>
      </a>
      <nav class="hidden gap-[clamp(14px,2.5vw,32px)] md:flex" aria-label="Primary">
        <a
          v-for="item in nav"
          :key="item.href"
          class="py-2 font-semibold text-muted no-underline transition-colors hover:text-ink"
          :href="item.href"
          >{{ item.label }}</a
        >
      </nav>
      <div class="flex items-center gap-2">
        <a class="btn" :href="links.download">Download</a>
        <button
          type="button"
          class="grid size-11 cursor-pointer place-items-center rounded-full text-ink hover:bg-surface-2 md:hidden"
          :aria-expanded="open"
          aria-controls="mobile-nav"
          aria-label="Menu"
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
      class="grid border-t border-surface-2 px-gutter pb-3 md:hidden"
      aria-label="Primary"
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
