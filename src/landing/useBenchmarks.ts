import { computed, ref } from 'vue';

export interface BenchmarkDevice {
  device: string;
  soc: string | null;
  abi: string;
  cpuThreads: number;
  samples: number;
  median: number;
  min: number;
  max: number;
}

interface BenchmarkTable {
  minSamples: number;
  totalSubmissions: number;
  devices: BenchmarkDevice[];
}

export type SortKey = 'device' | 'cpuThreads' | 'median' | 'samples';

const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || '').replace(/\/+$/, '');

/** Public benchmark table: loads once, then filters and sorts in the browser. */
export const useBenchmarks = () => {
  const table = ref<BenchmarkTable | null>(null);
  const status = ref<'loading' | 'ready' | 'failed'>('loading');
  const query = ref('');
  const sortKey = ref<SortKey>('median');
  const descending = ref(true);

  const rows = computed(() => {
    const needle = query.value.trim().toLowerCase();
    const factor = descending.value ? -1 : 1;
    const key = sortKey.value;
    return (table.value?.devices ?? [])
      .filter((row) => `${row.device} ${row.soc ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) =>
        key === 'device' ? factor * a.device.localeCompare(b.device) : factor * (a[key] - b[key])
      );
  });

  const sortBy = (key: SortKey): void => {
    if (sortKey.value === key) descending.value = !descending.value;
    else {
      sortKey.value = key;
      descending.value = key !== 'device';
    }
  };

  const load = async (): Promise<void> => {
    status.value = 'loading';
    try {
      const response = await fetch(`${endpoint}/v1/benchmarks`, { credentials: 'omit' });
      if (!response.ok) throw new Error(String(response.status));
      table.value = (await response.json()) as BenchmarkTable;
      status.value = 'ready';
    } catch {
      status.value = 'failed';
    }
  };

  return { table, status, query, sortKey, descending, rows, sortBy, load };
};

export interface PublicTotals {
  downloads: number | null;
  monthlyActive: number | null;
}

/** Download and active-install totals for the privacy section; null when unavailable. */
export const loadTotals = async (): Promise<PublicTotals | null> => {
  try {
    const response = await fetch(`${endpoint}/v1/stats`, { credentials: 'omit' });
    if (!response.ok) return null;
    const stats = (await response.json()) as {
      active?: { monthly?: number };
      downloads?: { total?: number } | null;
    };
    const downloads = stats.downloads?.total;
    const monthlyActive = stats.active?.monthly;
    return {
      downloads: typeof downloads === 'number' ? downloads : null,
      monthlyActive: typeof monthlyActive === 'number' ? monthlyActive : null
    };
  } catch {
    return null;
  }
};
