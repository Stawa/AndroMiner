import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeNativeHistory,
  compatibleAverage,
  exportHistory
} from '../src/utils/sessionHistory.ts';
import { isFresh, readHashrates } from '../src/utils/miningTelemetry.ts';
import { validateMiningSetup } from '../src/utils/configValidation.ts';

const run = (id = 'one') => ({
  id,
  startedAt: 1000,
  endedAt: 2000,
  coinSymbol: 'XMR',
  algorithm: 'rx/0',
  requestedThreads: 2,
  durationSeconds: 1,
  acceptedShares: 0,
  rejectedShares: 0,
  averageHashrate: null,
  sampleCount: 0,
  sampleWindowSeconds: 10,
  hashingSeconds: 0,
  endReason: 'Session duration limit reached.',
  reasonCode: 'timer'
});

test('native reconciliation is idempotent and excludes unfinished sessions', () => {
  const rows = [run(), { ...run('active'), endedAt: null }];
  const first = mergeNativeHistory([], rows);
  assert.equal(first.length, 1);
  assert.deepEqual(mergeNativeHistory(first, rows), first);
  assert.equal(first[0].averageHashrate, null);
  assert.equal(first[0].reasonCode, 'timer');
});

test('deleting native records cannot resurrect a cached copy; legacy history survives', () => {
  const native = mergeNativeHistory([], [run()]);
  const legacy = { ...native[0], id: 'legacy', native: undefined };
  assert.deepEqual(mergeNativeHistory([...native, legacy], []), [legacy]);
});

test('history is bounded and malformed timestamps do not erase valid runs', () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({ ...run(String(i)), startedAt: 1000 + i }));
  rows.push({ ...run('bad'), endedAt: NaN });
  const result = mergeNativeHistory([], rows);
  assert.equal(result.length, 100);
  assert.equal(result[0].id, '119');
});

test('missing speed is not an older average or a measured zero', () => {
  assert.deepEqual(readHashrates({ total: [null, 12, 40] }), {
    current: null,
    average: 12,
    peak: null
  });
  assert.equal(readHashrates({ total: [0] }).current, 0);
  assert.equal(isFresh(2000, 1000), false);
  assert.equal(isFresh(1, 20000), false);
});

test('session duration validates bounds, fractions, and old saved setups', () => {
  const config = { walletAddress: 'pool-user', poolUrl: 'pool.example', poolPort: 3333 };
  for (const maxDurationMinutes of [undefined, 0, 1, 1440])
    assert.equal(validateMiningSetup({ ...config, maxDurationMinutes }).duration, '');
  for (const maxDurationMinutes of [-1, 1441, 0.5, NaN])
    assert.ok(validateMiningSetup({ ...config, maxDurationMinutes }).duration);
});

test('comparison weights compatible samples, not connection time or other algorithms', () => {
  const rows = mergeNativeHistory(
    [],
    [
      { ...run('one'), sampleCount: 1, averageHashrate: 10, durationSeconds: 1000 },
      { ...run('two'), sampleCount: 3, averageHashrate: 30, durationSeconds: 20 },
      { ...run('different'), algorithm: 'rx/wow', sampleCount: 100, averageHashrate: 999 },
      { ...run('window'), sampleWindowSeconds: 60, sampleCount: 100, averageHashrate: 999 }
    ]
  );
  assert.deepEqual(compatibleAverage(rows, 'rx/0'), { runs: 2, samples: 4, average: 25 });
  assert.equal(compatibleAverage([], 'rx/0').average, null);
});

test('export uses an allowlist and excludes pool identifiers unless opted in', () => {
  const rows = mergeNativeHistory(
    [],
    [
      {
        ...run(),
        pool: 'private.example:3333',
        walletAddress: 'secret-wallet',
        logs: ['secret-password']
      }
    ]
  );
  const safe = JSON.stringify(exportHistory(rows));
  assert.ok(!safe.includes('secret'));
  assert.ok(!safe.includes('private.example'));
  assert.equal(exportHistory(rows, true).sessions[0].pool, 'private.example:3333');
  assert.equal(exportHistory(rows).sessions[0].averageHashrate, null);
});
