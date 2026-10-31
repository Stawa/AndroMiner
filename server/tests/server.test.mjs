import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/app.mjs';
import { createSqliteStore } from '../src/sqliteStore.mjs';
import { summarizeReleases } from '../src/github.mjs';
import { suppressSmallGroups } from '../src/stats.mjs';

const DAY = 86_400_000;
const hex = (n) => n.toString(16).padStart(32, '0');
const baseCheckin = (n, overrides = {}) => ({
  v: 1,
  installationId: hex(n),
  country: 'ID',
  appVersion: '1.4.0',
  androidMajor: 13,
  variant: 'tls',
  ...overrides
});

const releasesFixture = [
  {
    tag_name: 'v1.4.0',
    published_at: '2026-10-01T00:00:00Z',
    assets: [
      { name: 'androminer-1.4.0-tls-release.apk', download_count: 10 },
      { name: 'androminer-1.4.0-notls-release.apk', download_count: 4 },
      { name: 'androminer-1.4.0-download-release.apk', download_count: 6 },
      { name: 'checksums.txt', download_count: 99 }
    ]
  }
];

const start = async ({ env = {}, fetchImpl, clock = { t: Date.UTC(2026, 9, 31, 12) } } = {}) => {
  const config = loadConfig({ DATABASE_PATH: ':memory:', MIN_GROUP_SIZE: '3', ...env });
  const app = createApp({
    config,
    store: createSqliteStore(':memory:'),
    now: () => clock.t,
    fetchImpl: fetchImpl ?? (async () => new Response('{}', { status: 503 }))
  });
  const server = createServer(app.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, init = {}) =>
    fetch(base + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers }
    });
  const post = (body) => call('/v1/checkin', { method: 'POST', body: JSON.stringify(body) });
  return { app, clock, call, post, stop: () => server.close() };
};

test('accepts a valid check-in and counts it once per interval', async (t) => {
  const s = await start();
  t.after(s.stop);
  const first = await s.post(baseCheckin(1));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true, counted: true });
  s.clock.t += 3_600_000;
  assert.equal((await (await s.post(baseCheckin(1))).json()).counted, false);
  const stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.active.daily, 1);
  assert.equal(stats.history.daily[0].count, 1);
  s.clock.t += DAY;
  assert.equal((await (await s.post(baseCheckin(1))).json()).counted, true);
  const later = await (await s.call('/v1/stats')).json();
  assert.equal(later.active.daily, 1);
  assert.equal(later.history.daily.length, 2);
});

test('rejects invalid requests without storing anything', async (t) => {
  const s = await start();
  t.after(s.stop);
  const bad = [
    baseCheckin(1, { extra: 'wallet' }),
    baseCheckin(1, { installationId: 'ABC' }),
    baseCheckin(1, { country: 'XX' }),
    baseCheckin(1, { country: 'idn' }),
    baseCheckin(1, { appVersion: '1.4.0; DROP TABLE' }),
    baseCheckin(1, { androidMajor: 2 }),
    baseCheckin(1, { androidMajor: 13.5 }),
    baseCheckin(1, { variant: 'web' }),
    { ...baseCheckin(1), v: 2 },
    [],
    'text'
  ];
  for (const body of bad) {
    assert.equal((await s.post(body)).status, 400, JSON.stringify(body));
  }
  const malformed = await s.call('/v1/checkin', { method: 'POST', body: '{nope' });
  assert.equal(malformed.status, 400);
  const wrongType = await s.call('/v1/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}'
  });
  assert.equal(wrongType.status, 415);
  const large = await s.call('/v1/checkin', { method: 'POST', body: 'x'.repeat(5000) });
  assert.equal(large.status, 413);
  assert.equal((await s.call('/nope')).status, 404);
  assert.equal(s.app.store.db.prepare('SELECT COUNT(*) AS n FROM installs').get().n, 0);
});

test('a null country is accepted and reported as not shared', async (t) => {
  const s = await start();
  t.after(s.stop);
  for (let i = 1; i <= 4; i += 1) await s.post(baseCheckin(i, { country: null }));
  const stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.countries.unshared, 4);
  assert.deepEqual(stats.countries.groups, []);
});

test('country statistics are withheld below the minimum group size', async (t) => {
  const s = await start({ env: { MIN_GROUP_SIZE: '5' } });
  t.after(s.stop);
  for (let i = 1; i <= 4; i += 1) await s.post(baseCheckin(i));
  let stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.active.monthly, 4);
  assert.equal(stats.countries.published, false);
  assert.deepEqual(stats.countries.groups, []);
  for (let i = 5; i <= 14; i += 1) {
    const country = i < 10 ? 'ID' : i < 13 ? 'BR' : 'ES';
    await s.post(baseCheckin(i, { country }));
  }
  stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.countries.published, true);
  const id = stats.countries.groups.find((g) => g.key === 'ID');
  assert.equal(id.count, 9);
  assert.equal(
    stats.countries.groups.find((g) => g.key === 'BR'),
    undefined
  );
  assert.equal(stats.countries.other, 5);
});

test('small-group suppression prevents recovery by subtraction', () => {
  const { groups, other } = suppressSmallGroups({ US: 50, ID: 12, BR: 2, ES: 1 }, 5);
  assert.deepEqual(
    groups.map((g) => g.key),
    ['US']
  );
  assert.equal(other, 15);
  const folded = suppressSmallGroups({ US: 50, ID: 6, BR: 2 }, 5);
  assert.deepEqual(
    folded.groups.map((g) => g.key),
    ['US']
  );
  assert.equal(folded.other, 8);
});

test('active windows use 24 hours, 7 days and 30 days', async (t) => {
  const s = await start();
  t.after(s.stop);
  await s.post(baseCheckin(1));
  s.clock.t += 6 * DAY;
  await s.post(baseCheckin(2));
  s.clock.t += 20 * DAY;
  await s.post(baseCheckin(3));
  const { active } = await (await s.call('/v1/stats')).json();
  assert.deepEqual(active, { daily: 1, weekly: 1, monthly: 3 });
});

test('withdrawal deletes the record and is not an existence oracle', async (t) => {
  const s = await start();
  t.after(s.stop);
  await s.post(baseCheckin(1));
  const first = await s.call(`/v1/installations/${hex(1)}`, { method: 'DELETE' });
  const second = await s.call(`/v1/installations/${hex(1)}`, { method: 'DELETE' });
  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(s.app.store.db.prepare('SELECT COUNT(*) AS n FROM installs').get().n, 0);
  assert.equal((await s.call('/v1/installations/not-an-id', { method: 'DELETE' })).status, 400);
});

test('retention removes expired installation rows but keeps aggregates', async (t) => {
  const s = await start({ env: { RETENTION_DAYS: '40' } });
  t.after(s.stop);
  await s.post(baseCheckin(1));
  s.clock.t += 41 * DAY;
  await s.app.prune();
  assert.equal(s.app.store.db.prepare('SELECT COUNT(*) AS n FROM installs').get().n, 0);
  assert.equal(s.app.store.db.prepare('SELECT COUNT(*) AS n FROM daily_active').get().n, 1);
});

test('rate limiting returns 429 with Retry-After', async (t) => {
  const s = await start({ env: { RATE_LIMIT_PER_MINUTE: '3' } });
  t.after(s.stop);
  const statuses = [];
  for (let i = 1; i <= 5; i += 1) statuses.push((await s.post(baseCheckin(i))).status);
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  const limited = await s.post(baseCheckin(9));
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  s.clock.t += 61_000;
  assert.equal((await s.post(baseCheckin(9))).status, 200);
});

test('new-installation flood is capped per hour', async (t) => {
  const s = await start({ env: { MAX_NEW_INSTALLS_PER_HOUR: '2' } });
  t.after(s.stop);
  assert.equal((await s.post(baseCheckin(1))).status, 200);
  assert.equal((await s.post(baseCheckin(2))).status, 200);
  assert.equal((await s.post(baseCheckin(3))).status, 429);
});

test('GitHub downloads are summarized, cached, and survive an outage', async (t) => {
  let calls = 0;
  let healthy = true;
  const fetchImpl = async () => {
    calls += 1;
    return healthy
      ? new Response(JSON.stringify(releasesFixture), { status: 200 })
      : new Response('{}', { status: 500 });
  };
  const s = await start({ fetchImpl, env: { GITHUB_CACHE_SECONDS: '60' } });
  t.after(s.stop);
  let stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.downloads.total, 20);
  assert.deepEqual(stats.downloads.byVariant, { tls: 10, notls: 4, download: 6, other: 0 });
  await s.call('/v1/stats');
  assert.equal(calls, 1);
  healthy = false;
  s.clock.t += 120_000;
  stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.downloads.stale, true);
  assert.equal(stats.downloads.total, 20);
  assert.equal(stats.downloads.history.length, 1);
});

test('statistics remain available when GitHub was never reachable', async (t) => {
  const s = await start();
  t.after(s.stop);
  const stats = await (await s.call('/v1/stats')).json();
  assert.equal(stats.downloads.available, false);
  assert.equal(stats.active.monthly, 0);
});

test('summarizeReleases ignores non-APK assets and drafts', () => {
  const summary = summarizeReleases([
    ...releasesFixture,
    { tag_name: 'v9', draft: true, assets: [] }
  ]);
  assert.equal(summary.total, 20);
  assert.equal(summary.releases.length, 1);
});

test('requests, addresses and identifiers are never logged', async (t) => {
  const lines = [];
  for (const method of ['log', 'info', 'warn', 'error']) {
    t.mock.method(console, method, (...args) => lines.push(args.join(' ')));
  }
  const s = await start();
  t.after(s.stop);
  await s.post(baseCheckin(7));
  await s.post({ junk: true });
  await s.call(`/v1/installations/${hex(7)}`, { method: 'DELETE' });
  await s.call('/v1/stats');
  assert.deepEqual(lines, []);
});
