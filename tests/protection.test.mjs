import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { explainEvent, freshness, thermalHeadroomC, stateTone } from '../src/utils/protection.ts';
import { exportHistory, mergeNativeHistory } from '../src/utils/sessionHistory.ts';

const event = (overrides = {}) => ({
  type: 'intensity_reduced',
  at: 1_700_000_000_000,
  trigger: 'battery_temperature',
  sensor: 'batteryTemperature',
  value: 38.5,
  unit: '°C',
  threshold: 38,
  previousState: 'normal',
  newState: 'caution',
  previousIntensity: 100,
  newIntensity: 75,
  action: 'reduce',
  recovery: 'pending',
  ...overrides
});

const messages = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], messages);

test('every explanation resolves to an English message', () => {
  const cases = [
    event(),
    event({ trigger: 'thermal_status', unit: 'level', value: 1, threshold: 1 }),
    event({ trigger: 'battery_level', value: 30, unit: '%', threshold: 33 }),
    event({ trigger: 'cpu_temperature', value: 80, threshold: 75 }),
    event({ type: 'intensity_restored', newState: 'caution', action: 'restore' }),
    event({ type: 'intensity_restored', newState: 'normal', action: 'restore' }),
    event({ type: 'monitoring_unavailable', trigger: 'sensor_unavailable', value: null }),
    event({ type: 'monitoring_restored', trigger: 'sensor_unavailable', value: null }),
    ...[
      'battery_temperature',
      'thermal_status',
      'battery_level',
      'cpu_temperature',
      'power_disconnected',
      'screen_off',
      'sensor_unavailable'
    ].map((trigger) => event({ type: 'mining_stopped', trigger, action: 'stop' }))
  ];
  for (const item of cases) {
    const { key, readingKey } = explainEvent(item);
    assert.equal(typeof lookup(key), 'string', `missing message ${key}`);
    if (readingKey) assert.equal(typeof lookup(readingKey), 'string', readingKey);
  }
});

test('explanations carry the real reading, threshold and intensities', () => {
  const { key, params } = explainEvent(event());
  assert.equal(key, 'protection.event.reduced.battery_temperature');
  assert.deepEqual(params, { from: 100, to: 75, value: '38.5 °C', threshold: '38 °C' });
});

test('a lost sensor is named by the sensor that stopped, not generically', () => {
  const lost = explainEvent(
    event({ type: 'monitoring_unavailable', trigger: 'sensor_stale', sensor: 'batteryPercent' })
  );
  assert.equal(lost.readingKey, 'protection.battery');
});

test('a stop caused by an unknown trigger falls back to the sensor message', () => {
  assert.equal(
    explainEvent(event({ type: 'mining_stopped', trigger: 'sensor_stale' })).key,
    'protection.event.stopped.sensor'
  );
});

test('freshness separates live, stale and never-reported readings', () => {
  assert.deepEqual(freshness(2000, 10_000), { status: 'live', seconds: 2 });
  assert.deepEqual(freshness(12_000, 10_000), { status: 'stale', seconds: 12 });
  assert.equal(freshness(-1, 10_000).status, 'never');
  assert.equal(freshness(undefined, 10_000).status, 'never');
});

test('thermal headroom is only reported from a real reading and an enabled limit', () => {
  assert.equal(thermalHeadroomC(36.5, 42), 5.5);
  assert.equal(thermalHeadroomC(null, 42), null);
  assert.equal(thermalHeadroomC(Number.NaN, 42), null);
  assert.equal(thermalHeadroomC(30, 0), null);
});

test('state tones never present an unknown state as healthy', () => {
  assert.equal(stateTone(null), 'muted');
  assert.equal(stateTone('normal'), 'accent');
  assert.equal(stateTone('throttled'), 'warn');
  assert.equal(stateTone('critical'), 'danger');
});

test('exports keep protection events and never include pool or wallet data', () => {
  const [row] = mergeNativeHistory(
    [],
    [
      {
        id: 'run',
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_600_000,
        coinSymbol: 'XMR',
        algorithm: 'rx/0',
        requestedThreads: 4,
        durationSeconds: 600,
        acceptedShares: 1,
        rejectedShares: 0,
        averageHashrate: 100,
        sampleCount: 5,
        sampleWindowSeconds: 10,
        hashingSeconds: 500,
        protectionEvents: [event()],
        protectionSeconds: { caution: 30, throttled: 0 },
        pool: 'pool.example:3333'
      }
    ]
  );
  const exported = exportHistory([row]);
  const json = JSON.stringify(exported);
  assert.equal(exported.sessions[0].protection.cautionSeconds, 30);
  assert.equal(exported.sessions[0].protection.events.length, 1);
  assert.equal(exported.sessions[0].protection.events[0].trigger, 'battery_temperature');
  assert.equal(exported.sessions[0].pool, null);
  assert.ok(!json.includes('pool.example'));
  assert.ok(!/wallet|password|user/i.test(json));
});
