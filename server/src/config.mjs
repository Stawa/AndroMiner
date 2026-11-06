const int = (env, name, fallback, min, max) => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
};

export const loadConfig = (env = process.env) => ({
  port: int(env, 'PORT', 8787, 1, 65535),
  host: env.HOST || '127.0.0.1',
  databasePath: env.DATABASE_PATH || './data/stats.sqlite',
  // Install rows must outlive the 30-day window, so retention below 35 days is rejected.
  retentionDays: int(env, 'RETENTION_DAYS', 90, 35, 3650),
  aggregateRetentionDays: int(env, 'AGGREGATE_RETENTION_DAYS', 1095, 90, 36500),
  // Benchmark results are published per device only once this many have been submitted.
  minBenchmarkSamples: int(env, 'MIN_BENCHMARK_SAMPLES', 3, 1, 1000),
  maxBenchmarksPerHour: int(env, 'MAX_BENCHMARKS_PER_HOUR', 1000, 1, 1000000),
  minGroupSize: int(env, 'MIN_GROUP_SIZE', 10, 2, 1000),
  minCheckinIntervalHours: int(env, 'MIN_CHECKIN_INTERVAL_HOURS', 20, 1, 168),
  // Firestore store only: how long computed figures are reused, to stay within its free read quota.
  statsCacheSeconds: int(env, 'STATS_CACHE_SECONDS', 3600, 0, 86400),
  // Enables GET /v1/maintenance/prune for a scheduler (Vercel Cron sends it as a bearer token).
  cronSecret: env.CRON_SECRET || '',
  rateLimitPerMinute: int(env, 'RATE_LIMIT_PER_MINUTE', 30, 1, 10000),
  maxNewInstallsPerHour: int(env, 'MAX_NEW_INSTALLS_PER_HOUR', 2000, 1, 1000000),
  // Set only behind a trusted reverse proxy, e.g. CLIENT_IP_HEADER=cf-connecting-ip.
  clientIpHeader: (env.CLIENT_IP_HEADER || '').toLowerCase(),
  corsOrigin: env.CORS_ORIGIN || '*',
  githubRepo: env.GITHUB_REPO === undefined ? 'Stawa/AndroMiner' : env.GITHUB_REPO,
  githubToken: env.GITHUB_TOKEN || '',
  githubCacheSeconds: int(env, 'GITHUB_CACHE_SECONDS', 3600, 60, 86400)
});
