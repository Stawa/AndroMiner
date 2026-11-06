import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBenchmarkPayload, submitBenchmark } from '../src/utils/benchmarkClient.ts';

const result = {
  hashrate: 812.449,
  samples: 15,
  seconds: 30,
  engine: 'xmrig',
  engineName: 'XMRig',
  engineVersion: '6.26.0',
  abi: 'arm64-v8a',
  cpuThreads: 8,
  lightMode: false,
  device: 'Google Pixel 8',
  soc: '',
  completedAt: 1_000,
  wallet: 'must never be forwarded'
};

test('the shared payload has exactly the documented fields and no identifier', () => {
  const payload = buildBenchmarkPayload(result, '1.4.0');
  assert.deepEqual(Object.keys(payload).sort(), [
    'abi',
    'appVersion',
    'cpuThreads',
    'device',
    'engine',
    'engineVersion',
    'hashrate',
    'soc',
    'v'
  ]);
  assert.equal(payload.hashrate, 812.4);
  assert.equal(payload.soc, null);
  assert.equal(buildBenchmarkPayload(result, 'dev build').appVersion, null);
});

test('submits to the benchmark route without credentials or referrer', async () => {
  const calls = [];
  const outcome = await submitBenchmark({
    endpoint: 'https://stats.example.org/',
    payload: buildBenchmarkPayload(result, '1.4.0'),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('{"ok":true}', { status: 200 });
    }
  });
  assert.equal(outcome, 'sent');
  assert.equal(calls[0].url, 'https://stats.example.org/v1/benchmark');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.referrerPolicy, 'no-referrer');
});

test('reports unavailable, rejected and failed outcomes without throwing', async () => {
  const payload = buildBenchmarkPayload(result, '1.4.0');
  const reply = (status) => async () => new Response('{}', { status });
  assert.equal(
    await submitBenchmark({ endpoint: '', payload, fetchImpl: reply(200) }),
    'unavailable'
  );
  assert.equal(
    await submitBenchmark({ endpoint: 'http://example.org', payload, fetchImpl: reply(200) }),
    'unavailable'
  );
  assert.equal(
    await submitBenchmark({ endpoint: 'https://a.example', payload, fetchImpl: reply(400) }),
    'rejected'
  );
  assert.equal(
    await submitBenchmark({ endpoint: 'https://a.example', payload, fetchImpl: reply(429) }),
    'failed'
  );
  assert.equal(
    await submitBenchmark({
      endpoint: 'https://a.example',
      payload,
      fetchImpl: async () => {
        throw new Error('offline');
      }
    }),
    'failed'
  );
});
