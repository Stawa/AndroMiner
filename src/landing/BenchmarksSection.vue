<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { vReveal } from './reveal';
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
  <section id="benchmarks" class="bench" aria-labelledby="bench-title">
    <div class="bench-intro">
      <h2 id="bench-title" v-reveal>What real phones hash</h2>
      <p class="statement">
        Every row is the median of results that people chose to share from the app's benchmark. A
        phone appears once at least <strong>{{ table?.minSamples ?? 3 }}</strong> results are in.
      </p>
      <p class="note" aria-live="polite">{{ summary }}</p>
      <label class="search">
        <span>Find a device</span>
        <input
          v-model="query"
          type="search"
          placeholder="Pixel, Galaxy, Snapdragon…"
          autocomplete="off"
        />
      </label>
    </div>

    <div
      v-reveal
      class="bench-table"
      tabindex="0"
      role="region"
      aria-label="Benchmark results, scrollable"
    >
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.label"
              scope="col"
              :class="{ num: column.numeric, 'hide-s': column.hideSmall }"
              :aria-sort="ariaSort(column.key)"
            >
              <button v-if="column.key" class="sort" type="button" @click="sortBy(column.key)">
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
            <td class="empty" colspan="6">{{ emptyMessage }}</td>
          </tr>
          <tr v-for="row in rows" :key="`${row.device}-${row.abi}`">
            <th scope="row">
              {{ row.abi === 'armeabi-v7a' ? `${row.device} (32-bit)` : row.device }}
            </th>
            <td class="hide-s">{{ row.soc }}</td>
            <td class="num">{{ row.cpuThreads }}</td>
            <td class="num">
              <strong>{{ rate.format(row.median) }}</strong>
            </td>
            <td class="num hide-s">{{ number.format(row.min) }} to {{ number.format(row.max) }}</td>
            <td class="num">{{ number.format(row.samples) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="bench-how">
      <h3 v-reveal>Add your phone</h3>
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
