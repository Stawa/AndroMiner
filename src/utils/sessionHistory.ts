import type { MiningSessionHistoryItem } from '../types/mining';

export interface NativeSessionRecord {
  id: string;
  state?: string;
  startedAt: number;
  endedAt: number | null;
  coinSymbol: string;
  algorithm: string;
  requestedThreads: number;
  durationSeconds: number;
  acceptedShares: number;
  rejectedShares: number;
  averageHashrate: number | null;
  sampleCount: number;
  sampleWindowSeconds: number;
  hashingSeconds: number;
  endReason?: string;
  reasonCode?: string;
}

export function mergeNativeHistory(
  existing: MiningSessionHistoryItem[],
  records: NativeSessionRecord[]
): MiningSessionHistoryItem[] {
  const history = new Map(existing.filter((row) => !row.native).map((row) => [row.id, row]));
  for (const row of records) {
    if (
      !row.id ||
      row.endedAt === null ||
      !Number.isFinite(row.startedAt) ||
      !Number.isFinite(row.endedAt)
    )
      continue;
    history.set(row.id, {
      ...row,
      native: true,
      title: `${row.coinSymbol} mining`,
      subtitle: `${row.algorithm} · ${row.requestedThreads} requested threads`,
      coinLogoText: row.coinSymbol,
      coinLogoClass: '',
      startedAt: new Date(row.startedAt).toISOString(),
      endedAt: new Date(row.endedAt).toISOString()
    });
  }
  return [...history.values()]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 100);
}

export function compatibleAverage(rows: MiningSessionHistoryItem[], algorithm: string) {
  const compatible = rows.filter(
    (row) =>
      row.algorithm === algorithm &&
      row.sampleWindowSeconds === 10 &&
      (row.sampleCount ?? 0) > 0 &&
      row.averageHashrate !== null &&
      Number.isFinite(row.averageHashrate)
  );
  const count = compatible.reduce((sum, row) => sum + row.sampleCount!, 0);
  return {
    runs: compatible.length,
    samples: count,
    average: count
      ? compatible.reduce((sum, row) => sum + row.averageHashrate! * row.sampleCount!, 0) / count
      : null
  };
}

export function exportHistory(rows: MiningSessionHistoryItem[], includePool = false) {
  return {
    schemaVersion: 1,
    kind: 'androminer-session-results',
    poolIdentifiersIncluded: includePool,
    sessions: rows.map((row) => ({
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      coin: row.coinSymbol,
      algorithm: row.algorithm ?? null,
      pool: includePool ? (row.pool ?? null) : null,
      reasonCode: row.reasonCode ?? null,
      durationSeconds: row.durationSeconds,
      hashingSeconds: row.hashingSeconds ?? null,
      requestedThreads: row.requestedThreads ?? null,
      effectiveThreads: row.effectiveThreads ?? null,
      minerVersion: row.minerVersion ?? null,
      acceptedShares: row.acceptedShares,
      rejectedShares: row.rejectedShares,
      averageHashrate: row.averageHashrate,
      sampleCount: row.sampleCount ?? null,
      sampleWindowSeconds: row.sampleWindowSeconds ?? null
    }))
  };
}
