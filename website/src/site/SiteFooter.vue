<script setup lang="ts">
import { links } from './content';

const columns = [
  {
    title: 'Product',
    items: [
      { label: 'Features', href: '/#features' },
      { label: 'Download', href: '/#download' },
      { label: 'Releases', href: links.releases },
      { label: 'Statistics', href: '/stats' }
    ]
  },
  {
    title: 'Documentation',
    items: [
      { label: 'Getting started', href: '/docs/getting-started/introduction' },
      { label: 'Architecture', href: '/docs/architecture/application-architecture' },
      { label: 'Components', href: '/docs/components/overview' },
      { label: 'Contributing', href: '/docs/contributing/contribution-guide' }
    ]
  },
  {
    title: 'Project',
    items: [
      { label: 'Source', href: links.repo },
      { label: 'Report a bug', href: links.issues },
      { label: 'Engines', href: links.engines }
    ]
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy policy', href: links.privacy },
      { label: 'Terms of use', href: links.terms }
    ]
  }
];
</script>

<template>
  <footer class="mt-section border-t border-line">
    <div
      class="mx-auto grid max-w-[88rem] gap-x-8 gap-y-12 px-gutter py-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,3fr)] lg:gap-x-16"
    >
      <div class="max-w-sm">
        <p class="mb-3 text-lg font-extrabold">AndroMiner</p>
        <p class="m-0 text-[.9375rem] leading-relaxed text-muted">
          Open-source Android CPU miner. Mining on a phone is low-yield and heats the device.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
        <nav v-for="column in columns" :key="column.title" :aria-label="column.title">
          <p class="eyebrow mb-4">{{ column.title }}</p>
          <ul class="m-0 grid list-none gap-3 p-0">
            <li v-for="item in column.items" :key="item.href">
              <a
                class="inline-block text-[.9375rem] text-muted no-underline transition-colors hover:text-ink"
                :href="item.href"
                >{{ item.label }}</a
              >
            </li>
          </ul>
        </nav>
      </div>
    </div>
    <div class="border-t border-line">
      <p class="mx-auto m-0 max-w-[88rem] px-gutter py-5 text-sm text-muted">
        App code is MIT. XMRig, XMRigCC and XLArig are GPL-3.0.
      </p>
    </div>
  </footer>
</template>
