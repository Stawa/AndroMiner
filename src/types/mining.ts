export type MiningState = 'idle' | 'starting' | 'mining' | 'paused';

export type MiningProfile = 'battery_saver' | 'balanced' | 'performance' | 'custom';

export type MiningProtocol =
  | 'stratum'
  | 'stratum+tcp'
  | 'stratum+ssl'
  | 'stratum+tls'
  | 'daemon'
  | 'daemon+ssl'
  | 'self-select'
  | 'xmrig-proxy'
  | 'ssl'
  | 'tls'
  | 'tcp'
  | 'http'
  | 'https'
  | 'solo'
  | 'nicehash';

export type CpuAffinity = 'auto' | 'little' | 'big' | 'custom';

export type CpuPriority = 'low' | 'normal' | 'high';

export interface Cryptocurrency {
  id: string;
  name: string;
  symbol: string;
  algorithm: string;
  xmrigAlgo: string;
  miner: 'xmrig' | 'external';
  minerName?: string;
  supportStatus: 'bundled' | 'custom-miner-required';
  supportNote?: string;
  defaultPort: number;
  defaultPoolUrl: string;
  defaultProtocol: MiningProtocol;
  walletAddressPattern: string;
  poolExamples: Array<{
    name: string;
    host: string;
    port: number;
    protocol: MiningProtocol;
    notes: string;
  }>;
  logoText: string;
  logoClass: string;
}

export interface MiningConfig {
  coin: Cryptocurrency;
  algorithm: string;
  poolUrl: string;
  poolPort: number;
  protocol: MiningProtocol;
  walletAddress: string;
  workerName: string;
  password: string;
  threadCount: number;
  customThreadCount: number;
  totalDetectedThreads: number;
  affinity: CpuAffinity;
  priority: CpuPriority;
  donateLevel: number;
  donateOverProxy: number;
  hugePagesSupported: boolean;
  hugePagesEnabled: boolean;
  batteryAwareMode: boolean;
  autoPauseOnBattery: boolean;
  autoPauseScreenOff: boolean;
  backgroundMining: boolean;
  thermalThreshold: number;
  profile: MiningProfile;
}

export interface MiningStats {
  hashrate: number;
  difficulty: number | null;
  networkLatencyMs: number | null;
  acceptedShares: number;
  rejectedShares: number;
  cpuUsage: number;
  minerCpuUsage: number | null;
  temperature: number;
  batteryLevel: number;
  isCharging: boolean;
  activeThreads: number;
  estimatedEarnings: number;
  uptimeSeconds: number;
}

export interface MiningApiTelemetry {
  available: boolean;
  source: string;
  host: string;
  port: number;
  lastUpdatedAt: number | null;
  message: string;
  summary?: unknown;
  backends?: unknown;
  hashrate?: unknown;
  results?: unknown;
  connection?: unknown;
  threadHashrates?: number[];
}

export interface HistoryPoint {
  label: string;
  value: number;
}

export interface MiningSessionHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  coinSymbol: string;
  coinLogoText: string;
  coinLogoClass: string;
  durationSeconds: number;
  acceptedShares: number;
  rejectedShares: number;
  averageHashrate: number;
  startedAt: string;
  endedAt: string;
}

export interface MiningTelemetry {
  state: MiningState;
  connected: boolean;
  config: MiningConfig;
  stats: MiningStats;
  hashrateHistory: HistoryPoint[];
  temperatureHistory: HistoryPoint[];
  logs: string[];
  apiTelemetry: MiningApiTelemetry;
  isLoading: boolean;
}

export interface ProfilePreset {
  id: MiningProfile;
  label: string;
  description: string;
  threads: number;
  thermalLimit: number;
  priority: CpuPriority;
}

export interface SavedMiningProfile {
  id: string;
  name: string;
  coinId: string;
  createdAt: string;
  updatedAt: string;
  config: MiningConfig;
}

export interface DeviceTelemetry {
  platform: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  batteryLevel: number;
  isCharging: boolean;
  cpuThreads: number;
  deviceMemoryGb: number | null;
  temperatureC: number | null;
  thermalStatus: 'unknown' | 'cool' | 'normal' | 'warm' | 'hot' | 'unavailable';
  thermalSource: 'native' | 'battery' | 'estimated' | 'unavailable';
  thermalSensorName: string | null;
}
