const median = (sorted) => {
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Reduces stored submissions to one row per device and CPU architecture. The median resists a few
 * bogus or throttled results, and a device is published only once `minSamples` results exist, so a
 * single submission never appears on its own. Both stores feed this so they publish identically.
 */
export const computeBenchmarks = (rows, minSamples, nowSeconds) => {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.device}\u0000${row.abi}`;
    const group = groups.get(key) ?? {
      device: row.device,
      abi: row.abi,
      soc: null,
      rates: [],
      threads: new Map()
    };
    group.soc ??= row.soc;
    group.rates.push(row.hashrate);
    group.threads.set(row.cpuThreads, (group.threads.get(row.cpuThreads) ?? 0) + 1);
    groups.set(key, group);
  }
  const devices = [...groups.values()]
    .filter((group) => group.rates.length >= minSamples)
    .map((group) => {
      const rates = group.rates.sort((a, b) => a - b);
      const [cpuThreads] = [...group.threads].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      return {
        device: group.device,
        soc: group.soc,
        abi: group.abi,
        cpuThreads,
        samples: rates.length,
        median: Math.round(median(rates) * 10) / 10,
        min: rates[0],
        max: rates[rates.length - 1]
      };
    })
    .sort((a, b) => b.median - a.median || a.device.localeCompare(b.device));
  return {
    generatedAt: new Date(nowSeconds * 1000).toISOString(),
    minSamples,
    totalSubmissions: rows.length,
    devices
  };
};
