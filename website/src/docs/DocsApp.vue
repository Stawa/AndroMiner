<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SiteFooter from '../site/SiteFooter.vue';
import SiteHeader from '../site/SiteHeader.vue';
import generated from './components.generated.json';
import ComponentDocs from './ComponentDocs.vue';
import { categories, notes, type ComponentCategory } from './componentNotes';
import { markdownFor } from './content';
import DocsSearch from './DocsSearch.vue';
import DocsSidebar from './DocsSidebar.vue';
import DocsToc from './DocsToc.vue';
import { renderMarkdown, slugify, type Heading } from './markdown';
import { pages, sectionOf, type DocPage } from './nav';

const first = pages[0]!.slug;
const normalise = (path: string): string => path.replace(/^\/docs\/?/, '').replace(/\/+$/, '');

const slug = ref(normalise(location.pathname));
if (!slug.value) {
  slug.value = first;
  history.replaceState(null, '', `/docs/${first}`);
}

const page = computed<DocPage | undefined>(() => pages.find((p) => p.slug === slug.value));
const section = computed(() => sectionOf(slug.value));
const position = computed(() => pages.findIndex((p) => p.slug === slug.value));
const previous = computed(() => (position.value > 0 ? pages[position.value - 1] : undefined));
const next = computed(() =>
  position.value >= 0 && position.value < pages.length - 1 ? pages[position.value + 1] : undefined
);

const componentCategory = computed(() =>
  page.value && slug.value.startsWith('components/')
    ? (categories.find((c) => `components/${c.id}` === slug.value)?.id as
        ComponentCategory | undefined)
    : undefined
);

const rendered = computed(() => {
  const source = page.value?.markdown ? markdownFor(slug.value) : undefined;
  return source ? renderMarkdown(source) : null;
});

const headings = computed<Heading[]>(() => {
  if (rendered.value) return rendered.value.headings;
  if (componentCategory.value) {
    return (generated as { name: string }[])
      .filter((doc) => notes[doc.name]?.category === componentCategory.value)
      .map((doc) => ({ id: slugify(doc.name), text: doc.name, depth: 2 }));
  }
  return [];
});

// Mobile chrome: a slide-in page menu and an "On this page" dropdown.
const menuOpen = ref(false);
const tocOpen = ref(false);
const drawer = ref<HTMLElement | null>(null);
const menuButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const searchOpen = ref(false);
const desktop = window.matchMedia('(min-width: 1024px)');

const openMenu = async (): Promise<void> => {
  menuOpen.value = true;
  tocOpen.value = false;
  await nextTick();
  closeButton.value?.focus();
};
const closeMenu = (): void => {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  menuButton.value?.focus();
};
watch(menuOpen, (open) => {
  document.documentElement.style.overflow = open ? 'hidden' : '';
});

const go = (path: string): void => {
  const target = normalise(path.split('#')[0]!);
  const hash = path.includes('#') ? path.slice(path.indexOf('#')) : '';
  history.pushState(null, '', `/docs/${target || first}${hash}`);
  slug.value = target || first;
  menuOpen.value = false;
  tocOpen.value = false;
  searchOpen.value = false;
  void scrollToHash();
};

// New pages jump instantly; in-page links glide.
const scrollToHash = async (behavior: 'instant' | 'smooth' | 'auto' = 'instant'): Promise<void> => {
  await nextTick();
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id ? document.getElementById(id) : null;
  if (el) el.scrollIntoView({ behavior });
  else window.scrollTo({ top: 0, behavior });
  spy();
};

const jump = (id: string): void => {
  history.replaceState(null, '', `#${id}`);
  tocOpen.value = false;
  void scrollToHash('smooth');
};

const onClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement;
  const copy = target.closest<HTMLButtonElement>('.copy-code');
  if (copy) {
    const code = copy.parentElement?.querySelector('code')?.textContent ?? '';
    navigator.clipboard?.writeText(code).then(
      () => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1500);
      },
      () => {}
    );
    return;
  }
  if (tocOpen.value && !target.closest('#doc-toc-mobile, #doc-toc-button')) tocOpen.value = false;
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === '/docs' || url.pathname.startsWith('/docs/')) {
    event.preventDefault();
    if (url.pathname === location.pathname && url.hash) {
      history.replaceState(null, '', url.hash);
      void scrollToHash('smooth');
    } else go(url.pathname + url.hash);
  }
};

const onPop = (): void => {
  slug.value = normalise(location.pathname) || first;
  void scrollToHash();
};

// Scroll-spy: the active heading is the last one that has passed just under the sticky chrome.
const activeHeading = ref('');
let frame = 0;
const spy = (): void => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    let current = headings.value[0]?.id ?? '';
    for (const heading of headings.value) {
      const el = document.getElementById(heading.id);
      // Same offset the browser uses when jumping to the heading, so a clicked link becomes active.
      if (
        el &&
        el.getBoundingClientRect().top <= parseFloat(getComputedStyle(el).scrollMarginTop) + 8
      )
        current = heading.id;
    }
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (atEnd && headings.value.length) current = headings.value[headings.value.length - 1]!.id;
    activeHeading.value = current;
  });
};
watch(headings, () => nextTick(spy));

const title = computed(() =>
  page.value ? `${page.value.title} · AndroMiner Docs` : 'Not found · AndroMiner Docs'
);
const setMeta = (): void => {
  document.title = title.value;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', page.value?.description ?? 'AndroMiner documentation.');
};
watch(title, setMeta);

const openSearch = (): void => {
  menuOpen.value = false;
  tocOpen.value = false;
  searchOpen.value = true;
};

const onKey = (event: KeyboardEvent): void => {
  const typing = (event.target as HTMLElement).matches('input, textarea, select');
  if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key === 'k')) {
    event.preventDefault();
    openSearch();
  } else if (event.key === 'Escape') {
    if (menuOpen.value) closeMenu();
    tocOpen.value = false;
  } else if (event.key === 'Tab' && menuOpen.value && !desktop.matches) {
    // Keep keyboard focus inside the open drawer.
    const items = [
      ...(drawer.value?.querySelectorAll<HTMLElement>('button, a[href], input') ?? [])
    ].filter((el) => el.offsetParent !== null);
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (!firstEl || !lastEl) return;
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }
};

const onViewport = (): void => {
  if (desktop.matches) {
    menuOpen.value = false;
    tocOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('popstate', onPop);
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  desktop.addEventListener('change', onViewport);
  setMeta();
  void scrollToHash();
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onClick);
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('popstate', onPop);
  window.removeEventListener('scroll', spy);
  window.removeEventListener('resize', spy);
  desktop.removeEventListener('change', onViewport);
  document.documentElement.style.overflow = '';
});
</script>

<template>
  <a
    class="absolute top-[-100px] left-gutter z-[60] bg-accent px-4 py-2.5 font-bold text-on-accent focus:top-3"
    href="#doc-main"
    >Skip to content</a
  >
  <SiteHeader />

  <!-- Mobile and tablet: page menu and "On this page" live in one sticky bar. -->
  <div class="sticky top-(--header-h) z-10 border-b border-line bg-ground lg:hidden">
    <div class="flex items-center gap-2 px-gutter py-2">
      <button
        ref="menuButton"
        type="button"
        class="btn-ghost !px-3.5 !py-2 text-sm"
        aria-label="Menu"
        :aria-expanded="menuOpen"
        aria-controls="doc-nav"
        @click="openMenu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span class="max-sm:sr-only">Menu</span>
      </button>
      <p class="m-0 min-w-0 flex-1 truncate font-mono text-xs text-muted">
        {{ section?.title ?? 'Docs' }} /
        <span class="text-ink">{{ page?.title }}</span>
      </p>
      <button
        type="button"
        class="btn-ghost grid !size-10 shrink-0 place-items-center !p-0"
        aria-label="Search docs"
        aria-haspopup="dialog"
        @click="openSearch"
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
      </button>
      <button
        v-if="headings.length > 1"
        id="doc-toc-button"
        type="button"
        class="btn-ghost !px-3.5 !py-2 text-sm"
        :aria-expanded="tocOpen"
        aria-controls="doc-toc-mobile"
        @click="tocOpen = !tocOpen"
      >
        <span class="whitespace-nowrap">On this page</span>
        <svg
          class="transition-transform motion-reduce:transition-none"
          :class="tocOpen ? 'rotate-180' : ''"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
    <div
      v-if="tocOpen"
      id="doc-toc-mobile"
      class="max-h-[55vh] overflow-y-auto border-t border-line px-gutter py-3"
    >
      <DocsToc :headings="headings" :active="activeHeading" @jump="jump" />
    </div>
  </div>

  <div
    v-if="menuOpen"
    class="fixed inset-0 z-40 bg-black/60 lg:hidden"
    aria-hidden="true"
    @click="closeMenu"
  ></div>

  <div
    class="mx-auto grid max-w-[88rem] gap-x-10 px-gutter lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_14rem]"
  >
    <aside
      id="doc-nav"
      ref="drawer"
      class="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm overflow-y-auto overscroll-contain border-r border-line bg-ground p-4 transition-transform duration-200 motion-reduce:transition-none lg:visible lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:bottom-auto lg:left-auto lg:max-h-[calc(100vh-var(--header-h)-2rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:py-4"
      :class="menuOpen ? 'translate-x-0' : 'invisible -translate-x-full'"
      aria-label="Documentation"
    >
      <div class="mb-4 flex items-center justify-between lg:hidden">
        <p class="m-0 font-extrabold">Documentation</p>
        <button
          ref="closeButton"
          type="button"
          class="grid size-11 cursor-pointer place-items-center rounded-full hover:bg-surface-2"
          aria-label="Close menu"
          @click="closeMenu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <DocsSidebar :slug="slug" @go="go" @search="openSearch" />
    </aside>

    <main id="doc-main" class="min-w-0 py-8 lg:py-12">
      <template v-if="page">
        <nav class="mb-6 hidden font-mono text-xs text-muted lg:block" aria-label="Breadcrumb">
          <ol class="m-0 flex list-none flex-wrap gap-2 p-0">
            <li>
              <a href="/docs/getting-started/introduction" class="no-underline hover:text-ink"
                >Docs</a
              >
            </li>
            <li aria-hidden="true">/</li>
            <li>{{ section?.title }}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" class="text-ink">{{ page.title }}</li>
          </ol>
        </nav>
        <article class="prose">
          <h1 v-if="!rendered">{{ page.title }}</h1>
          <div v-if="rendered" v-html="rendered.html"></div>
          <ComponentDocs v-else-if="componentCategory" :category="componentCategory" />
        </article>
        <p v-if="page.markdown" class="mt-10 text-sm text-muted">
          <a
            class="underline"
            :href="`https://github.com/Stawa/AndroMiner/blob/main/website/src/docs/content/${page.slug}.md`"
            >Edit this page on GitHub</a
          >
        </p>
        <nav class="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Previous and next pages">
          <a
            v-if="previous"
            :href="`/docs/${previous.slug}`"
            class="card block p-4 no-underline hover:border-muted"
            rel="prev"
          >
            <span class="block font-mono text-xs text-muted">← Previous</span>
            <span class="font-bold">{{ previous.title }}</span>
          </a>
          <span v-else></span>
          <a
            v-if="next"
            :href="`/docs/${next.slug}`"
            class="card block p-4 text-right no-underline hover:border-muted"
            rel="next"
          >
            <span class="block font-mono text-xs text-muted">Next →</span>
            <span class="font-bold">{{ next.title }}</span>
          </a>
        </nav>
      </template>
      <template v-else>
        <h1 class="text-h2">Page not found</h1>
        <p class="text-muted">There is no documentation page at this address.</p>
        <a class="btn" :href="`/docs/${first}`">Go to the introduction</a>
      </template>
    </main>

    <aside
      v-if="headings.length > 1"
      class="hidden xl:sticky xl:top-[calc(var(--header-h)+1rem)] xl:block xl:max-h-[calc(100vh-var(--header-h)-2rem)] xl:self-start xl:overflow-y-auto xl:py-12"
      aria-label="On this page"
    >
      <p class="eyebrow">On this page</p>
      <DocsToc :headings="headings" :active="activeHeading" @jump="jump" />
    </aside>
  </div>
  <SiteFooter />
  <DocsSearch :open="searchOpen" @close="searchOpen = false" @go="go" />
</template>
