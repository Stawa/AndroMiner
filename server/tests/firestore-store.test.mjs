import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { FieldValue } from '@google-cloud/firestore';
import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/app.mjs';
import { createFirestoreStore } from '../src/firestoreStore.mjs';

const DAY = 86_400_000;
const hex = (n) => n.toString(16).padStart(32, '0');
const checkin = (n, overrides = {}) => ({
  v: 1,
  installationId: hex(n),
  country: 'ID',
  appVersion: '1.4.0',
  androidMajor: 13,
  variant: 'tls',
  ...overrides
});

/**
 * In-memory stand-in for the parts of the Firestore client the store uses, so the store's logic
 * runs in CI without credentials or an emulator. Real-service behaviour is checked after deploy.
 */
const createFakeFirestore = () => {
  const collections = new Map();
  const bucket = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const write = (name, id, value, merge) => {
    const next = merge ? { ...bucket(name).get(id) } : {};
    for (const [key, field] of Object.entries(value)) {
      next[key] = field instanceof FieldValue ? (next[key] ?? 0) + 1 : field;
    }
    bucket(name).set(id, next);
  };
  const snapshot = (name, id) => {
    const value = bucket(name).get(id);
    return {
      id,
      exists: value !== undefined,
      ref: { name, id },
      data: () => ({ ...value }),
      get: (field) => value?.[field]
    };
  };
  const compare = { '>=': (a, b) => a >= b, '<': (a, b) => a < b };
  const query = (name, filters = [], order = null, max = Infinity) => {
    const matching = () => {
      const ids = [...bucket(name).keys()].filter((id) =>
        filters.every(({ field, op, value }) => compare[op](bucket(name).get(id)[field], value))
      );
      if (order) {
        ids.sort((a, b) => (bucket(name).get(a)[order] < bucket(name).get(b)[order] ? -1 : 1));
      }
      return ids.slice(0, max);
    };
    return {
      where: (field, op, value) => query(name, [...filters, { field, op, value }], order, max),
      orderBy: (field) => query(name, filters, field, max),
      select: () => query(name, filters, order, max),
      limit: (n) => query(name, filters, order, n),
      get: async () => {
        const docs = matching().map((id) => snapshot(name, id));
        return { docs, empty: docs.length === 0 };
      },
      count: () => ({ get: async () => ({ data: () => ({ count: matching().length }) }) })
    };
  };
  return {
    collection: (name) => ({
      ...query(name),
      doc: (id) => ({
        name,
        id,
        get: async () => snapshot(name, id),
        set: async (value, options) => write(name, id, value, options?.merge),
        delete: async () => bucket(name).delete(id)
      })
    }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => snapshot(ref.name, ref.id),
        set: (ref, value, options) => write(ref.name, ref.id, value, options?.merge)
      }),
    batch: () => {
      const pending = [];
      return {
        delete: (ref) => pending.push(ref),
        commit: async () => pending.forEach((ref) => bucket(ref.name).delete(ref.id))
      };
    },
    size: (name) => bucket(name).size
  };
};

const start = async ({ env = {}, clock = { t: Date.UTC(2026, 9, 31, 12) } } = {}) => {
  const config = loadConfig({
    MIN_GROUP_SIZE: '3',
    STATS_CACHE_SECONDS: '0',
    GITHUB_REPO: '',
    ...env
  });
  const firestore = createFakeFirestore();
  const app = createApp({
    config,
    store: createFirestoreStore({ firestore, statsCacheSeconds: config.statsCacheSeconds }),
    now: () => clock.t
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
  return { app, clock, firestore, call, post, stop: () => server.close() };
};

test('counts a check-in once per interval and publishes the aggregates', async (t) => {
  const s = await start();
  t.after(s.stop);
  assert.deepEqual(await (await s.post(checkin(1))).json(), { ok: true, counted: true });
  assert.deepEqual(await (await s.post(checkin(1))).json(), { ok: true, counted: false });
  for (const n of [2, 3]) await s.post(checkin(n));
  const stats = await (await s.call('/v1/stats')).json();
  assert.deepEqual(stats.active, { daily: 3, weekly: 3, monthly: 3 });
  assert.equal(stats.countries.published, true);
  assert.deepEqual(stats.countries.groups, [{ key: 'ID', count: 3, share: 1 }]);
  assert.deepEqual(stats.history.daily, [{ day: '2026-10-31', count: 3 }]);
  assert.deepEqual(stats.history.monthly, [{ month: '2026-10', count: 3 }]);
  assert.equal(stats.history.appVersionsByDay[0].groups[0].key, '1.4.0');
});

test('a returning installation is counted again the next day without becoming a new one', async (t) => {
  const s = await start();
  t.after(s.stop);
  await s.post(checkin(1));
  s.clock.t += DAY;
  assert.equal((await (await s.post(checkin(1))).json()).counted, true);
  assert.equal(s.firestore.size('installs'), 1);
  assert.equal(s.firestore.size('daily_active'), 2);
  assert.equal(s.firestore.size('monthly_active'), 2); // Oct 31 -> Nov 1 crosses a month
});

test('withdrawal deletes the record and is not an existence oracle', async (t) => {
  const s = await start();
  t.after(s.stop);
  await s.post(checkin(1));
  const first = await s.call(`/v1/installations/${hex(1)}`, { method: 'DELETE' });
  const second = await s.call(`/v1/installations/${hex(1)}`, { method: 'DELETE' });
  assert.deepEqual([first.status, second.status], [204, 204]);
  assert.equal(s.firestore.size('installs'), 0);
});

test('new-installation flood is capped per hour', async (t) => {
  const s = await start({ env: { MAX_NEW_INSTALLS_PER_HOUR: '2' } });
  t.after(s.stop);
  const statuses = [];
  for (let n = 1; n <= 3; n += 1) statuses.push((await s.post(checkin(n))).status);
  assert.deepEqual(statuses, [200, 200, 429]);
  assert.equal((await s.post(checkin(1))).status, 200);
});

test('figures are reused from the cache until it expires', async (t) => {
  const s = await start({ env: { STATS_CACHE_SECONDS: '3600' } });
  t.after(s.stop);
  await s.post(checkin(1));
  assert.equal((await (await s.call('/v1/stats')).json()).active.monthly, 1);
  await s.post(checkin(2));
  assert.equal((await (await s.call('/v1/stats')).json()).active.monthly, 1);
  s.clock.t += 3601_000;
  assert.equal((await (await s.call('/v1/stats')).json()).active.monthly, 2);
});

test('maintenance prune is closed without a secret and requires it when set', async (t) => {
  const open = await start();
  t.after(open.stop);
  assert.equal((await open.call('/v1/maintenance/prune')).status, 404);

  const s = await start({ env: { CRON_SECRET: 'sekret', RETENTION_DAYS: '40' } });
  t.after(s.stop);
  await s.post(checkin(1));
  assert.equal((await s.call('/v1/maintenance/prune')).status, 401);
  assert.equal(
    (await s.call('/v1/maintenance/prune', { headers: { Authorization: 'Bearer wrong' } })).status,
    401
  );
  s.clock.t += 41 * DAY;
  const pruned = await s.call('/v1/maintenance/prune', {
    headers: { Authorization: 'Bearer sekret' }
  });
  assert.equal(pruned.status, 200);
  assert.equal(s.firestore.size('installs'), 0);
  assert.equal(s.firestore.size('daily_active'), 1);
});
