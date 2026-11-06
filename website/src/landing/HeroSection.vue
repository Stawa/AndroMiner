<script setup lang="ts">
import PhoneFrame from '../site/PhoneFrame.vue';
import { images, links } from '../site/content';
import { useLatestRelease } from '../site/useLatestRelease';

const { release } = useLatestRelease();
</script>

<template>
  <section
    class="grid items-center gap-12 pt-[clamp(32px,6vw,88px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]"
    aria-labelledby="hero-title"
  >
    <div>
      <p class="eyebrow">
        Open source · Android ·
        <span v-if="release">{{ release.tag }}</span>
        <span v-else>XMRig compatible</span>
      </p>
      <h1 id="hero-title" class="max-w-[14ch] text-hero">Mining, reimagined for Android.</h1>
      <p class="mt-7 mb-0 max-w-[44ch] text-lead text-muted">
        An open-source Android CPU miner built with XMRig compatibility, configurable mining
        profiles, and device protection.
      </p>
      <div class="mt-9 flex flex-wrap items-center gap-3">
        <a class="btn btn-lg" href="#download">Download APK</a>
        <a class="btn-ghost btn-lg" :href="links.repo">View on GitHub</a>
      </div>
      <p class="mt-6 mb-0 font-mono text-xs text-muted">
        <template v-if="release">Latest release {{ release.tag }} · </template>MIT app code · Mining
        on a phone is low-yield and heats the device
      </p>
    </div>
    <PhoneFrame
      class="animate-rise justify-self-center motion-reduce:animate-none lg:justify-self-end"
      :src="images.overview.src"
      :alt="images.overview.alt"
      width-class="w-[min(72vw,300px)] lg:w-[320px]"
      eager
    />
  </section>
</template>
