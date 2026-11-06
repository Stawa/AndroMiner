<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { searchDocs } from './search';
import { sectionOf, sections } from './nav';

const props = defineProps<{ slug: string }>();
const emit = defineEmits<{ go: [path: string] }>();

const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);
const root = ref<HTMLElement | null>(null);

const hits = computed(() => searchDocs(query.value));
watch(hits, () => (active.value = 0));

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
    query.value = '';
    await nextTick();
    root.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  },
  { immediate: true }
);

const onKey = (event: KeyboardEvent): void => {
  if (!hits.value.length) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    active.value = (active.value + step + hits.value.length) % hits.value.length;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    emit('go', `/docs/${hits.value[active.value]!.page.slug}`);
  } else if (event.key === 'Escape') query.value = '';
};

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div ref="root">
    <label class="sr-only" for="doc-search">Search documentation</label>
    <div class="relative mb-4">
      <input
        id="doc-search"
        ref="input"
        v-model="query"
        type="search"
        placeholder="Search docs"
        autocomplete="off"
        role="combobox"
        aria-controls="doc-results"
        :aria-expanded="query.length > 0"
        class="w-full rounded-control border border-line bg-surface py-2.5 pr-12 pl-3 text-base text-ink placeholder:text-muted lg:text-[.9375rem]"
        @keydown="onKey"
      />
      <kbd
        class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-xs text-muted lg:block"
        aria-hidden="true"
        >/</kbd
      >
    </div>

    <ul
      v-if="query"
      id="doc-results"
      class="m-0 grid list-none gap-1 p-0"
      role="listbox"
      aria-label="Search results"
    >
      <li v-for="(hit, i) in hits" :key="hit.page.slug" role="option" :aria-selected="i === active">
        <a
          :href="`/docs/${hit.page.slug}`"
          class="block rounded-control px-3 py-2.5 no-underline hover:bg-surface-2"
          :class="i === active ? 'bg-surface-2' : ''"
        >
          <span class="block text-sm font-bold">{{ hit.page.title }}</span>
          <span class="block font-mono text-[11px] tracking-wide text-accent-text uppercase">{{
            sectionOf(hit.page.slug)?.title
          }}</span>
          <span class="mt-1 block text-xs text-muted">{{ hit.snippet }}</span>
        </a>
      </li>
      <li v-if="!hits.length" class="px-3 py-2 text-sm text-muted" role="status">
        No pages match “{{ query }}”.
      </li>
    </ul>

    <nav v-else aria-label="Documentation pages">
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
