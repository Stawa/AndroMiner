<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { vReveal } from '../site/reveal';
import { useBenchmarks, type SortKey } from './useBenchmarks';

const { table, status, query, sortKey, descending, rows, sortBy, load } = useBenchmarks();
onMounted(load);

const number = new Intl.NumberFormat();
const rate = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const columns: { key: SortKey | null; label: string; numeric: boolean; hideSmall: boolean }[] = [
  { key: 'device', label: 'Device', numeric: false, hideSmall: false },
  { key: null, label: 'Chip', numeric: false, hideSmall: true },
  { key: 'cpuThreads', label: 'Threads', numeric: true, hideSmall: false },
  { key: 'median', label: 'Median H/s', numeric: true, hideSmall: false },
  { key: null, label: 'Range', numeric: true, hideSmall: true },
  { key: 'samples', label: 'Results', numeric: true, hideSmall: false }
];

const summary = computed(() => {
  if (status.value === 'loading') return 'Loading results…';
  if (!table.value) return 'The benchmark table could not be loaded right now.';
  return `${number.format(table.value.totalSubmissions)} results from ${number.format(table.value.devices.length)} listed devices.`;
});
const emptyMessage = computed(() => {
  if (status.value === 'failed') return 'Results could not be loaded right now. Try again later.';
  if (status.value === 'loading') return 'Loading…';
  return table.value?.devices.length
    ? 'No device matches that search.'
    : 'No phone has enough results yet. Yours could be the first.';
});
const ariaSort = (key: SortKey | null): 'ascending' | 'descending' | 'none' | undefined =>
  key === null
    ? undefined
    : key !== sortKey.value
      ? 'none'
      : descending.value
        ? 'descending'
        : 'ascending';
</script>

<template>
  <section
    id="benchmarks"
    class="grid grid-cols-1 items-start gap-[clamp(28px,5vw,72px)] bg-surface py-[clamp(48px,8vw,112px)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]"
    aria-labelledby="bench-title"
  >
    <div class="grid gap-2">
      <h2 id="bench-title" v-reveal class="max-w-[20ch] text-h2">What real phones hash</h2>
      <p class="mt-4 text-lead">
        Every row is the median of results that people chose to share from the app's benchmark. A
        phone appears once at least <strong>{{ table?.minSamples ?? 3 }}</strong> results are in.
      </p>
      <p class="text-[.9375rem] text-muted" aria-live="polite">{{ summary }}</p>
      <label class="mt-4 grid gap-2 font-bold">
        <span>Find a device</span>
        <input
          v-model="query"
          type="search"
          class="w-full rounded-control border border-line bg-surface-2 px-4 py-3.5 text-base text-ink placeholder:text-muted"
          placeholder="Pixel, Galaxy, Snapdragon…"
          autocomplete="off"
        />
      </label>
    </div>

    <div
      v-reveal
      class="overflow-x-auto card"
      tabindex="0"
      role="region"
      aria-label="Benchmark results, scrollable"
    >
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.label"
              scope="col"
              :class="[column.numeric && 'num', column.hideSmall && 'max-md:hidden']"
              :aria-sort="ariaSort(column.key)"
            >
              <button
                v-if="column.key"
                class="inline-flex cursor-pointer items-center gap-1.5 hover:text-ink"
                type="button"
                @click="sortBy(column.key)"
              >
                {{ column.label }}
                <span aria-hidden="true">{{
                  sortKey === column.key ? (descending ? '↓' : '↑') : ''
                }}</span>
              </button>
              <template v-else>{{ column.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td class="px-4 py-7 text-muted" colspan="6">{{ emptyMessage }}</td>
          </tr>
          <tr v-for="row in rows" :key="`${row.device}-${row.abi}`">
            <th scope="row">
              {{ row.abi === 'armeabi-v7a' ? `${row.device} (32-bit)` : row.device }}
            </th>
            <td class="max-md:hidden">{{ row.soc }}</td>
            <td class="num">{{ row.cpuThreads }}</td>
            <td class="num">
              <strong class="text-lg text-accent-text">{{ rate.format(row.median) }}</strong>
            </td>
            <td class="num max-md:hidden">
              {{ number.format(row.min) }} to {{ number.format(row.max) }}
            </td>
            <td class="num">{{ number.format(row.samples) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      class="grid grid-cols-1 gap-[clamp(28px,5vw,72px)] lg:col-span-full lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]"
    >
      <h3 v-reveal class="text-h2">Add your phone</h3>
      <div v-reveal="1">
        <p>
          Open the app, go to Device, stop any mining and run the benchmark. It takes about a
          minute, uses every core and needs no pool or wallet. Afterwards the app shows exactly what
          sharing would send and asks before anything leaves the phone.
        </p>
        <p>
          Shared: device model, chip name, CPU architecture, thread count, miner and app version,
          and the speed. Not shared: wallet, pool, location or any ID. Results cannot be linked to
          you, so they also cannot be deleted later.
        </p>
      </div>
    </div>
  </section>
</template>
