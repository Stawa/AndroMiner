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
      { label: 'Privacy', href: links.privacy },
      { label: 'Engines', href: links.engines }
    ]
  }
];
</script>

<template>
  <footer class="mt-section border-t border-line py-12">
    <div class="mx-auto grid max-w-[88rem] gap-10 px-gutter md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div>
        <p class="mb-2 text-lg font-extrabold">AndroMiner</p>
        <p class="text-[.9375rem] text-muted">
          Open-source Android CPU miner. App code is MIT; XMRig, XMRigCC and XLArig are GPL-3.0.
          Mining on a phone is low-yield and heats the device.
        </p>
      </div>
      <nav v-for="column in columns" :key="column.title" :aria-label="column.title">
        <p class="eyebrow">{{ column.title }}</p>
        <ul class="m-0 grid list-none gap-2.5 p-0">
          <li v-for="item in column.items" :key="item.href">
            <a class="text-[.9375rem] text-muted no-underline hover:text-ink" :href="item.href">{{
              item.label
            }}</a>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
</template>
