<script setup lang="ts">
import { links } from './content';
</script>

<template>
  <footer class="foot">
    <p class="foot-name" aria-hidden="true">AndroMiner</p>
    <nav aria-label="Footer">
      <a :href="links.repo">Source</a>
      <a :href="links.releases">Releases</a>
      <a :href="links.privacy">Privacy</a>
      <a :href="links.engines">Engines</a>
      <a href="/stats">Statistics</a>
    </nav>
    <p class="note">
      Mining on a phone is low-yield and heats the device. App code is MIT; XMRig, XMRigCC and
      XLArig are GPL-3.0.
    </p>
  </footer>
</template>
