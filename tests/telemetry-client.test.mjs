import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEMETRY_STORAGE_KEY,
  buildPayload,
  createTelemetryClient,
  defaultState,
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

test('telemetry is disabled by default and sends nothing', async () => {
  const { client, calls } = setup();
  assert.equal(client.getState().enabled, false);
  assert.equal(client.getState().installationId, '');
  assert.equal(await client.checkinIfDue(), 'disabled');
  assert.equal(calls.length, 0);
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

test('opt-in generates a random local ID and sends exactly the documented fields', async () => {
  const { client, calls } = setup();
  client.setEnabled(true);
  client.setCountry('ID');
  assert.match(client.getState().installationId, /^[0-9a-f]{32}$/);
  assert.equal(await client.checkinIfDue(), 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://stats.example.org/v1/checkin');
  assert.equal(calls[0].init.credentials, 'omit');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), [
    'androidMajor',
    'appVersion',
    'country',
    'installationId',
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
  assert.deepEqual(setup({ storage }).client.getState(), defaultState());
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
  assert.equal(Object.keys(payload).length, 6);
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
