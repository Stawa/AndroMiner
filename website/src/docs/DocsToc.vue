<script setup lang="ts">
import type { Heading } from './markdown';

defineProps<{ headings: Heading[]; active: string }>();
defineEmits<{ jump: [id: string] }>();
</script>

<template>
  <ul class="m-0 grid list-none gap-0.5 p-0 text-sm">
    <li v-for="h in headings" :key="h.id" :class="h.depth === 3 ? 'pl-3' : ''">
      <a
        class="block border-l-2 py-1.5 pl-3 no-underline transition-colors hover:text-ink"
        :class="h.id === active ? 'border-accent font-bold text-ink' : 'border-line text-muted'"
        :href="`#${h.id}`"
        :aria-current="h.id === active ? 'location' : undefined"
        @click.prevent="$emit('jump', h.id)"
        >{{ h.text }}</a
      >
    </li>
  </ul>
</template>
