<script setup lang="ts">
import { images, links, nav } from './content';
</script>

<template>
  <header class="bar">
    <a class="brand" href="/" aria-label="AndroMiner home">
      <img :src="images.logo" alt="" width="32" height="32" />
      <span>AndroMiner</span>
    </a>
    <nav aria-label="Primary">
      <a v-for="item in nav" :key="item.href" :href="item.href">{{ item.label }}</a>
    </nav>
    <a class="button" :href="links.download">Download</a>
  </header>
</template>
