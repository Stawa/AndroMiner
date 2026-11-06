<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { pages, sectionOf } from './nav';
import { searchDocs } from './search';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; go: [path: string] }>();

const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const list = ref<HTMLElement | null>(null);

const hits = computed(() => searchDocs(query.value));
const suggested = pages.slice(0, 6);
// What the list shows: matches while typing, otherwise a few starting points.
const rows = computed(() =>
  query.value.trim() ? hits.value : suggested.map((page) => ({ page, snippet: page.description }))
);
const terms = computed(() => query.value.toLowerCase().split(/\s+/).filter(Boolean));

// Split text so matched terms can be wrapped in <mark>.
const parts = (text: string): { text: string; hit: boolean }[] => {
  if (!terms.value.length) return [{ text, hit: false }];
  const pattern = new RegExp(
    `(${terms.value.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, hit: terms.value.includes(part.toLowerCase()) }));
};

watch(rows, () => (active.value = 0));
watch(
  () => props.open,
  async (open) => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    query.value = '';
    await nextTick();
    input.value?.focus();
  }
);
watch(active, async () => {
  await nextTick();
  list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
});
onBeforeUnmount(() => (document.documentElement.style.overflow = ''));

const choose = (slug: string): void => emit('go', `/docs/${slug}`);

const onKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!rows.value.length) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    active.value = (active.value + step + rows.value.length) % rows.value.length;
  } else if (event.key === 'Enter' && rows.value[active.value]) {
    event.preventDefault();
    choose(rows.value[active.value]!.page.slug);
  } else if (event.key === 'Tab') {
    // Two focusable controls: keep focus inside the dialog.
    event.preventDefault();
    (document.activeElement === input.value ? closeButton : input).value?.focus();
  }
};
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] flex items-stretch bg-black/60 backdrop-blur-sm sm:items-start sm:justify-center sm:p-6 sm:pt-[12vh]"
    @click.self="emit('close')"
    @keydown="onKey"
  >
    <div
      class="flex h-full w-full flex-col overflow-hidden bg-ground sm:h-auto sm:max-h-[min(34rem,76vh)] sm:max-w-xl sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div class="flex items-center gap-2 border-b border-line px-4 py-2 sm:py-1">
        <svg
          class="shrink-0 text-muted"
          width="20"
          height="20"
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
        <input
          ref="input"
          v-model="query"
          type="text"
          inputmode="search"
          enterkeyhint="go"
          placeholder="Search the docs…"
          autocomplete="off"
          spellcheck="false"
          role="combobox"
          aria-label="Search documentation"
          aria-controls="doc-results"
          aria-expanded="true"
          :aria-activedescendant="rows.length ? `doc-hit-${active}` : undefined"
          class="min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted"
        />
        <button
          v-if="query"
          type="button"
          class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Clear search"
          @click="((query = ''), input?.focus())"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          ref="closeButton"
          type="button"
          class="shrink-0 cursor-pointer rounded-control border border-line px-2.5 py-1.5 font-mono text-xs text-muted hover:text-ink"
          @click="emit('close')"
        >
          <span class="sm:hidden">Close</span><span class="hidden sm:inline">esc</span>
        </button>
      </div>

      <div ref="list" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <p
          v-if="!query.trim()"
          class="m-0 px-3 pt-2 pb-1 font-mono text-[11px] tracking-[0.12em] text-muted uppercase"
        >
          Start here
        </p>
        <ul
          v-if="rows.length"
          id="doc-results"
          class="m-0 grid list-none gap-0.5 p-0"
          role="listbox"
          aria-label="Search results"
        >
          <li
            v-for="(row, i) in rows"
            :id="`doc-hit-${i}`"
            :key="row.page.slug"
            role="option"
            :aria-selected="i === active"
          >
            <a
              :href="`/docs/${row.page.slug}`"
              class="block rounded-control px-3 py-2.5 no-underline"
              :class="i === active ? 'bg-surface-2' : ''"
              @mousemove="active = i"
              @click.prevent.stop="choose(row.page.slug)"
            >
              <span class="flex items-baseline justify-between gap-3">
                <span class="min-w-0 truncate text-sm font-bold text-ink">
                  <template v-for="(p, n) in parts(row.page.title)" :key="n"
                    ><mark v-if="p.hit" class="bg-transparent text-accent-text underline">{{
                      p.text
                    }}</mark
                    ><template v-else>{{ p.text }}</template></template
                  >
                </span>
                <span
                  class="shrink-0 font-mono text-[11px] tracking-wide text-accent-text uppercase"
                  >{{ sectionOf(row.page.slug)?.title }}</span
                >
              </span>
              <span class="mt-1 line-clamp-2 block text-xs text-muted">
                <template v-for="(p, n) in parts(row.snippet)" :key="n"
                  ><mark v-if="p.hit" class="bg-transparent font-semibold text-ink">{{
                    p.text
                  }}</mark
                  ><template v-else>{{ p.text }}</template></template
                >
              </span>
            </a>
          </li>
        </ul>
        <p v-else class="m-0 px-3 py-10 text-center text-sm text-muted" role="status">
          No pages match “{{ query }}”.<br />Try a shorter or different word.
        </p>
      </div>

      <p
        class="m-0 hidden items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[11px] text-muted sm:flex"
      >
        <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
      </p>
    </div>
  </div>
</template>
