<script setup lang="ts">
import { shot } from './content';

withDefaults(defineProps<{ src: string; alt: string; widthClass?: string; eager?: boolean }>(), {
  widthClass: 'w-full',
  eager: false
});
</script>

<template>
  <div
    class="rounded-[2.25rem] border border-line bg-black p-[7px] shadow-[0_24px_60px_-30px_rgba(0,0,0,.8)]"
    :class="widthClass"
  >
    <img
      class="block w-full rounded-[1.75rem]"
      :src="src"
      :alt="alt"
      :width="shot.width"
      :height="shot.height"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
    />
  </div>
</template>
