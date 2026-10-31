import { dayOf } from './dates.mjs';

const variantOf = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes('-notls-')) return 'notls';
  if (lower.includes('-tls-')) return 'tls';
  if (lower.includes('-download-')) return 'download';
  return 'other';
};

/** Sums APK asset download counts. These count HTTP downloads, not people or installations. */
export const summarizeReleases = (releases) => {
  const byVariant = { tls: 0, notls: 0, download: 0, other: 0 };
  const perRelease = [];
  for (const release of releases) {
    if (release.draft) continue;
    const variants = { tls: 0, notls: 0, download: 0, other: 0 };
    for (const asset of release.assets ?? []) {
      if (!asset.name?.toLowerCase().endsWith('.apk')) continue;
      const count = Number.isInteger(asset.download_count) ? asset.download_count : 0;
      variants[variantOf(asset.name)] += count;
      byVariant[variantOf(asset.name)] += count;
    }
    perRelease.push({
      tag: String(release.tag_name),
      publishedAt: release.published_at ?? null,
      prerelease: Boolean(release.prerelease),
      total: Object.values(variants).reduce((a, b) => a + b, 0),
      variants
    });
  }
  return {
    total: Object.values(byVariant).reduce((a, b) => a + b, 0),
    byVariant,
    releases: perRelease
  };
};

export const createDownloadsSource = ({ config, store, fetchImpl = fetch, now = Date.now }) => {
  let cache = null;
  let inFlight = null;

  const refresh = async () => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'androminer-stats' };
    if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
    const response = await fetchImpl(
      `https://api.github.com/repos/${config.githubRepo}/releases?per_page=100`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    const summary = summarizeReleases(await response.json());
    cache = { summary, fetchedAt: now() };
    await store.saveDownloadSnapshot(
      dayOf(Math.floor(now() / 1000)),
      summary.total,
      summary.byVariant
    );
  };

  const startRefresh = () => {
    inFlight ??= refresh()
      .catch(() => {})
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    /** Never throws. Returns null when disabled; stale data is served while a refresh runs. */
    async get() {
      if (!config.githubRepo) return null;
      const fresh = cache && now() - cache.fetchedAt < config.githubCacheSeconds * 1000;
      if (!fresh) {
        if (cache) void startRefresh();
        else await startRefresh();
      }
      if (!cache) return { available: false };
      return {
        available: true,
        source: 'GitHub Releases API',
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        stale: now() - cache.fetchedAt >= config.githubCacheSeconds * 1000,
        ...cache.summary
      };
    }
  };
};
