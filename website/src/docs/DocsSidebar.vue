<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { sectionOf, sections } from './nav';

const props = defineProps<{ slug: string }>();
const emit = defineEmits<{ go: [path: string]; search: [] }>();

const root = ref<HTMLElement | null>(null);

// Only the current section starts open; the reader can open others.
const opened = ref<Record<string, boolean>>({});
const isOpen = (id: string): boolean => opened.value[id] ?? sectionOf(props.slug)?.id === id;
const toggle = (id: string): void => {
  opened.value = { ...opened.value, [id]: !isOpen(id) };
};

watch(
  () => props.slug,
  async () => {
    const id = sectionOf(props.slug)?.id;
    if (id) opened.value = { ...opened.value, [id]: true };
    await nextTick();
    root.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  },
  { immediate: true }
);
</script>

<template>
  <div ref="root">
    <button
      type="button"
      class="mb-4 flex w-full cursor-pointer items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5 text-left text-[.9375rem] text-muted hover:border-muted hover:text-ink"
      aria-haspopup="dialog"
      @click="emit('search')"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span class="flex-1">Search docs</span>
      <kbd
        class="hidden rounded border border-line px-1.5 font-mono text-xs lg:block"
        aria-hidden="true"
        >/</kbd
      >
    </button>

    <nav aria-label="Documentation pages">
      <div
        v-for="item in sections"
        :key="item.id"
        class="mb-1 border-b border-line pb-1 last:border-0"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center justify-between rounded-control px-3 py-2.5 text-left font-mono text-xs tracking-[0.12em] text-accent-text uppercase hover:bg-surface-2"
          :aria-expanded="isOpen(item.id)"
          :aria-controls="`nav-${item.id}`"
          @click="toggle(item.id)"
        >
          <span>{{ item.title }}</span>
          <svg
            class="transition-transform motion-reduce:transition-none"
            :class="isOpen(item.id) ? 'rotate-90' : ''"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <ul
          v-show="isOpen(item.id)"
          :id="`nav-${item.id}`"
          class="m-0 mb-2 grid list-none gap-0.5 p-0"
        >
          <li v-for="p in item.pages" :key="p.slug">
            <a
              :href="`/docs/${p.slug}`"
              class="block rounded-control border-l-2 px-3 py-2 text-[.9375rem] no-underline transition-colors hover:text-ink"
              :class="
                p.slug === slug
                  ? 'border-accent bg-surface-2 font-bold text-ink'
                  : 'border-transparent text-muted'
              "
              :aria-current="p.slug === slug ? 'page' : undefined"
              >{{ p.title }}</a
            >
          </li>
        </ul>
      </div>
    </nav>
  </div>
</template>
