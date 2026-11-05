import type { Cryptocurrency, MiningEngineId } from '../types/mining';

export const defaultEngine: MiningEngineId = 'xmrig';
const launchableEngines: readonly MiningEngineId[] = ['xmrig', 'xmrigcc', 'xlarig'];

/** What the native layer reports about one engine on this device. */
export interface NativeEngineInfo {
  id: string;
  name: string;
  status: 'supported' | 'experimental' | 'unsupported';
  version: string;
  installedVersion: string | null;
  license: string;
  upstream: string;
  note: string;
  algorithms: readonly string[];
  protocols: readonly string[];
  abis: readonly string[];
  abiSupported: boolean;
  installed: boolean;
  downloadable: boolean;
  /** This APK pins a reviewed build, so the engine can be downloaded and hash-checked. */
  downloadApproved: boolean;
  source: string;
  intensityControl: { method: string; verifiedOnDevice: boolean };
}

/** Unknown or missing ids (older saved setups, hand-edited imports) fall back to XMRig. */
export const normalizeEngine = (value: unknown): MiningEngineId =>
  launchableEngines.includes(value as MiningEngineId) ? (value as MiningEngineId) : defaultEngine;

/**
 * Whether an engine can mine a coin. With native info this is the engine's own algorithm list;
 * without it (web preview, info not loaded yet) only the catalog's explicit engine requirement is
 * known, so XLArig is limited to coins that name it and the XMRig family to the rest.
 */
export const coinFitsEngine = (
  coin: Pick<Cryptocurrency, 'xmrigAlgo' | 'requiredEngine'> | undefined,
  engine: MiningEngineId,
  engines?: readonly NativeEngineInfo[]
): boolean => {
  if (!coin) return true;
  const info = engines?.find((item) => item.id === engine);
  if (info) return info.algorithms.includes(coin.xmrigAlgo);
  return coin.requiredEngine ? coin.requiredEngine === engine : engine !== 'xlarig';
};

/** An engine can be started only if it is launchable, built for this CPU and present in the APK. */
export const engineSelectable = (info: NativeEngineInfo | undefined): boolean =>
  info !== undefined && info.status !== 'unsupported' && info.abiSupported && info.installed;

/**
 * The engine a coin selects on its own: the first one that can mine it (XMRig before XMRigCC before
 * XLArig), preferring one that can actually start on this device. Never empty, so a coin that no
 * engine reports still gets XMRig and fails start validation with a clear message.
 */
export const engineForCoin = (
  coin: Pick<Cryptocurrency, 'xmrigAlgo' | 'requiredEngine'> | undefined,
  engines?: readonly NativeEngineInfo[]
): MiningEngineId => {
  const fitting = launchableEngines.filter((engine) => coinFitsEngine(coin, engine, engines));
  const startable = fitting.filter((engine) =>
    engineSelectable(engines?.find((item) => item.id === engine))
  );
  return startable[0] ?? fitting[0] ?? defaultEngine;
};
