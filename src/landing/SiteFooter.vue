<script setup lang="ts">
import { links } from './content';
</script>

<template>
  <footer class="mt-section overflow-hidden px-gutter pb-8">
    <p
      class="m-0 max-w-none text-[clamp(2.5rem,17vw,17rem)] leading-[.9] font-extrabold tracking-[-0.06em] text-surface-2 select-none"
      aria-hidden="true"
    >
      AndroMiner
    </p>
    <nav class="mt-6 mb-4 flex flex-wrap gap-x-7 gap-y-3 font-bold" aria-label="Footer">
      <a :href="links.repo">Source</a>
      <a :href="links.releases">Releases</a>
      <a :href="links.privacy">Privacy</a>
      <a :href="links.engines">Engines</a>
      <a href="/stats">Statistics</a>
    </nav>
    <p class="text-[.9375rem] text-muted">
      Mining on a phone is low-yield and heats the device. App code is MIT; XMRig, XMRigCC and
      XLArig are GPL-3.0.
    </p>
  </footer>
</template>
