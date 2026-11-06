<script setup lang="ts">
import { images, links, shot } from './content';
</script>

<template>
  <section
    class="relative grid items-center gap-6 overflow-hidden pt-[clamp(24px,6vw,72px)] lg:min-h-[min(88vh,860px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]"
    aria-labelledby="hero-title"
  >
    <div
      class="absolute -right-[30vw] -bottom-[30vw] size-[110vw] rounded-full bg-accent lg:top-1/2 lg:-right-[14vw] lg:bottom-auto lg:size-[62vw] lg:-translate-y-1/2"
      aria-hidden="true"
    ></div>
    <div class="relative z-[1]">
      <h1 id="hero-title" class="max-w-[12ch] text-hero">Your phone, measured.</h1>
      <p class="mt-[clamp(24px,3vw,40px)] mb-0 max-w-[36ch] text-lead">
        AndroMiner is an open-source Android app that mines RandomX coins on the phone's CPU,
        watches its heat and battery, and benchmarks the chip honestly.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-5">
        <a class="btn btn-lg" :href="links.download">Download the APK</a>
        <a class="font-bold underline decoration-2 underline-offset-[5px]" href="#benchmarks"
          >See what phones hash</a
        >
      </div>
    </div>
    <img
      class="relative z-[1] mt-10 -mb-[30%] w-[min(100%,340px)] max-w-none animate-rise self-end justify-self-center rounded-t-[28px] motion-reduce:animate-none lg:-mb-[18%]"
      :src="images.overview.src"
      :alt="images.overview.alt"
      :width="shot.width"
      :height="shot.height"
    />
  </section>
</template>
