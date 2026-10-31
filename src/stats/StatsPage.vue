<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BarList from './BarList.vue';
import type { BarRow } from './BarList.vue';
import TrendChart from './TrendChart.vue';
import type { Breakdown, PublicStats } from './types';

const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || '').replace(/\/+$/, '');
const repoUrl = 'https://github.com/Stawa/AndroMiner';

const stats = ref<PublicStats | null>(null);
const failed = ref(false);
const loading = ref(true);

const regionNames = new Intl.DisplayNames(undefined, { type: 'region' });
const number = new Intl.NumberFormat();
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
    if (!endpoint && import.meta.env.PROD === false) {
      throw new Error('No statistics service is configured for this build.');
    }
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
  stats.value
    ? new Date(stats.value.generatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : ''
);

const published = (breakdown: Breakdown): boolean =>
  breakdown.published && breakdown.groups.length > 0;
const rowsOf = (breakdown: Breakdown, label: (key: string) => string): BarRow[] =>
  breakdown.groups.map((group) => ({
    label: label(group.key),
    count: group.count,
    share: group.share
  }));
const notesOf = (breakdown: Breakdown, other: string, unshared?: string) => [
  ...(breakdown.other ? [{ label: other, count: breakdown.other }] : []),
  ...(unshared && breakdown.unshared ? [{ label: unshared, count: breakdown.unshared }] : [])
];

const activeFor = (tag: string): number | null => {
  const wanted = tag.replace(/^v/i, '');
  return stats.value?.appVersions.groups.find((group) => group.key === wanted)?.count ?? null;
};
</script>

<template>
  <div class="page">
    <header class="bar">
      <a class="brand" :href="repoUrl">AndroMiner <span>Usage</span></a>
      <nav aria-label="Project links">
        <a :href="`${repoUrl}/blob/main/docs/statistics-methodology.md`">Methodology</a>
        <a :href="`${repoUrl}/blob/main/docs/privacy.md`">Privacy</a>
        <a :href="repoUrl">Source</a>
      </nav>
    </header>

    <main>
      <div class="title">
        <h1>How many people use AndroMiner</h1>
        <p>
          Anonymous check-ins from people who opted in, plus public GitHub download counts. These
          are estimates, not a census.
        </p>
      </div>

      <p v-if="loading" class="state" role="status">Loading statistics…</p>
      <div v-else-if="failed" class="state panel" role="alert">
        <p>The statistics service could not be reached. This does not affect the app.</p>
        <button type="button" class="retry" @click="load">Try again</button>
      </div>

      <template v-else-if="stats">
        <section class="hero" aria-labelledby="active-heading">
          <div class="figures">
            <h2 id="active-heading" class="sr-only">Active installations</h2>
            <p class="big">
              <span class="value">{{ number.format(stats.active.monthly) }}</span>
              <span class="what">active installations in the last 30 days</span>
            </p>
            <dl class="windows">
              <div>
                <dt>Today</dt>
                <dd>{{ number.format(stats.active.daily) }}</dd>
              </div>
              <div>
                <dt>Last 7 days</dt>
                <dd>{{ number.format(stats.active.weekly) }}</dd>
              </div>
            </dl>
            <p class="dl">
              <span class="value">{{ downloads ? number.format(downloads.total ?? 0) : '—' }}</span>
              <span class="what">
                release downloads
                <small>GitHub APK requests, not people or devices.</small>
              </span>
            </p>
          </div>

          <div class="panel">
            <h2>Daily active installations</h2>
            <TrendChart :points="dailyPoints" title="Daily active installations" />
          </div>
        </section>

        <div class="split">
          <section class="panel" aria-labelledby="geo">
            <h2 id="geo">Countries</h2>
            <BarList
              v-if="published(stats.countries)"
              :rows="rowsOf(stats.countries, (key) => `${countryName(key)} (${key})`)"
              :notes="
                notesOf(
                  stats.countries,
                  `Other countries (fewer than ${stats.minGroupSize} each)`,
                  'Country not shared'
                )
              "
            />
            <p v-else class="empty">
              Countries appear once at least {{ stats.minGroupSize }} installations have reported,
              so no single installation can be picked out.
            </p>
            <p class="foot">
              Chosen by users in Settings, never detected from location or IP address.
            </p>
          </section>

          <div class="stack">
            <section class="panel" aria-labelledby="android">
              <h2 id="android">Android versions</h2>
              <BarList
                v-if="published(stats.androidVersions)"
                :rows="rowsOf(stats.androidVersions, (key) => `Android ${key}`)"
                :notes="notesOf(stats.androidVersions, 'Other')"
              />
              <p v-else class="empty">Not enough reports to publish yet.</p>
            </section>
            <section class="panel" aria-labelledby="variants">
              <h2 id="variants">APK variants</h2>
              <BarList
                v-if="published(stats.variants)"
                :rows="rowsOf(stats.variants, (key) => variantLabels[key] ?? key)"
                :notes="notesOf(stats.variants, 'Other')"
              />
              <p v-else class="empty">Not enough reports to publish yet.</p>
            </section>
          </div>
        </div>

        <section class="panel" aria-labelledby="versions">
          <h2 id="versions">Versions</h2>
          <table v-if="downloads?.releases?.length">
            <thead>
              <tr>
                <th scope="col">Release</th>
                <th scope="col" class="num">Active</th>
                <th scope="col" class="num">Downloads</th>
                <th scope="col" class="meter"><span class="sr-only">Share of downloads</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="release in downloads.releases" :key="release.tag">
                <th scope="row">
                  {{ release.tag }}
                  <small v-if="release.prerelease">pre-release</small>
                </th>
                <td class="num">
                  {{
                    activeFor(release.tag) === null ? '—' : number.format(activeFor(release.tag)!)
                  }}
                </td>
                <td class="num">{{ number.format(release.total) }}</td>
                <td class="meter" aria-hidden="true">
                  <span class="track"
                    ><span
                      class="fill"
                      :style="{ width: `${(release.total / maxRelease) * 100}%` }"
                  /></span>
                </td>
              </tr>
            </tbody>
          </table>
          <BarList
            v-else-if="published(stats.appVersions)"
            :rows="rowsOf(stats.appVersions, (key) => key)"
            :notes="notesOf(stats.appVersions, 'Other')"
          />
          <p v-else class="empty">
            Version figures appear once enough installations have reported.
          </p>
          <p class="foot">
            <template v-if="downloads">
              Downloads come from the GitHub Releases API<template v-if="downloads.fetchedAt"
                >, last fetched {{ new Date(downloads.fetchedAt).toLocaleString() }}</template
              >. A download is one HTTP request and may be a repeat, a mirror or a bot.
            </template>
            <template v-else>Download counts are temporarily unavailable.</template>
          </p>
        </section>

        <div class="split even">
          <section class="panel" aria-labelledby="monthly">
            <h2 id="monthly">Monthly active installations</h2>
            <TrendChart :points="monthlyPoints" title="Monthly active installations" kind="bar" />
          </section>
          <section class="panel" aria-labelledby="dltrend">
            <h2 id="dltrend">Release downloads over time</h2>
            <TrendChart :points="downloadPoints" title="Cumulative release downloads" />
          </section>
        </div>

        <footer>
          <p>
            Only installations that turned reporting on are counted, so every installation figure is
            a lower bound. Individual records are removed after
            {{ stats.retentionDays }} days of inactivity. Updated {{ updated }}.
          </p>
        </footer>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 0 var(--spacing-page, 16px) 64px;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0;
}
.brand {
  font-weight: 750;
  font-size: 1.0625rem;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.brand span {
  color: rgb(var(--color-app-muted));
  font-weight: 550;
  margin-left: 6px;
}
nav {
  display: flex;
  gap: 20px;
  font-size: 0.875rem;
}
nav a {
  color: rgb(var(--color-app-muted));
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
nav a:hover {
  color: rgb(var(--color-app-on));
}
main {
  display: grid;
  gap: 16px;
}
.title {
  padding: 24px 0 12px;
}
h1 {
  margin: 0 0 12px;
  font-size: clamp(1.75rem, 4.5vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  max-width: 20ch;
}
.title p {
  margin: 0;
  max-width: 56ch;
  color: rgb(var(--color-app-muted));
  line-height: 1.6;
}
h2 {
  margin: 0 0 16px;
  font-size: 0.9375rem;
  font-weight: 650;
}
.panel {
  background: rgb(var(--color-app-card));
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-panel, 16px);
  padding: clamp(16px, 2vw, 24px);
  min-width: 0;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 16px;
  align-items: stretch;
}
.figures {
  display: grid;
  align-content: space-between;
  gap: 28px;
  padding: 8px 0;
}
.value {
  display: block;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
}
.big .value {
  font-size: clamp(3.5rem, 9vw, 6rem);
  color: rgb(var(--color-app-green));
}
.dl .value {
  font-size: 2.25rem;
}
.what {
  display: block;
  margin-top: 8px;
  color: rgb(var(--color-app-muted));
  font-size: 0.9375rem;
}
.what small {
  display: block;
  margin-top: 2px;
  font-size: 0.8125rem;
}
.big,
.dl {
  margin: 0;
}
.windows {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: start;
  gap: 28px;
}
.windows dt {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
}
.windows dd {
  margin: 2px 0 0;
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
}
.split.even {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.stack {
  display: grid;
  gap: 16px;
  align-content: start;
}
.foot,
.empty,
footer p {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
  line-height: 1.6;
  max-width: 64ch;
}
.foot {
  margin: 20px 0 0;
}
.empty {
  margin: 0;
}
footer {
  padding: 16px 4px 0;
}
footer p {
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
th,
td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid rgb(var(--color-app-line));
  font-weight: 500;
}
thead th {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
  padding-top: 0;
}
tbody th {
  font-weight: 650;
}
tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.meter {
  width: 35%;
  padding-left: 20px;
}
.track {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: rgb(var(--color-app-elevated));
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: rgb(var(--color-app-green));
  border-radius: 3px;
}
small {
  color: rgb(var(--color-app-muted));
  font-weight: 500;
  margin-left: 6px;
}
.state {
  color: rgb(var(--color-app-muted));
}
.retry {
  margin-top: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-control, 12px);
  background: transparent;
  color: rgb(var(--color-app-on));
  cursor: pointer;
}
a:focus-visible,
button:focus-visible {
  outline: 2px solid rgb(var(--color-app-green));
  outline-offset: 2px;
}

@media (max-width: 860px) {
  .hero,
  .split,
  .split.even {
    grid-template-columns: minmax(0, 1fr);
  }
  .meter {
    display: none;
  }
}
@media (max-width: 480px) {
  .brand span {
    display: none;
  }
  .windows {
    gap: 20px;
  }
  nav {
    gap: 12px;
  }
}
</style>
