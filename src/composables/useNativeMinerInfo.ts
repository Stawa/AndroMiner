import { computed, readonly, ref } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeEngineInfo } from '../utils/engines';

export type AppApkVariant = 'download' | 'tls' | 'notls';
export type InstalledMinerVariant = 'tls' | 'notls' | 'unknown';

export interface NativeMinerBinaryInfo {
  installed: boolean;
  version: string;
  versionOutput: string;
  variant: InstalledMinerVariant;
  variantLabel: string;
  source: 'missing' | 'bundled' | 'downloaded' | 'custom';
  sourceLabel: string;
  abi: string;
  fileName: string;
  path: string;
  sizeBytes: number | null;
  lastModifiedAt: number | null;
  targetSdkVersion: number | null;
  capabilities: {
    cpu: boolean;
    cuda: boolean;
  };
}

interface NativeMinerInfoResponse {
  apkVariant?: string;
  apkVariantLabel?: string;
  miner?: Partial<NativeMinerBinaryInfo>;
  engines?: Array<Partial<NativeEngineInfo>>;
}

interface NativeMinerInfoPlugin {
  info: () => Promise<NativeMinerInfoResponse>;
}

const NativeMiner = registerPlugin<NativeMinerInfoPlugin>('NativeMiner');
const nativePlatform = Capacitor.isNativePlatform();

const formatApkVariant = (variant: AppApkVariant): string => {
  const labels: Record<AppApkVariant, string> = {
    download: 'Download',
    notls: 'No-TLS',
    tls: 'TLS'
  };

  return labels[variant];
};

const normalizeApkVariant = (value: string | undefined): AppApkVariant => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'tls') {
    return 'tls';
  }

  if (normalized === 'notls' || normalized === 'no-tls') {
    return 'notls';
  }

  return 'download';
};

const normalizeInstalledVariant = (value: string | undefined): InstalledMinerVariant => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'tls') {
    return 'tls';
  }

  if (normalized === 'notls' || normalized === 'no-tls') {
    return 'notls';
  }

  return 'unknown';
};

const bundledApkVariant = normalizeApkVariant(import.meta.env.VITE_APP_VARIANT || __APP_VARIANT__);
const apkVariant = ref<AppApkVariant>(bundledApkVariant);
const minerInfo = ref<NativeMinerBinaryInfo>({
  abi: 'arm64-v8a',
  fileName: 'libxmrig.so',
  installed: false,
  lastModifiedAt: null,
  targetSdkVersion: null,
  path: '',
  sizeBytes: null,
  source: nativePlatform ? 'missing' : 'custom',
  sourceLabel: nativePlatform ? 'Not installed' : 'Android app required',
  variant: 'unknown',
  variantLabel: 'Unknown',
  version: '',
  versionOutput: '',
  capabilities: {
    cpu: false,
    cuda: false
  }
});
const engines = ref<NativeEngineInfo[]>([]);
let activeRefresh: Promise<void> | null = null;

const readEngine = (item: Partial<NativeEngineInfo>): NativeEngineInfo => ({
  id: String(item.id ?? ''),
  name: String(item.name ?? item.id ?? ''),
  status:
    item.status === 'supported' || item.status === 'experimental' ? item.status : 'unsupported',
  version: item.version ?? '',
  installedVersion: item.installedVersion ?? null,
  license: item.license ?? '',
  upstream: item.upstream ?? '',
  note: item.note ?? '',
  algorithms: Array.isArray(item.algorithms) ? item.algorithms : [],
  protocols: Array.isArray(item.protocols) ? item.protocols : [],
  abis: Array.isArray(item.abis) ? item.abis : [],
  abiSupported: Boolean(item.abiSupported),
  installed: Boolean(item.installed),
  downloadable: Boolean(item.downloadable),
  downloadApproved: Boolean(item.downloadApproved),
  source: item.source ?? 'missing',
  intensityControl: {
    method: item.intensityControl?.method ?? 'none',
    verifiedOnDevice: Boolean(item.intensityControl?.verifiedOnDevice)
  }
});

const refreshNativeMinerInfo = async (): Promise<void> => {
  if (!nativePlatform) {
    apkVariant.value = bundledApkVariant;
    minerInfo.value = {
      ...minerInfo.value,
      installed: false,
      source: 'custom',
      sourceLabel: 'Android app required',
      variant: 'unknown',
      variantLabel: 'Unknown',
      version: '',
      versionOutput: '',
      targetSdkVersion: null,
      capabilities: {
        cpu: false,
        cuda: false
      }
    };
    return;
  }

  const info = await NativeMiner.info();
  const nextApkVariant = normalizeApkVariant(info.apkVariant);
  const nextMiner = info.miner ?? {};
  engines.value = Array.isArray(info.engines) ? info.engines.map(readEngine) : [];
  const nextInstalledVariant = normalizeInstalledVariant(nextMiner.variant);

  apkVariant.value = nextApkVariant;
  minerInfo.value = {
    abi: nextMiner.abi || 'arm64-v8a',
    fileName: nextMiner.fileName || 'libxmrig.so',
    installed: Boolean(nextMiner.installed),
    lastModifiedAt:
      typeof nextMiner.lastModifiedAt === 'number' && nextMiner.lastModifiedAt > 0
        ? nextMiner.lastModifiedAt
        : null,
    path: nextMiner.path || '',
    sizeBytes:
      typeof nextMiner.sizeBytes === 'number' && nextMiner.sizeBytes > 0
        ? nextMiner.sizeBytes
        : null,
    source: nextMiner.source || 'missing',
    sourceLabel: nextMiner.sourceLabel || 'Not installed',
    variant: nextInstalledVariant,
    variantLabel: nextMiner.variantLabel || 'Unknown',
    version: nextMiner.version || '',
    versionOutput: nextMiner.versionOutput || '',
    targetSdkVersion:
      typeof nextMiner.targetSdkVersion === 'number' && nextMiner.targetSdkVersion > 0
        ? nextMiner.targetSdkVersion
        : null,
    capabilities: {
      cpu: Boolean(nextMiner.capabilities?.cpu),
      cuda: Boolean(nextMiner.capabilities?.cuda)
    }
  };
};

const refreshOnce = (): Promise<void> => {
  if (!activeRefresh) {
    activeRefresh = refreshNativeMinerInfo()
      .catch(() => {
        apkVariant.value = bundledApkVariant;
      })
      .finally(() => {
        activeRefresh = null;
      });
  }

  return activeRefresh;
};

export const useNativeMinerInfo = () => ({
  apkVariant: readonly(apkVariant),
  apkVariantLabel: computed(() => formatApkVariant(apkVariant.value)),
  minerInfo: readonly(minerInfo),
  engines: readonly(engines),
  refreshNativeMinerInfo: refreshOnce
});
