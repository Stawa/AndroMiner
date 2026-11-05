<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BarList from './BarList.vue';
import type { BarRow } from './BarList.vue';
import TrendChart from './TrendChart.vue';
import type { LeaderboardEntry } from '../utils/telemetryClient';
import { countryFlag } from '../utils/countryFlag';
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
const leaderboard = ref<LeaderboardEntry[]>([]);
// The ranking is a bonus panel: if it cannot be fetched, the rest of the page still works.
const loadLeaderboard = async (): Promise<void> => {
  try {
    const response = await fetch(`${endpoint}/v1/leaderboard`, { credentials: 'omit' });
    if (!response.ok) return;
    const body = (await response.json()) as { entries?: LeaderboardEntry[] };
    leaderboard.value = Array.isArray(body.entries) ? body.entries : [];
  } catch {
    leaderboard.value = [];
  }
};
const hoursAndMinutes = (seconds: number): string =>
  `${number.format(Math.floor(seconds / 3600))} h ${Math.floor((seconds % 3600) / 60)} m`;
onMounted(() => {
  void load();
  void loadLeaderboard();
});

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

type SeriesId = 'daily' | 'monthly' | 'downloads';
const series = computed<
  Array<{ id: SeriesId; label: string; points: { label: string; value: number }[]; bar?: boolean }>
>(() => [
  { id: 'daily', label: 'Daily active', points: dailyPoints.value },
  { id: 'monthly', label: 'Monthly active', points: monthlyPoints.value, bar: true },
  { id: 'downloads', label: 'Downloads', points: downloadPoints.value }
]);
const hasData = (points: { value: number }[]): boolean => points.some((p) => p.value > 0);
const picked = ref<SeriesId | null>(null);
// Opens on the first series that has something to draw, so a young product never lands on an empty chart.
const current = computed(
  () =>
    series.value.find((item) => item.id === picked.value) ??
    series.value.find((item) => hasData(item.points)) ??
    series.value[0]
);

const releaseCount = computed(() => downloads.value?.releases?.length ?? 0);
const figures = computed(() => {
  if (!stats.value) return [];
  const installs = {
    label: 'Active installations, 30 days',
    value: number.format(stats.value.active.monthly),
    note: 'Lower bound: only installs with reporting on'
  };
  const dl = {
    label: 'Release downloads',
    value: downloads.value ? number.format(downloads.value.total ?? 0) : '—',
    note: 'GitHub APK requests, not people'
  };
  const lead = stats.value.active.monthly > 0 ? [installs, dl] : [dl, installs];
  return [
    ...lead,
    {
      label: 'Last 7 days',
      value: number.format(stats.value.active.weekly),
      note: 'Active installations'
    },
    { label: 'Today', value: number.format(stats.value.active.daily), note: 'Active installations' }
  ];
});
const finding = computed(() => {
  if (!stats.value) return '';
  const { monthly } = stats.value.active;
  const dl = downloads.value
    ? `${number.format(downloads.value.total ?? 0)} APK downloads across ${releaseCount.value} releases`
    : 'Download counts are temporarily unavailable';
  return monthly > 0
    ? `${number.format(monthly)} installations reported in the last 30 days. ${dl}.`
    : `No installation has reported in the last 30 days yet. ${dl}.`;
});

const anyBreakdown = computed(() =>
  stats.value
    ? [stats.value.countries, stats.value.androidVersions, stats.value.variants].some(published)
    : false
);

const PREVIEW_ROWS = 5;
const boardOpen = ref(false);
const boardRows = computed(() =>
  boardOpen.value ? leaderboard.value : leaderboard.value.slice(0, PREVIEW_ROWS)
);

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
        <a :href="`${repoUrl}/blob/main/docs/statistics.md`">Methodology</a>
        <a :href="`${repoUrl}/blob/main/docs/privacy.md`">Privacy</a>
        <a :href="repoUrl">Source</a>
      </nav>
    </header>

    <main>
      <div class="title">
        <div>
          <h1>AndroMiner usage</h1>
          <p v-if="stats" class="finding">{{ finding }}</p>
          <p v-else class="finding">
            Anonymous check-ins from people who leave reporting on, plus public GitHub download
            counts. Estimates, not a census.
          </p>
        </div>
        <div v-if="stats" class="stamp">
          <span>Updated {{ updated }}</span>
          <button type="button" class="ghost" :disabled="loading" @click="load">Refresh</button>
        </div>
      </div>

      <p v-if="loading && !stats" class="state" role="status">Loading statistics…</p>
      <div v-else-if="failed && !stats" class="state panel" role="alert">
        <p>The statistics service could not be reached. This does not affect the app.</p>
        <button type="button" class="ghost" @click="load">Try again</button>
      </div>

      <template v-else-if="stats">
        <section class="figures" aria-label="Headline figures">
          <dl>
            <div v-for="(figure, index) in figures" :key="figure.label" :class="{ lead: !index }">
              <dt>{{ figure.label }}</dt>
              <dd>{{ figure.value }}</dd>
              <small>{{ figure.note }}</small>
            </div>
          </dl>
        </section>

        <div class="split">
          <section class="panel" aria-labelledby="trend">
            <div class="head">
              <h2 id="trend">Growth</h2>
              <div class="tabs" role="group" aria-label="Series">
                <button
                  v-for="item in series"
                  :key="item.id"
                  type="button"
                  :aria-pressed="current.id === item.id"
                  @click="picked = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
            <TrendChart
              v-if="hasData(current.points)"
              :key="current.id"
              :points="current.points"
              :title="current.label"
              :kind="current.bar ? 'bar' : 'line'"
            />
            <p v-else class="empty">
              {{ current.label }} will chart here once there is something to count. Check-ins only
              start when someone turns on usage statistics in the app.
            </p>
          </section>

          <div class="stack">
            <section class="panel" aria-labelledby="board">
              <div class="head">
                <h2 id="board">Leaderboard</h2>
                <span v-if="leaderboard.length" class="muted">Top {{ leaderboard.length }}</span>
              </div>
              <ol v-if="leaderboard.length" class="board">
                <li v-for="entry in boardRows" :key="entry.id">
                  <span class="rank">{{ entry.rank }}</span>
                  <span class="flag" aria-hidden="true">{{ countryFlag(entry.country) }}</span>
                  <span class="who">{{ entry.id }}</span>
                  <span class="time">{{ hoursAndMinutes(entry.miningSeconds) }}</span>
                </li>
              </ol>
              <p v-else class="empty">
                Nobody is ranked yet. Turn on Mining activity under Settings → Usage statistics in
                the app and your ID appears here after your next check-in.
              </p>
              <button
                v-if="leaderboard.length > PREVIEW_ROWS"
                type="button"
                class="ghost more"
                @click="boardOpen = !boardOpen"
              >
                {{ boardOpen ? 'Show fewer' : `Show all ${leaderboard.length}` }}
              </button>
              <p class="foot">
                Random public IDs that cannot be traced to a person or a device. Each app reports
                its own figures; they are not verified.
              </p>
            </section>
            <section v-if="!anyBreakdown" class="panel" aria-labelledby="who">
              <h2 id="who">Countries, Android versions, APK variants</h2>
              <p class="empty">
                These appear once at least {{ stats.minGroupSize }} installations have reported, so
                no single installation can be picked out. Countries are chosen by users in Settings,
                never detected from location or IP address.
              </p>
            </section>
          </div>
        </div>

        <section class="panel" aria-labelledby="versions">
          <h2 id="versions">Releases</h2>
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
          <p v-else class="empty">Version figures appear once enough installations report.</p>
          <p class="foot">
            <template v-if="downloads">
              From the GitHub Releases API<template v-if="downloads.fetchedAt"
                >, fetched {{ new Date(downloads.fetchedAt).toLocaleString() }}</template
              >. A download is one HTTP request and may be a repeat, a mirror or a bot.
            </template>
            <template v-else>Download counts are temporarily unavailable.</template>
          </p>
        </section>

        <div v-if="anyBreakdown" class="trio">
          <template v-if="stats">
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
              <p v-else class="empty">Not enough reports to publish yet.</p>
              <p class="foot">Chosen by users in Settings, never detected.</p>
            </section>
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
          </template>
        </div>

        <footer>
          <p>
            Only installations with reporting turned on are counted, so every installation figure is
            a lower bound. Individual records are removed after
            {{ stats.retentionDays }} days of inactivity.
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
  padding: 16px 0;
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
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  flex-wrap: wrap;
  padding: 16px 0 4px;
}
h1 {
  margin: 0 0 6px;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}
.finding {
  margin: 0;
  max-width: 60ch;
  color: rgb(var(--color-app-muted));
  line-height: 1.55;
}
.stamp {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
}
h2 {
  margin: 0;
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
.panel > h2 {
  margin-bottom: 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.muted {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
}

/* One container split into four cells; the first figure answers the page's question. */
.figures {
  background: rgb(var(--color-app-card));
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-panel, 16px);
  overflow: hidden;
}
.figures dl {
  margin: 0;
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
  gap: 1px;
  background: rgb(var(--color-app-line));
}
.figures dl > div {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: clamp(16px, 2vw, 24px);
  background: rgb(var(--color-app-card));
}
.figures dt {
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
}
.figures dd {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.figures .lead dd {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.figures small {
  color: rgb(var(--color-app-muted));
  font-size: 0.75rem;
  font-weight: 500;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
  align-items: start;
}
.stack {
  display: grid;
  gap: 16px;
}
.trio {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgb(var(--color-app-elevated));
}
.tabs button {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--color-app-muted));
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.tabs button[aria-pressed='true'] {
  background: rgb(var(--color-app-card));
  color: rgb(var(--color-app-on));
  font-weight: 600;
}
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
}
.board li {
  display: grid;
  grid-template-columns: 2rem 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
}
.rank {
  color: rgb(var(--color-app-muted));
  text-align: right;
}
.who {
  font-weight: 600;
  letter-spacing: 0.04em;
}
.time {
  color: rgb(var(--color-app-muted));
}
.more {
  margin-top: 8px;
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
  margin: 16px 0 0;
}
.empty {
  margin: 0;
}
footer {
  padding: 8px 4px 0;
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
tbody small {
  color: rgb(var(--color-app-muted));
  font-weight: 500;
  margin-left: 6px;
}
.state {
  color: rgb(var(--color-app-muted));
}
.ghost {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-control, 12px);
  background: transparent;
  color: rgb(var(--color-app-on));
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
a:focus-visible,
button:focus-visible {
  outline: 2px solid rgb(var(--color-app-green));
  outline-offset: 2px;
}

@media (max-width: 860px) {
  .split,
  .trio {
    grid-template-columns: minmax(0, 1fr);
  }
  .figures dl {
    grid-template-columns: repeat(3, 1fr);
  }
  .figures .lead {
    grid-column: 1 / -1;
  }
  .meter {
    display: none;
  }
}
@media (max-width: 480px) {
  .brand span {
    display: none;
  }
  nav {
    gap: 12px;
  }
  .figures dd {
    font-size: 1.375rem;
  }
  .figures small {
    display: none;
  }
}
</style>
