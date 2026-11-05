export type MiningState =
  'idle' | 'starting' | 'mining' | 'reconnecting' | 'pausing' | 'paused' | 'stopping' | 'error';

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

export type MiningHardwareMode = 'cpu';

/** Engines AndroMiner can launch. A saved config without one means XMRig. */
export type MiningEngineId = 'xmrig' | 'xmrigcc' | 'xlarig';

export interface Cryptocurrency {
  id: string;
  name: string;
  symbol: string;
  algorithm: string;
  xmrigAlgo: string;
  miner: 'xmrig' | 'external';
  minerName?: string;
  supportStatus: 'bundled' | 'custom-miner-required';
  /** How this coin's pools attach a worker name to the wallet. Defaults to `.`. */
  workerSeparator?: '.' | '/';
  /** Set when only one engine implements the algorithm (for example XLArig for Panthera). */
  requiredEngine?: MiningEngineId;
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
  engine: MiningEngineId;
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
  hardwareMode: MiningHardwareMode;
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
  maxDurationMinutes: number;
  profile: MiningProfile;
}

export interface MiningStats {
  hashrate: number;
  averageHashrate: number | null;
  peakHashrate: number | null;
  sampleState: 'live' | 'stale' | 'unavailable' | 'inactive';
  difficulty: number | null;
  networkLatencyMs: number | null;
  acceptedShares: number;
  rejectedShares: number;
  cpuUsage: number;
  minerCpuUsage: number | null;
  temperature: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  activeThreads: number;
  estimatedEarnings: number | null;
  uptimeSeconds: number;
  remainingSeconds: number | null;
  deadlineAt: number | null;
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
  averageHashrate: number | null;
  startedAt: string;
  endedAt: string;
  endReason?: string;
  reasonCode?: string;
  algorithm?: string;
  sampleCount?: number;
  sampleWindowSeconds?: number;
  hashingSeconds?: number;
  native?: boolean;
  pool?: string;
  requestedThreads?: number;
  effectiveThreads?: number | null;
  minerVersion?: string | null;
  protectionEvents?: ProtectionEvent[];
  protectionSeconds?: { caution: number; throttled: number };
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
  threads: number;
  affinity: CpuAffinity;
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
  batteryLevel: number | null;
  isCharging: boolean;
  cpuThreads: number;
  cpuName: string;
  cpuClockGhz: number | null;
  cpuClockLabel: string;
  cpuMaxClockGhz: number | null;
  cpuMaxClockLabel: string;
  gpuName: string;
  batteryCurrentMa: number | null;
  batteryVoltageV: number | null;
  powerDrawW: number | null;
  deviceMemoryGb: number | null;
  temperatureC: number | null;
  thermalStatus: 'unknown' | 'cool' | 'normal' | 'warm' | 'hot' | 'unavailable';
  thermalSource: 'native' | 'battery' | 'estimated' | 'unavailable';
  thermalSensorName: string | null;
  /** BatteryManager reading; separate from the best-guess `temperatureC` above. */
  batteryTemperatureC: number | null;
  androidThermalStatus: AndroidThermalStatus;
  /** Only set when a thermal zone explicitly named for the CPU is readable. */
  cpuTemperatureC: number | null;
  cpuTemperatureSensor: string | null;
  sampledAt: number | null;
}

export type AndroidThermalStatus =
  | 'none'
  | 'light'
  | 'moderate'
  | 'severe'
  | 'critical'
  | 'emergency'
  | 'shutdown'
  | 'unsupported'
  | 'unavailable';

/** Native crash-recovery state: a restart is pending, failed, or given up after repeated crashes. */
export interface CrashRestart {
  pending: boolean;
  exitCode: number | null;
  attempt: number;
  maxAttempts: number;
  /** Epoch ms when the miner restarts by itself unless the user cancels. */
  deadlineAt?: number;
  exhausted?: boolean;
  failed?: boolean;
  message?: string;
}

export type ProtectionState = 'normal' | 'caution' | 'throttled' | 'critical';

export type ProtectionTrigger =
  | 'battery_temperature'
  | 'thermal_status'
  | 'battery_level'
  | 'cpu_temperature'
  | 'sensor_stale'
  | 'sensor_unavailable'
  | 'power_disconnected'
  | 'screen_off'
  | 'none';

export interface ProtectionEvent {
  type:
    | 'intensity_reduced'
    | 'intensity_restored'
    | 'mining_stopped'
    | 'monitoring_unavailable'
    | 'monitoring_restored';
  at: number;
  trigger: ProtectionTrigger;
  sensor: string | null;
  value: number | null;
  unit: string | null;
  threshold: number | null;
  previousState: ProtectionState;
  newState: ProtectionState;
  previousIntensity: number;
  newIntensity: number;
  action: 'reduce' | 'restore' | 'stop' | 'hold';
  recovery: 'pending' | 'recovering' | 'recovered' | 'manual_restart_required';
}

export interface ProtectionSnapshot {
  at: number;
  state: ProtectionState;
  trigger: ProtectionTrigger;
  configuredIntensity: number;
  targetIntensity: number;
  measuredIntensity: number;
  recoveryRemainingMs: number;
  batteryTemperatureC: number | null;
  batteryPercent: number | null;
  charging: boolean;
  androidThermalLevel: number | null;
  androidThermalSupported: boolean;
  cpuTemperatureC: number | null;
  ageMs: Record<
    'batteryTemperature' | 'batteryPercent' | 'androidThermalStatus' | 'cpuTemperature',
    number
  >;
  staleAfterMs: number;
  temperatureLimitC: number;
  batteryFloorPercent: number;
}
