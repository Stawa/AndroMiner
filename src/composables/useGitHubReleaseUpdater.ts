import { computed, readonly, ref } from 'vue';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useAppVersion } from './useAppVersion';

type GitHubUpdateStatus = 'idle' | 'checking' | 'ready' | 'up-to-date' | 'error';

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  assets: GitHubReleaseAsset[];
}

interface CheckForUpdatesOptions {
  minIntervalMs?: number;
}

const githubLatestReleaseUrl = 'https://api.github.com/repos/Stawa/AndroMiner/releases/latest';
const nativePlatform = Capacitor.isNativePlatform();
const {
  displayVersion: currentVersionDisplay,
  refreshAppVersion,
  version: currentVersion
} = useAppVersion();
const status = ref<GitHubUpdateStatus>('idle');
const message = ref('Ready to check GitHub releases.');
const availableVersion = ref('');
const releaseUrl = ref('');
const releaseName = ref('');
const releasedAt = ref('');
const apkAssets = ref<GitHubReleaseAsset[]>([]);
const lastCheckedAt = ref('');
let activeCheck: Promise<void> | null = null;
let lastCheckStartedAt = 0;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unable to check GitHub releases.';
};

const normalizeVersion = (value: string): string => value.trim().replace(/^v/i, '');

const parseVersion = (value: string): number[] | null => {
  const match = normalizeVersion(value).match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }

  return [
    Number.parseInt(match[1] ?? '0', 10),
    Number.parseInt(match[2] ?? '0', 10),
    Number.parseInt(match[3] ?? '0', 10)
  ];
};

const compareVersions = (left: string, right: string): number | null => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  if (!leftParts || !rightParts) {
    return null;
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }

    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
  }

  return 0;
};

const sortApkAssets = (assets: GitHubReleaseAsset[]): GitHubReleaseAsset[] =>
  assets
    .filter((asset) => asset.name.toLowerCase().endsWith('.apk'))
    .sort((left, right) => {
      const score = (asset: GitHubReleaseAsset): number => {
        const name = asset.name.toLowerCase();

        if (name.includes('-tls-')) {
          return 0;
        }

        if (name.includes('-download-')) {
          return 1;
        }

        if (name.includes('-notls-')) {
          return 2;
        }

        return 3;
      };

      return score(left) - score(right) || left.name.localeCompare(right.name);
    });

const formatAssetLabel = (asset: GitHubReleaseAsset): string => {
  const name = asset.name.toLowerCase();

  if (name.includes('-tls-')) {
    return 'TLS bundled APK';
  }

  if (name.includes('-notls-')) {
    return 'No-TLS bundled APK';
  }

  if (name.includes('-download-')) {
    return 'Downloader APK';
  }

  return asset.name;
};

const fetchLatestRelease = async (): Promise<GitHubRelease> => {
  const response = await fetch(githubLatestReleaseUrl, {
    headers: {
      Accept: 'application/vnd.github+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}.`);
  }

  return (await response.json()) as GitHubRelease;
};

const performUpdateCheck = async (): Promise<void> => {
  status.value = 'checking';
  message.value = 'Checking GitHub releases...';

  try {
    await refreshAppVersion();
    const release = await fetchLatestRelease();
    const assets = sortApkAssets(release.assets ?? []);

    lastCheckedAt.value = new Date().toISOString();
    availableVersion.value = release.tag_name;
    releaseUrl.value = release.html_url;
    releaseName.value = release.name || release.tag_name;
    releasedAt.value = release.published_at || '';
    apkAssets.value = assets;

    if (assets.length === 0) {
      status.value = 'error';
      message.value = `GitHub release ${release.tag_name} does not include APK assets.`;
      return;
    }

    const comparison = currentVersion.value
      ? compareVersions(release.tag_name, currentVersion.value)
      : null;

    if (comparison === null) {
      status.value = 'ready';
      message.value = `Latest GitHub release is ${release.tag_name}.`;
      return;
    }

    if (comparison > 0) {
      status.value = 'ready';
      message.value = `Version ${release.tag_name} is available on GitHub.`;
      return;
    }

    status.value = 'up-to-date';
    message.value = `AndroMiner is up to date with ${release.tag_name}.`;
  } catch (error: unknown) {
    status.value = 'error';
    message.value = getErrorMessage(error);
  }
};

const checkForUpdates = async (options: CheckForUpdatesOptions = {}): Promise<void> => {
  const now = Date.now();
  if (options.minIntervalMs && now - lastCheckStartedAt < options.minIntervalMs) {
    return activeCheck ?? Promise.resolve();
  }

  if (activeCheck) {
    return activeCheck;
  }

  lastCheckStartedAt = now;
  activeCheck = performUpdateCheck().finally(() => {
    activeCheck = null;
  });

  return activeCheck;
};

const openUrl = async (url: string): Promise<void> => {
  if (!url) {
    return;
  }

  if (nativePlatform) {
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const useGitHubReleaseUpdater = () => ({
  apkAssets: readonly(apkAssets),
  availableVersion: readonly(availableVersion),
  checkForUpdates,
  checking: computed(() => status.value === 'checking'),
  currentVersion,
  currentVersionDisplay,
  formatAssetLabel,
  lastCheckedAt: readonly(lastCheckedAt),
  message: readonly(message),
  openAsset: (asset: GitHubReleaseAsset) => openUrl(asset.browser_download_url),
  openRelease: () => openUrl(releaseUrl.value),
  refreshCurrentVersion: refreshAppVersion,
  releaseName: readonly(releaseName),
  releasedAt: readonly(releasedAt),
  releaseUrl: readonly(releaseUrl),
  status: readonly(status)
});
