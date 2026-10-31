const DAY = 86_400;
export const HISTORY_DAYS = 365;

/**
 * Groups below `k` are folded into "other" so a rare value cannot single out an installation.
 * When the folded remainder alone is smaller than `k`, the next-smallest group joins it, otherwise
 * the remainder would reveal the suppressed count by subtraction.
 */
export const suppressSmallGroups = (counts, k) => {
  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[1] - b[1]);
  let other = 0;
  while (entries.length && (entries[0][1] < k || (other > 0 && other < k))) {
    other += entries.shift()[1];
  }
  const groups = entries.sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
  return { groups, other };
};

const UNSHARED = '__unshared';
const BREAKDOWN_FIELDS = ['country', 'androidMajor', 'appVersion', 'variant'];

/**
 * Reduces the installations active in the last 30 days (`lastSeen >= now - 30 days`) to the
 * counters the public figures are built from. Both stores use it so they publish identically.
 */
export const tallyInstalls = (installs, nowSeconds) => {
  const active = { daily: 0, weekly: 0, monthly: installs.length };
  const counts = Object.fromEntries(BREAKDOWN_FIELDS.map((field) => [field, {}]));
  for (const install of installs) {
    if (install.lastSeen >= nowSeconds - DAY) active.daily += 1;
    if (install.lastSeen >= nowSeconds - 7 * DAY) active.weekly += 1;
    for (const field of BREAKDOWN_FIELDS) {
      const key = install[field] === null ? UNSHARED : String(install[field]);
      counts[field][key] = (counts[field][key] ?? 0) + 1;
    }
  }
  return { active, counts };
};

const breakdown = (counted, k, total) => {
  const { [UNSHARED]: unshared = 0, ...counts } = counted;
  if (total < k) return { published: false, groups: [], other: 0, unshared: 0 };
  const { groups, other } = suppressSmallGroups(counts, k);
  return {
    published: true,
    groups: groups.map((group) => ({ ...group, share: group.count / total })),
    other,
    unshared
  };
};

/** `inputs` is what a store's `readStatsInputs` returns; `downloads` comes from github.mjs. */
export const computeStats = (inputs, nowSeconds, config, downloads) => {
  const k = config.minGroupSize;
  const monthly = inputs.active.monthly;

  const byDay = new Map();
  for (const row of inputs.versionRows) {
    if (!byDay.has(row.day)) byDay.set(row.day, {});
    byDay.get(row.day)[row.appVersion] = row.count;
  }

  return {
    generatedAt: new Date(nowSeconds * 1000).toISOString(),
    minGroupSize: k,
    retentionDays: config.retentionDays,
    active: inputs.active,
    countries: breakdown(inputs.counts.country, k, monthly),
    androidVersions: breakdown(inputs.counts.androidMajor, k, monthly),
    appVersions: breakdown(inputs.counts.appVersion, k, monthly),
    variants: breakdown(inputs.counts.variant, k, monthly),
    history: {
      daily: inputs.dailyActive,
      monthly: inputs.monthlyActive,
      appVersionsByDay: [...byDay].map(([day, counts]) => {
        const { groups, other } = suppressSmallGroups(counts, k);
        return { day, groups, other };
      })
    },
    downloads: downloads && { ...downloads, history: inputs.downloadHistory }
  };
};
