import type { MiningEngineId } from '../types/mining';
import type { NativeEngineInfo } from './engines';

/** Engines this APK can fetch right now: downloadable, pinned and not already installed. */
export const downloadableEngines = (
  engines: readonly NativeEngineInfo[]
): readonly NativeEngineInfo[] =>
  engines.filter(
    (engine) =>
      engine.status !== 'unsupported' &&
      engine.downloadApproved &&
      engine.abiSupported &&
      !engine.installed
  );

/**
 * What a missing engine needs before a session can start:
 * - `none`: the selected engine is installed.
 * - `download`: it is missing and can be downloaded.
 * - `unavailable`: it is missing and this APK has no approved download for it.
 */
export const missingEngineAction = (
  selected: MiningEngineId,
  engines: readonly NativeEngineInfo[]
): 'none' | 'download' | 'unavailable' => {
  const info = engines.find((engine) => engine.id === selected);
  if (!info || info.installed) return 'none';
  return info.downloadApproved && info.abiSupported && info.status !== 'unsupported'
    ? 'download'
    : 'unavailable';
};

/** Download order: the engine the user needs first, so a failure on another cannot block it. */
export const downloadOrder = (
  scope: 'selected' | 'all',
  selected: MiningEngineId,
  engines: readonly NativeEngineInfo[]
): string[] => {
  const missing = downloadableEngines(engines).map((engine) => engine.id);
  if (scope === 'selected') return missing.includes(selected) ? [selected] : [];
  return [...missing].sort((a, b) => Number(b === selected) - Number(a === selected));
};
