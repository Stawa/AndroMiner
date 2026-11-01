import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEMETRY_STORAGE_KEY,
  buildPayload,
  createTelemetryClient,
  defaultState,
  derivePublicId,
  generateInstallationId,
  isAcceptableEndpoint,
  normalizeState
} from '../src/utils/telemetryClient.ts';

const HOUR = 3_600_000;

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  };
};

const setup = ({ environment, fetchImpl, storage = memoryStorage(), endpoint } = {}) => {
  const calls = [];
  const clock = { t: 1_000_000_000_000 };
  const client = createTelemetryClient({
    endpoint: endpoint ?? 'https://stats.example.org',
    storage,
    now: () => clock.t,
    randomBytes: (length) => Uint8Array.from({ length }, (_, i) => i + 1),
    getEnvironment: async () =>
      environment === undefined
        ? { appVersion: '1.4.0', androidMajor: 13, variant: 'tls' }
        : environment,
    fetchImpl:
      fetchImpl ??
      (async (url, init) => {
        calls.push({ url, init });
        return new Response(init.method === 'DELETE' ? null : '{"ok":true}', {
          status: init.method === 'DELETE' ? 204 : 200
        });
      })
  });
  client.load();
  return { client, calls, clock, storage };
};

test('a fresh install is opted in with a random local ID, and an opt-out is kept', async () => {
  const { client, storage } = setup();
  assert.equal(client.getState().enabled, true);
  assert.match(client.getState().installationId, /^[0-9a-f]{32}$/);
  client.setEnabled(false);
  const reloaded = setup({ storage });
  assert.equal(reloaded.client.getState().enabled, false);
  assert.equal(await reloaded.client.checkinIfDue(), 'disabled');
  assert.equal(reloaded.calls.length, 0);
});

test('deleting my data is not undone by the opt-in default', async () => {
  const { client, storage } = setup();
  await client.withdraw();
  const reloaded = setup({ storage });
  assert.equal(reloaded.client.getState().enabled, false);
  assert.equal(reloaded.client.getState().installationId, '');
  assert.equal(await reloaded.client.checkinIfDue(), 'disabled');
  assert.equal(reloaded.calls.length, 0);
});

test('a build without an endpoint creates no ID and saves nothing', () => {
  const { client, storage } = setup({ endpoint: '' });
  assert.equal(client.getState().installationId, '');
  assert.equal(storage.data.size, 0);
});

test('a build without an endpoint is unavailable and never sends', async () => {
  const { client, calls } = setup({ endpoint: '' });
  client.setEnabled(true);
  assert.equal(await client.checkinIfDue(), 'unavailable');
  assert.equal(calls.length, 0);
});

test('only https endpoints (or localhost) are accepted', () => {
  assert.equal(isAcceptableEndpoint('https://stats.example.org'), true);
  assert.equal(isAcceptableEndpoint('http://localhost:8787'), true);
  assert.equal(isAcceptableEndpoint('http://stats.example.org'), false);
  assert.equal(isAcceptableEndpoint('not a url'), false);
});

test('a check-in sends exactly the documented fields', async () => {
  const { client, calls } = setup();
  client.setCountry('ID');
  assert.match(client.getState().installationId, /^[0-9a-f]{32}$/);
  assert.equal(await client.checkinIfDue(), 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://stats.example.org/v1/checkin');
  assert.equal(calls[0].init.credentials, 'omit');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), [
    'acceptedShares',
    'androidMajor',
    'appVersion',
    'country',
    'installationId',
    'miningSeconds',
    'v',
    'variant'
  ]);
  assert.equal(body.variant, 'tls');
  assert.equal(body.androidMajor, 13);
  assert.ok(client.getState().lastCheckinAt);
});

test('random installation IDs are not derived from the environment', () => {
  assert.notEqual(generateInstallationId(), generateInstallationId());
  assert.match(generateInstallationId(), /^[0-9a-f]{32}$/);
});

test('duplicate check-ins are prevented within the interval', async () => {
  const { client, calls, clock } = setup();
  client.setEnabled(true);
  assert.equal(await client.checkinIfDue(), 'sent');
  clock.t += 23 * HOUR;
  assert.equal(await client.checkinIfDue(), 'not-due');
  clock.t += 2 * HOUR;
  assert.equal(await client.checkinIfDue(), 'sent');
  assert.equal(calls.length, 2);
});

test('a backend outage never throws and retries no sooner than an hour', async () => {
  let attempts = 0;
  const { client, clock } = setup({
    fetchImpl: async () => {
      attempts += 1;
      throw new TypeError('Failed to fetch');
    }
  });
  client.setEnabled(true);
  assert.equal(await client.checkinIfDue(), 'failed');
  assert.equal(await client.checkinIfDue(), 'backoff');
  clock.t += 2 * HOUR;
  assert.equal(await client.checkinIfDue(), 'failed');
  assert.equal(attempts, 2);
  assert.equal(client.getState().lastCheckinAt, null);
});

test('HTTP errors such as 400 and 429 are not recorded as successful check-ins', async () => {
  for (const status of [400, 429, 500]) {
    const { client } = setup({ fetchImpl: async () => new Response('{}', { status }) });
    client.setEnabled(true);
    assert.equal(await client.checkinIfDue(), 'failed');
    assert.equal(client.getState().lastCheckinAt, null);
  }
});

test('the web build (no environment) reports nothing', async () => {
  const { client, calls } = setup({ environment: null });
  client.setEnabled(true);
  assert.equal(await client.checkinIfDue(), 'unsupported');
  assert.equal(calls.length, 0);
});

test('disabling while a request is in flight does not record a check-in', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { client } = setup({
    fetchImpl: async () => {
      await gate;
      return new Response('{}', { status: 200 });
    }
  });
  client.setEnabled(true);
  const pending = client.checkinIfDue();
  await Promise.resolve();
  await Promise.resolve();
  client.setEnabled(false);
  release();
  await pending;
  assert.equal(client.getState().lastCheckinAt, null);
});

test('disabling stops all future reporting immediately', async () => {
  const { client, calls, clock } = setup();
  client.setEnabled(true);
  await client.checkinIfDue();
  client.setEnabled(false);
  clock.t += 48 * HOUR;
  assert.equal(await client.checkinIfDue(), 'disabled');
  assert.equal(calls.length, 1);
});

test('resetting issues a new ID and deletes the old record on the service', async () => {
  const { client, calls } = setup();
  client.setEnabled(true);
  const oldId = client.getState().installationId;
  client.setCountry('ID');
  await client.checkinIfDue();
  await client.resetInstallationId();
  assert.equal(client.getState().installationId, oldId, 'deterministic test RNG');
  const deletes = calls.filter((c) => c.init.method === 'DELETE');
  assert.equal(deletes.length, 1);
  assert.equal(deletes[0].url, `https://stats.example.org/v1/installations/${oldId}`);
  assert.equal(client.getState().lastCheckinAt, null);
  assert.deepEqual(client.getState().pendingDeletion, []);
});

test('withdrawal forgets identity locally and queues deletion until it succeeds', async () => {
  let online = false;
  const calls = [];
  const { client } = setup({
    fetchImpl: async (url, init) => {
      calls.push(init.method);
      if (!online) throw new TypeError('offline');
      return new Response(null, { status: 204 });
    }
  });
  client.setEnabled(true);
  client.setCountry('BR');
  const id = client.getState().installationId;
  await client.withdraw();
  assert.equal(client.getState().enabled, false);
  assert.equal(client.getState().installationId, '');
  assert.equal(client.getState().country, null);
  assert.deepEqual(client.getState().pendingDeletion, [id]);
  online = true;
  await client.flushDeletions();
  assert.deepEqual(client.getState().pendingDeletion, []);
  assert.deepEqual(calls, ['DELETE', 'DELETE']);
});

test('state persists and survives corrupt or hostile storage', () => {
  const storage = memoryStorage({ [TELEMETRY_STORAGE_KEY]: '{not json' });
  // An unreadable record is an unknown choice, so it never turns reporting on.
  assert.deepEqual(setup({ storage }).client.getState(), { ...defaultState(), enabled: false });
  assert.deepEqual(
    normalizeState({
      enabled: 'yes',
      installationId: 'ZZZ',
      country: 'idn',
      pendingDeletion: ['x', 5]
    }),
    defaultState()
  );
  const throwing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    }
  };
  const { client } = setup({ storage: throwing });
  assert.doesNotThrow(() => client.setEnabled(true));
});

test('payload contains no mining, wallet, or device data even if state carries extras', () => {
  const polluted = {
    ...defaultState(),
    enabled: true,
    installationId: 'a'.repeat(32),
    wallet: '4ABC',
    pool: 'pool.example.org',
    hashrate: 123
  };
  const payload = buildPayload(polluted, {
    appVersion: '1.4.0',
    androidMajor: 14,
    variant: 'notls'
  });
  assert.equal(JSON.stringify(payload).includes('4ABC'), false);
  assert.equal(JSON.stringify(payload).includes('pool'), false);
  assert.equal(Object.keys(payload).length, 8);
});

test('no console output contains the installation ID or endpoint payload', async (t) => {
  const lines = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    t.mock.method(console, method, (...args) => lines.push(args.join(' ')));
  }
  const { client } = setup({
    fetchImpl: async () => {
      throw new TypeError('offline');
    }
  });
  client.setEnabled(true);
  await client.checkinIfDue();
  await client.withdraw();
  assert.deepEqual(lines, []);
});

test('all three APK variants are reported verbatim', async () => {
  for (const variant of ['download', 'tls', 'notls']) {
    const { client, calls } = setup({
      environment: { appVersion: '1.4.0', androidMajor: 12, variant }
    });
    client.setEnabled(true);
    await client.checkinIfDue();
    assert.equal(JSON.parse(calls[0].init.body).variant, variant);
  }
});

test('fields the user switched off are sent as null and the rest are unchanged', async () => {
  const { client, calls } = setup();
  client.setEnabled(true);
  client.setCountry('ID');
  client.setShare('androidVersion', false);
  client.setShare('country', false);
  assert.equal(await client.checkinIfDue(), 'sent');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.androidMajor, null);
  assert.equal(body.country, null);
  assert.equal(body.appVersion, '1.4.0');
  assert.equal(body.variant, 'tls');
  assert.equal(Object.keys(body).length, 8);
});

test('sharing choices persist, and saved state from before they existed shares everything', () => {
  const { client, storage } = setup();
  client.setEnabled(true);
  client.setShare('variant', false);
  const saved = JSON.parse(storage.data.get(TELEMETRY_STORAGE_KEY));
  assert.equal(saved.share.variant, false);
  assert.equal(saved.share.appVersion, true);
  const legacy = normalizeState({ enabled: true, installationId: 'a'.repeat(32) });
  assert.deepEqual(legacy.share, {
    country: true,
    androidVersion: true,
    appVersion: true,
    variant: true,
    activity: true
  });
});

test('finished sessions are counted once, in order, and reported as totals', async () => {
  const { client, calls } = setup();
  const sessions = [
    { endedAt: '2026-10-02T10:00:00Z', durationSeconds: 600, acceptedShares: 5 },
    { endedAt: '2026-10-01T10:00:00Z', durationSeconds: 3600.9, acceptedShares: 20 }
  ];
  client.recordSessions(sessions);
  client.recordSessions(sessions);
  client.recordSessions([
    { endedAt: 'not a date', durationSeconds: 99, acceptedShares: 99 },
    { endedAt: '2026-10-03T10:00:00Z', durationSeconds: -5, acceptedShares: Number.NaN }
  ]);
  assert.equal(client.getState().miningSeconds, 4200);
  assert.equal(client.getState().acceptedShares, 25);
  assert.equal(await client.checkinIfDue(), 'sent');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.miningSeconds, 4200);
  assert.equal(body.acceptedShares, 25);
});

test('switching mining activity off keeps it local and out of the check-in', async () => {
  const { client, calls } = setup();
  client.recordSessions([
    { endedAt: '2026-10-01T10:00:00Z', durationSeconds: 60, acceptedShares: 1 }
  ]);
  client.setShare('activity', false);
  await client.checkinIfDue();
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.miningSeconds, null);
  assert.equal(body.acceptedShares, null);
});

test('the public ID is a stable one-way code that matches the server', async () => {
  const id = '0123456789abcdef0123456789abcdef';
  assert.equal(await derivePublicId(id), 'H5DC-568W');
  assert.equal(await derivePublicId(id), await derivePublicId(id));
  assert.match(
    await derivePublicId(generateInstallationId()),
    /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
  );
});

test('the leaderboard is read from the service and fails soft', async () => {
  const entries = [
    { rank: 1, id: 'H5DC-568W', country: 'ID', miningSeconds: 60, acceptedShares: 1 }
  ];
  const ok = setup({
    fetchImpl: async (url) => {
      assert.equal(url, 'https://stats.example.org/v1/leaderboard');
      return new Response(JSON.stringify({ entries }), { status: 200 });
    }
  });
  assert.deepEqual(await ok.client.fetchLeaderboard(), entries);
  const down = setup({ fetchImpl: async () => new Response('{}', { status: 503 }) });
  assert.equal(await down.client.fetchLeaderboard(), null);
  const bad = setup({ fetchImpl: async () => new Response('{"entries":5}', { status: 200 }) });
  assert.equal(await bad.client.fetchLeaderboard(), null);
});
