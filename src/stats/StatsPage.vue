<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import TrendChart from './TrendChart.vue';
import type { Breakdown, PublicStats } from './types';

const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || '').replace(/\/+$/, '');
const repoUrl = 'https://github.com/Stawa/AndroMiner';

const stats = ref<PublicStats | null>(null);
const failed = ref(false);
const loading = ref(true);

const regionNames = new Intl.DisplayNames(undefined, { type: 'region' });
const number = new Intl.NumberFormat();
const percent = (share: number): string => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

const flag = (code: string): string =>
  String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
const countryName = (code: string): string => regionNames.of(code) || code;
const variantLabels: Record<string, string> = {
  tls: 'TLS bundled',
  notls: 'No-TLS bundled',
  download: 'Downloader',
  other: 'Other'
};

const load = async (): Promise<void> => {
  loading.value = true;
  failed.value = false;
  try {
    if (!endpoint) throw new Error('No statistics service is configured for this build.');
    const response = await fetch(`${endpoint}/v1/stats`, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stats.value = (await response.json()) as PublicStats;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
};
onMounted(load);

const downloads = computed(() =>
  stats.value?.downloads?.available ? stats.value.downloads : null
);
const dailyPoints = computed(() =>
  (stats.value?.history.daily ?? []).slice(-90).map((p) => ({ label: p.day, value: p.count }))
);
const monthlyPoints = computed(() =>
  (stats.value?.history.monthly ?? []).slice(-24).map((p) => ({ label: p.month, value: p.count }))
);
const downloadPoints = computed(() =>
  (stats.value?.downloads?.history ?? []).map((p) => ({ label: p.day, value: p.total }))
);
const maxRelease = computed(() =>
  Math.max(1, ...(downloads.value?.releases ?? []).map((release) => release.total))
);
const updated = computed(() =>
  stats.value ? new Date(stats.value.generatedAt).toLocaleString() : ''
);
const shown = (breakdown: Breakdown): boolean => breakdown.published && breakdown.groups.length > 0;
const installsForVersion = (tag: string): number | null => {
  const wanted = tag.replace(/^v/i, '');
  const match = stats.value?.appVersions.groups.find((group) => group.key === wanted);
  return match ? match.count : null;
};
</script>

<template>
  <main class="stats-page">
    <header class="stats-hero">
      <p class="eyebrow">AndroMiner</p>
      <h1>Community statistics</h1>
      <p class="lede">
        Aggregate figures from people who opted in to anonymous usage statistics, plus public GitHub
        download counts. These are estimates, not a census.
      </p>
    </header>

    <p v-if="loading" class="state" role="status">Loading statistics…</p>
    <div v-else-if="failed" class="state card" role="alert">
      <p>The statistics service could not be reached. This does not affect the app.</p>
      <button type="button" class="retry" @click="load">Try again</button>
    </div>

    <template v-else-if="stats">
      <section aria-labelledby="overview">
        <h2 id="overview">Overview</h2>
        <div class="tiles">
          <div class="card tile">
            <span class="value">{{ downloads ? number.format(downloads.total ?? 0) : '—' }}</span>
            <span class="name">Release downloads</span>
            <span class="hint">GitHub APK downloads. Not people or devices.</span>
          </div>
          <div class="card tile">
            <span class="value">{{ number.format(stats.active.monthly) }}</span>
            <span class="name">Estimated active installations</span>
            <span class="hint">Opted-in installations seen in the last 30 days</span>
          </div>
          <div class="card tile">
            <span class="value">{{ number.format(stats.active.daily) }}</span>
            <span class="name">Daily active</span>
            <span class="hint">Checked in during the last 24 hours</span>
          </div>
          <div class="card tile">
            <span class="value">{{ number.format(stats.active.weekly) }}</span>
            <span class="name">Weekly active</span>
            <span class="hint">Checked in during the last 7 days</span>
          </div>
          <div class="card tile">
            <span class="value">{{ number.format(stats.active.monthly) }}</span>
            <span class="name">Monthly active</span>
            <span class="hint">Checked in during the last 30 days</span>
          </div>
        </div>
        <p class="note">
          Only installations that turned reporting on are counted, so every installation figure is a
          lower bound. A download is one HTTP request for an APK and may be a repeat, a mirror, or a
          bot; it is never a unique user, device or installation.
        </p>
      </section>

      <section aria-labelledby="geo">
        <h2 id="geo">Geographic distribution</h2>
        <div class="card">
          <ol v-if="shown(stats.countries)" class="rank">
            <li v-for="group in stats.countries.groups" :key="group.key">
              <span class="flag" aria-hidden="true">{{ flag(group.key) }}</span>
              <span class="label">{{ group.key }} — {{ countryName(group.key) }}</span>
              <span class="count">{{ number.format(group.count) }}</span>
              <span class="share">{{ percent(group.share) }}</span>
              <span class="bar" :style="{ width: percent(group.share) }" aria-hidden="true" />
            </li>
            <li v-if="stats.countries.other" class="muted">
              <span class="flag" aria-hidden="true">🌐</span>
              <span class="label">Other countries (fewer than {{ stats.minGroupSize }} each)</span>
              <span class="count">{{ number.format(stats.countries.other) }}</span>
            </li>
            <li v-if="stats.countries.unshared" class="muted">
              <span class="flag" aria-hidden="true">·</span>
              <span class="label">Country not shared</span>
              <span class="count">{{ number.format(stats.countries.unshared) }}</span>
            </li>
          </ol>
          <p v-else class="empty">
            Country statistics appear once at least {{ stats.minGroupSize }} installations have
            reported, so no individual installation can be singled out.
          </p>
        </div>
        <p class="note">
          Countries are chosen by users in Settings. They are never detected from location or IP
          address. A country is listed only if at least {{ stats.minGroupSize }} installations chose
          it.
        </p>
      </section>

      <section aria-labelledby="platform">
        <h2 id="platform">Platform distribution</h2>
        <div class="grid">
          <div
            v-for="item in [
              {
                title: 'Android versions',
                data: stats.androidVersions,
                label: (k: string) => `Android ${k}`
              },
              { title: 'AndroMiner versions', data: stats.appVersions, label: (k: string) => k },
              {
                title: 'APK variants',
                data: stats.variants,
                label: (k: string) => variantLabels[k] ?? k
              }
            ]"
            :key="item.title"
            class="card"
          >
            <h3>{{ item.title }}</h3>
            <ul v-if="shown(item.data)" class="rank compact">
              <li v-for="group in item.data.groups" :key="group.key">
                <span class="label">{{ item.label(group.key) }}</span>
                <span class="count">{{ number.format(group.count) }}</span>
                <span class="share">{{ percent(group.share) }}</span>
                <span class="bar" :style="{ width: percent(group.share) }" aria-hidden="true" />
              </li>
              <li v-if="item.data.other" class="muted">
                <span class="label">Other</span>
                <span class="count">{{ number.format(item.data.other) }}</span>
              </li>
            </ul>
            <p v-else class="empty">Not enough reports to publish.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="trends">
        <h2 id="trends">Adoption trends</h2>
        <div class="grid">
          <div class="card">
            <h3>Daily active installations</h3>
            <TrendChart :points="dailyPoints" title="Daily active installations" />
          </div>
          <div class="card">
            <h3>Monthly active installations</h3>
            <TrendChart :points="monthlyPoints" title="Monthly active installations" kind="bar" />
          </div>
          <div class="card">
            <h3>Release downloads over time</h3>
            <TrendChart :points="downloadPoints" title="Cumulative release downloads" />
          </div>
        </div>
      </section>

      <section aria-labelledby="releases">
        <h2 id="releases">Downloads by release</h2>
        <div class="card">
          <template v-if="downloads">
            <ul class="rank compact">
              <li v-for="release in downloads.releases" :key="release.tag">
                <span class="label"
                  >{{ release.tag }}
                  <small v-if="installsForVersion(release.tag) !== null">
                    · {{ number.format(installsForVersion(release.tag) ?? 0) }} active</small
                  ></span
                >
                <span class="count">{{ number.format(release.total) }}</span>
                <span
                  class="bar"
                  :style="{ width: `${(release.total / maxRelease) * 100}%` }"
                  aria-hidden="true"
                />
              </li>
            </ul>
            <h3>By APK variant</h3>
            <ul class="rank compact">
              <li v-for="(count, key) in downloads.byVariant" :key="key">
                <span class="label">{{ variantLabels[key] ?? key }}</span>
                <span class="count">{{ number.format(count) }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="empty">Download counts are temporarily unavailable.</p>
        </div>
        <p class="note">
          Source: GitHub Releases API
          <template v-if="downloads?.fetchedAt"
            >, cached, last fetched {{ new Date(downloads.fetchedAt).toLocaleString() }}</template
          >. Counts include repeated downloads and do not represent installations.
        </p>
      </section>

      <footer class="foot">
        <p>
          Generated {{ updated }}. Individual records are removed after
          {{ stats.retentionDays }} days of inactivity.
          <a :href="`${repoUrl}/blob/main/docs/statistics-methodology.md`">Methodology</a> ·
          <a :href="`${repoUrl}/blob/main/docs/privacy.md`">Privacy policy</a> ·
          <a :href="repoUrl">Source code</a>
        </p>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.stats-page {
  max-width: 64rem;
  margin: 0 auto;
  padding: 32px 16px 64px;
  display: grid;
  gap: 32px;
}
.eyebrow {
  margin: 0;
  color: rgb(var(--color-app-green));
  font-weight: 650;
  font-size: 0.8125rem;
}
h1 {
  margin: 4px 0 8px;
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  line-height: 1.15;
}
h2 {
  margin: 0 0 12px;
  font-size: 1.125rem;
}
h3 {
  margin: 0 0 12px;
  font-size: 0.875rem;
}
.lede,
.note,
.empty,
.foot {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
  line-height: 1.65;
  max-width: 62ch;
}
.note {
  margin: 12px 0 0;
}
.card {
  background: rgb(var(--color-app-card));
  border-radius: var(--radius-panel, 16px);
  padding: 16px;
  min-width: 0;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: 12px;
}
.tile {
  display: grid;
  gap: 4px;
}
.value {
  font-size: 1.75rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.name {
  font-weight: 600;
  font-size: 0.8125rem;
}
.hint {
  color: rgb(var(--color-app-muted));
  font-size: 0.75rem;
  line-height: 1.5;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 12px;
}
.rank {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.rank li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto 3.5rem;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  font-size: 0.8125rem;
  overflow: hidden;
}
.rank.compact li {
  grid-template-columns: 1fr auto 3.5rem;
}
.rank .count,
.rank .share {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rank .bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: rgb(var(--color-app-green));
  border-radius: 2px;
  opacity: 0.8;
}
.rank .muted {
  color: rgb(var(--color-app-muted));
}
.flag {
  font-size: 1.125rem;
}
.state {
  color: rgb(var(--color-app-muted));
}
.retry {
  margin-top: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgb(var(--color-app-line));
  border-radius: 12px;
  background: transparent;
  color: rgb(var(--color-app-on));
}
.foot a {
  color: rgb(var(--color-app-green));
}
small {
  color: rgb(var(--color-app-muted));
}
</style>
