<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SiteFooter from '../site/SiteFooter.vue';
import SiteHeader from '../site/SiteHeader.vue';
import BarList from './BarList.vue';
import type { BarRow } from './BarList.vue';
import TrendChart from './TrendChart.vue';
import type { LeaderboardEntry } from '../../../src/utils/telemetryClient';
import { countryFlag } from '../../../src/utils/countryFlag';
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

// Shared class strings: the page repeats these, and Tailwind reads them as plain text.
const panel = 'min-w-0 rounded-2xl border border-line bg-surface p-[clamp(16px,2vw,24px)]';
const head = 'mb-4 flex flex-wrap items-center justify-between gap-3';
const h2 = 'm-0 text-[.9375rem] font-semibold';
const note = 'm-0 max-w-[64ch] text-[.8125rem] leading-relaxed text-muted';
const ghost =
  'min-h-9 cursor-pointer rounded-control border border-line px-3.5 text-[.8125rem] disabled:cursor-default disabled:opacity-50';
const textLink =
  'font-semibold underline decoration-accent decoration-2 underline-offset-[5px] hover:decoration-current';
const explainer = [
  {
    term: 'Installations',
    text: 'Optional, anonymous check-ins: a random ID, app and Android version, APK type and a country you choose.'
  },
  {
    term: 'Downloads',
    text: 'From the GitHub Releases API. They count HTTP requests, not people.'
  },
  { term: 'Never collected', text: 'Wallets, pools, or anything about what you mine.' }
];
</script>

<template>
  <SiteHeader />
  <div class="mx-auto max-w-[88rem] px-gutter pt-6">
    <main class="grid gap-4">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-4 pb-1">
        <div>
          <h1 class="mb-1.5 text-[1.75rem] leading-tight font-bold tracking-tight">
            AndroMiner usage
          </h1>
          <p v-if="stats" class="m-0 max-w-[60ch] leading-relaxed text-muted">{{ finding }}</p>
          <p v-else class="m-0 max-w-[60ch] leading-relaxed text-muted">
            Anonymous check-ins from people who leave reporting on, plus public GitHub download
            counts. Estimates, not a census.
          </p>
        </div>
        <div v-if="stats" class="flex items-center gap-3 text-[.8125rem] text-muted">
          <span>Updated {{ updated }}</span>
          <button type="button" :class="ghost" :disabled="loading" @click="load">Refresh</button>
        </div>
      </div>

      <section
        class="mt-10 mb-6 grid gap-6 border-t border-line pt-8 md:grid-cols-[5fr_7fr] md:gap-12"
        aria-labelledby="explainer-title"
      >
        <div>
          <h2
            id="explainer-title"
            class="mb-2 text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] font-bold tracking-tight"
          >
            What these numbers are
          </h2>
          <p class="m-0 text-muted">Counts, not people. Here is where each figure comes from.</p>
          <p class="mt-4 mb-0 flex flex-wrap gap-x-5 gap-y-1">
            <a :href="`${repoUrl}/blob/main/docs/statistics.md`" :class="textLink"
              >Methodology <span aria-hidden="true">→</span></a
            >
            <a :href="`${repoUrl}/blob/main/docs/privacy.md`" :class="textLink"
              >Privacy policy <span aria-hidden="true">→</span></a
            >
          </p>
        </div>
        <dl class="m-0 grid">
          <div
            v-for="item in explainer"
            :key="item.term"
            class="grid gap-1.5 border-t border-line py-4 first:border-0 first:pt-0 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-6"
          >
            <dt class="font-semibold">{{ item.term }}</dt>
            <dd class="m-0 max-w-[60ch] leading-relaxed text-muted">{{ item.text }}</dd>
          </div>
        </dl>
      </section>

      <p v-if="loading && !stats" class="text-muted" role="status">Loading statistics…</p>
      <div v-else-if="failed && !stats" :class="panel" class="text-muted" role="alert">
        <p>The statistics service could not be reached. This does not affect the app.</p>
        <button type="button" :class="ghost" @click="load">Try again</button>
      </div>

      <template v-else-if="stats">
        <section
          class="overflow-hidden rounded-2xl border border-line bg-surface"
          aria-label="Headline figures"
        >
          <dl
            class="m-0 grid grid-cols-3 gap-px bg-line min-[860px]:grid-cols-[1.6fr_repeat(3,1fr)]"
          >
            <div
              v-for="(figure, index) in figures"
              :key="figure.label"
              class="grid content-start gap-1.5 bg-surface p-[clamp(16px,2vw,24px)]"
              :class="index ? '' : 'col-span-3 min-[860px]:col-span-1'"
            >
              <dt class="text-[.8125rem] text-muted">{{ figure.label }}</dt>
              <dd
                class="m-0 leading-[1.1] tabular-nums"
                :class="
                  index
                    ? 'text-[1.375rem] font-semibold min-[480px]:text-[1.75rem]'
                    : 'text-[2.5rem] font-bold tracking-tight'
                "
              >
                {{ figure.value }}
              </dd>
              <small class="text-xs font-medium text-muted max-[480px]:hidden">{{
                figure.note
              }}</small>
            </div>
          </dl>
        </section>

        <div class="grid items-start gap-4 min-[860px]:grid-cols-[7fr_5fr]">
          <section :class="panel" aria-labelledby="trend">
            <div :class="head">
              <h2 id="trend" :class="h2">Growth</h2>
              <div
                class="grid w-full grid-cols-3 gap-1 rounded-[10px] bg-surface-2 p-[3px] sm:inline-flex sm:w-auto"
                role="group"
                aria-label="Series"
              >
                <button
                  v-for="item in series"
                  :key="item.id"
                  type="button"
                  class="min-h-8 cursor-pointer rounded-lg px-2 text-xs sm:px-3 sm:text-[.8125rem]"
                  :class="
                    current.id === item.id ? 'bg-surface font-semibold text-ink' : 'text-muted'
                  "
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
            <p v-else :class="note">
              {{ current.label }} will chart here once there is something to count. Check-ins only
              start when someone turns on usage statistics in the app.
            </p>
          </section>

          <div class="grid gap-4">
            <section :class="panel" aria-labelledby="board">
              <div :class="head">
                <h2 id="board" :class="h2">Leaderboard</h2>
                <span v-if="leaderboard.length" class="text-[.8125rem] text-muted"
                  >Top {{ leaderboard.length }}</span
                >
              </div>
              <ol v-if="leaderboard.length" class="m-0 grid list-none p-0">
                <li
                  v-for="entry in boardRows"
                  :key="entry.id"
                  class="grid min-h-11 grid-cols-[2rem_1.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm tabular-nums"
                >
                  <span class="text-right text-muted">{{ entry.rank }}</span>
                  <span aria-hidden="true">{{ countryFlag(entry.country) }}</span>
                  <span class="font-semibold tracking-wide">{{ entry.id }}</span>
                  <span class="text-muted">{{ hoursAndMinutes(entry.miningSeconds) }}</span>
                </li>
              </ol>
              <p v-else :class="note">
                Nobody is ranked yet. Turn on Mining activity under Settings → Usage statistics in
                the app and your ID appears here after your next check-in.
              </p>
              <button
                v-if="leaderboard.length > PREVIEW_ROWS"
                type="button"
                class="mt-2"
                :class="ghost"
                @click="boardOpen = !boardOpen"
              >
                {{ boardOpen ? 'Show fewer' : `Show all ${leaderboard.length}` }}
              </button>
              <p :class="[note, 'mt-4']">
                Random public IDs that cannot be traced to a person or a device. Each app reports
                its own figures; they are not verified.
              </p>
            </section>
            <section v-if="!anyBreakdown" :class="panel" aria-labelledby="who">
              <h2 id="who" :class="[h2, 'mb-4']">Countries, Android versions, APK variants</h2>
              <p :class="note">
                These appear once at least {{ stats.minGroupSize }} installations have reported, so
                no single installation can be picked out. Countries are chosen by users in Settings,
                never detected from location or IP address.
              </p>
            </section>
          </div>
        </div>

        <section :class="panel" aria-labelledby="versions">
          <h2 id="versions" :class="[h2, 'mb-4']">Releases</h2>
          <table
            v-if="downloads?.releases?.length"
            class="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-3 [&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-3 [&_th]:text-left [&_tr:last-child_td]:border-0 [&_tr:last-child_th]:border-0"
          >
            <thead class="text-[.8125rem] text-muted [&_th]:pt-0 [&_th]:font-medium">
              <tr>
                <th scope="col">Release</th>
                <th scope="col" class="!text-right">Active</th>
                <th scope="col" class="!text-right">Downloads</th>
                <th scope="col" class="w-[35%] pl-5 max-[860px]:hidden">
                  <span class="sr-only">Share of downloads</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="release in downloads.releases" :key="release.tag">
                <th scope="row" class="font-semibold">
                  {{ release.tag }}
                  <small v-if="release.prerelease" class="ml-1.5 font-medium text-muted"
                    >pre-release</small
                  >
                </th>
                <td class="text-right whitespace-nowrap tabular-nums">
                  {{
                    activeFor(release.tag) === null ? '—' : number.format(activeFor(release.tag)!)
                  }}
                </td>
                <td class="text-right whitespace-nowrap tabular-nums">
                  {{ number.format(release.total) }}
                </td>
                <td class="w-[35%] !pl-5 max-[860px]:hidden" aria-hidden="true">
                  <span class="block h-1.5 overflow-hidden rounded-[3px] bg-surface-2"
                    ><span
                      class="block h-full rounded-[3px] bg-accent"
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
          <p v-else :class="note">Version figures appear once enough installations report.</p>
          <p :class="[note, 'mt-4']">
            <template v-if="downloads">
              From the GitHub Releases API<template v-if="downloads.fetchedAt"
                >, fetched {{ new Date(downloads.fetchedAt).toLocaleString() }}</template
              >. A download is one HTTP request and may be a repeat, a mirror or a bot.
            </template>
            <template v-else>Download counts are temporarily unavailable.</template>
          </p>
        </section>

        <div v-if="anyBreakdown" class="grid items-start gap-4 min-[860px]:grid-cols-3">
          <section :class="panel" aria-labelledby="geo">
            <h2 id="geo" :class="[h2, 'mb-4']">Countries</h2>
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
            <p v-else :class="note">Not enough reports to publish yet.</p>
            <p :class="[note, 'mt-4']">Chosen by users in Settings, never detected.</p>
          </section>
          <section :class="panel" aria-labelledby="android">
            <h2 id="android" :class="[h2, 'mb-4']">Android versions</h2>
            <BarList
              v-if="published(stats.androidVersions)"
              :rows="rowsOf(stats.androidVersions, (key) => `Android ${key}`)"
              :notes="notesOf(stats.androidVersions, 'Other')"
            />
            <p v-else :class="note">Not enough reports to publish yet.</p>
          </section>
          <section :class="panel" aria-labelledby="variants">
            <h2 id="variants" :class="[h2, 'mb-4']">APK variants</h2>
            <BarList
              v-if="published(stats.variants)"
              :rows="rowsOf(stats.variants, (key) => variantLabels[key] ?? key)"
              :notes="notesOf(stats.variants, 'Other')"
            />
            <p v-else :class="note">Not enough reports to publish yet.</p>
          </section>
        </div>

        <footer class="px-1 pt-2">
          <p :class="note">
            Only installations with reporting turned on are counted, so every installation figure is
            a lower bound. Individual records are removed after
            {{ stats.retentionDays }} days of inactivity.
          </p>
        </footer>
      </template>
    </main>
  </div>
  <SiteFooter />
</template>
