export type VariantId = 'download' | 'tls' | 'notls';

export interface ReleaseApk {
  variant: VariantId;
  name: string;
  url: string;
  size: number;
  /** Lower-case hex, taken from GitHub's asset digest or the release notes. Null when neither has it. */
  sha256: string | null;
}

export interface ReleaseInfo {
  tag: string;
  publishedAt: string | null;
  url: string;
  prerelease: boolean;
  /** True when GitHub calls it stable but the tag carries -alpha/-beta/-rc. */
  taggedPreview: boolean;
  apks: Partial<Record<VariantId, ReleaseApk>>;
}

interface GitHubAsset {
  name?: unknown;
  size?: unknown;
  digest?: unknown;
  browser_download_url?: unknown;
}

export const latestReleaseUrl = 'https://api.github.com/repos/Stawa/AndroMiner/releases/latest';

const apkPattern = /^androminer-(download|tls|notls)-.+\.apk$/i;
const hex64 = /^[0-9a-f]{64}$/i;

/** Reads `| \`file\` | \`sha\` |` rows from the "SHA256 checksums" table the release workflow appends. */
const checksumsFromNotes = (body: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const row of body.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|/gim)) {
    found.set(row[1]!, row[2]!.toLowerCase());
  }
  return found;
};

/** Turns a GitHub release payload into the three APKs. Never invents a URL, size or checksum. */
export const parseRelease = (raw: unknown): ReleaseInfo => {
  const release = raw as Record<string, unknown>;
  if (typeof release?.tag_name !== 'string' || !Array.isArray(release.assets)) {
    throw new Error('Unexpected release response.');
  }
  const notes = checksumsFromNotes(typeof release.body === 'string' ? release.body : '');
  const apks: ReleaseInfo['apks'] = {};
  for (const asset of release.assets as GitHubAsset[]) {
    const name = typeof asset.name === 'string' ? asset.name : '';
    const match = apkPattern.exec(name);
    const url = asset.browser_download_url;
    if (
      !match ||
      typeof url !== 'string' ||
      !url.startsWith('https://github.com/Stawa/AndroMiner/')
    )
      continue;
    const digest =
      typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')
        ? asset.digest.slice(7)
        : '';
    const sha256 = hex64.test(digest) ? digest.toLowerCase() : (notes.get(name) ?? null);
    const variant = match[1]!.toLowerCase() as VariantId;
    apks[variant] = {
      variant,
      name,
      url,
      size: typeof asset.size === 'number' ? asset.size : 0,
      sha256
    };
  }
  return {
    tag: release.tag_name,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
    url: typeof release.html_url === 'string' ? release.html_url : '',
    prerelease: release.prerelease === true,
    taggedPreview: /-(alpha|beta|rc)/i.test(release.tag_name),
    apks
  };
};

export const loadLatestRelease = async (fetchImpl: typeof fetch = fetch): Promise<ReleaseInfo> => {
  const response = await fetchImpl(latestReleaseUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit'
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
  return parseRelease(await response.json());
};

export const formatSize = (bytes: number): string =>
  bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : 'size not reported';
