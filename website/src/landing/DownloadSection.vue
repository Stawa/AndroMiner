<script setup lang="ts">
import { computed, ref } from 'vue';
import { links } from '../site/content';
import { vReveal } from '../site/reveal';
import { formatSize, type VariantId } from '../site/release';
import { useLatestRelease } from '../site/useLatestRelease';
import DownloadConsent from './DownloadConsent.vue';

const variants: { id: VariantId; title: string; summary: string; engines: string }[] = [
  {
    id: 'download',
    title: 'Download',
    summary:
      'Small installer. Fetches a verified miner after you confirm, and asks whether you want TLS or no TLS on first start.',
    engines: 'Miner downloaded for your device after confirmation'
  },
  {
    id: 'tls',
    title: 'TLS',
    summary: 'Miner bundled with TLS support. Connects to encrypted or plain-TCP pools.',
    engines: 'Bundles arm64-v8a and armeabi-v7a engines'
  },
  {
    id: 'notls',
    title: 'No-TLS',
    summary: 'Miner bundled without TLS support. Plain-TCP pools only, smaller than the TLS build.',
    engines: 'Bundles arm64-v8a and armeabi-v7a engines'
  }
];

const { release, state } = useLatestRelease();
const copied = ref('');

const channel = computed(() => {
  const r = release.value;
  if (!r) return '';
  if (r.prerelease) return 'Pre-release';
  return r.taggedPreview ? 'Latest release · tagged beta' : 'Stable';
});
const date = computed(() =>
  release.value?.publishedAt
    ? new Date(release.value.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : ''
);

// Downloads wait for the reader to accept the risk notice. The choice is remembered in this browser.
const ACK_KEY = 'androminer-download-terms-2026-11';
const acknowledged = (): boolean => {
  try {
    return localStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
};
const pending = ref<{ title: string; url: string } | null>(null);
const ask = (event: Event, title: string, url: string): void => {
  if (acknowledged()) return;
  event.preventDefault();
  pending.value = { title, url };
};
const accept = (): void => {
  const url = pending.value?.url;
  try {
    localStorage.setItem(ACK_KEY, '1');
  } catch {
    // Not remembered; the reader will be asked again next time.
  }
  pending.value = null;
  if (url) location.assign(url);
};

const copy = async (name: string, value: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = name;
    setTimeout(() => (copied.value = ''), 1800);
  } catch {
    copied.value = '';
  }
};
</script>

<template>
  <section id="download" aria-labelledby="download-title">
    <p class="eyebrow">Download</p>
    <h2 id="download-title" v-reveal class="max-w-[20ch] text-h2">Pick the APK that fits.</h2>

    <div
      class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      <span v-if="state === 'loading'">Reading the latest release from GitHub…</span>
      <template v-else-if="release">
        <span class="text-base font-bold text-ink">{{ release.tag }}</span>
        <span class="rounded-full border border-line px-2.5 py-0.5 text-xs">{{ channel }}</span>
        <span v-if="date">{{ date }}</span>
        <a class="text-accent-text underline" :href="release.url">Release notes</a>
      </template>
      <span v-else>
        Could not load release details from GitHub.
        <a class="text-accent-text underline" :href="links.releases">Open the Releases page</a>
        instead.
      </span>
    </div>
    <p v-if="release?.taggedPreview" class="mt-3 text-sm text-muted">
      This tag says beta, although GitHub lists it as the latest non-prerelease. Older versions are
      on the <a class="underline" :href="links.releases">Releases page</a>.
    </p>

    <div class="mt-8 grid gap-4 md:grid-cols-3">
      <article
        v-for="(variant, index) in variants"
        :key="variant.id"
        v-reveal="index"
        class="card flex flex-col p-5 sm:p-6"
      >
        <h3 class="mb-2 text-h3">{{ variant.title }}</h3>
        <p class="text-[.9375rem] text-muted">{{ variant.summary }}</p>
        <dl class="mb-5 grid gap-3 text-sm">
          <div>
            <dt class="font-mono text-xs tracking-[0.08em] text-muted uppercase">File</dt>
            <dd class="m-0 font-mono break-all">
              {{ release?.apks[variant.id]?.name ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs tracking-[0.08em] text-muted uppercase">Size</dt>
            <dd class="m-0">
              {{ release?.apks[variant.id] ? formatSize(release.apks[variant.id]!.size) : '—' }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs tracking-[0.08em] text-muted uppercase">Architecture</dt>
            <dd class="m-0">{{ variant.engines }}</dd>
          </div>
          <div>
            <dt class="font-mono text-xs tracking-[0.08em] text-muted uppercase">SHA256</dt>
            <dd class="m-0">
              <template v-if="release?.apks[variant.id]?.sha256">
                <code class="block font-mono text-xs break-all">{{
                  release.apks[variant.id]!.sha256
                }}</code>
                <button
                  type="button"
                  class="mt-1 cursor-pointer text-xs text-accent-text underline"
                  @click="copy(variant.id, release.apks[variant.id]!.sha256!)"
                >
                  {{ copied === variant.id ? 'Copied' : 'Copy checksum' }}
                </button>
              </template>
              <span v-else class="text-muted">{{
                state === 'ready' ? 'Not published for this file' : '—'
              }}</span>
            </dd>
          </div>
        </dl>
        <div class="mt-auto">
          <a
            v-if="release?.apks[variant.id]"
            class="btn w-full"
            :href="release.apks[variant.id]!.url"
            @click="ask($event, variant.title, release.apks[variant.id]!.url)"
            >Download {{ variant.title }} APK</a
          >
          <a v-else class="btn-ghost w-full" :href="release?.url || links.releases">{{
            state === 'ready' ? 'Not attached · open release' : 'Open Releases page'
          }}</a>
        </div>
      </article>
    </div>

    <p class="mt-6 text-sm text-muted">
      Files come straight from
      <a class="underline" :href="links.releases">GitHub Releases</a>. Android declares API 24
      (Android 7) as the minimum, which does not guarantee the mining engine runs on every device;
      see the
      <a class="underline" href="/docs/getting-started/installation">installation guide</a> for
      compatibility and how to verify a checksum.
    </p>
    <p class="mt-3 text-sm text-muted">
      Mining can overheat and damage a phone. By downloading you accept the
      <a class="underline" :href="links.terms">Terms of use</a> and
      <a class="underline" :href="links.privacy">Privacy policy</a>.
    </p>
    <DownloadConsent
      :open="pending !== null"
      :title="pending?.title ?? ''"
      :url="pending?.url ?? ''"
      @close="pending = null"
      @accept="accept"
    />
  </section>
</template>
