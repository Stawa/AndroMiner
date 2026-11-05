import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coinFitsEngine,
  engineForCoin,
  engineSelectable,
  normalizeEngine
} from '../src/utils/engines.ts';
import { validateMiningSetup } from '../src/utils/configValidation.ts';
import { cryptocurrencies, getCryptocurrencyById } from '../src/data/miningCatalog.ts';

const info = (overrides = {}) => ({
  id: 'xmrig',
  name: 'XMRig',
  status: 'supported',
  version: '6.26.0',
  installedVersion: null,
  license: 'GPL-3.0',
  upstream: '',
  note: '',
  algorithms: ['rx/0'],
  protocols: ['stratum+tcp'],
  abis: ['arm64-v8a'],
  abiSupported: true,
  installed: true,
  downloadable: true,
  downloadApproved: true,
  source: 'bundled',
  intensityControl: { method: 'duty-cycle', verifiedOnDevice: false },
  ...overrides
});

test('missing or unknown engines mean XMRig, so older saved setups keep working', () => {
  assert.equal(normalizeEngine(undefined), 'xmrig');
  assert.equal(normalizeEngine('nonsense'), 'xmrig');
  assert.equal(normalizeEngine('retired-engine'), 'xmrig');
  assert.equal(normalizeEngine('xlarig'), 'xlarig');
  assert.equal(normalizeEngine('xmrigcc'), 'xmrigcc');
});

test('Panthera is only offered to XLArig and RandomX coins never to XLArig', () => {
  const xla = getCryptocurrencyById('xla');
  const xmr = getCryptocurrencyById('xmr');
  assert.equal(xla.requiredEngine, 'xlarig');
  assert.equal(coinFitsEngine(xla, 'xlarig'), true);
  assert.equal(coinFitsEngine(xla, 'xmrig'), false);
  assert.equal(coinFitsEngine(xla, 'xmrigcc'), false);
  assert.equal(coinFitsEngine(xmr, 'xlarig'), false);
  assert.equal(coinFitsEngine(xmr, 'xmrig'), true);
  assert.equal(coinFitsEngine(xmr, 'xmrigcc'), true);
});

test('native algorithm lists override the static rule', () => {
  const xmr = getCryptocurrencyById('xmr');
  assert.equal(coinFitsEngine(xmr, 'xmrig', [info({ algorithms: ['rx/wow'] })]), false);
  assert.equal(coinFitsEngine(xmr, 'xmrig', [info({ algorithms: ['rx/0'] })]), true);
});

test('an engine is selectable only when launchable, built for this CPU and installed', () => {
  assert.equal(engineSelectable(info()), true);
  assert.equal(engineSelectable(undefined), false);
  assert.equal(engineSelectable(info({ status: 'unsupported' })), false);
  assert.equal(engineSelectable(info({ abiSupported: false })), false);
  assert.equal(engineSelectable(info({ installed: false })), false);
});

test('a coin selects its own engine', () => {
  assert.equal(engineForCoin(getCryptocurrencyById('xmr')), 'xmrig');
  assert.equal(engineForCoin(getCryptocurrencyById('xla')), 'xlarig');
  assert.equal(engineForCoin(undefined), 'xmrig');
});

test('the automatic engine skips one that cannot start on this device', () => {
  const xmr = getCryptocurrencyById('xmr');
  const engines = [
    info({ id: 'xmrig', installed: false }),
    info({ id: 'xmrigcc', installed: true }),
    info({ id: 'xlarig', algorithms: ['panthera'] })
  ];
  assert.equal(engineForCoin(xmr, engines), 'xmrigcc');
  assert.equal(engineForCoin(xmr, [info({ installed: false })]), 'xmrig');
});

test('start validation rejects a coin the chosen engine cannot mine', () => {
  const base = { walletAddress: 'w', poolUrl: 'p', poolPort: 1 };
  const xla = getCryptocurrencyById('xla');
  const xmr = getCryptocurrencyById('xmr');
  assert.equal(validateMiningSetup({ ...base, coin: xla, engine: 'xlarig' }).engine, '');
  assert.equal(
    validateMiningSetup({ ...base, coin: xla, engine: 'xmrig' }).engine,
    'validation.engine'
  );
  assert.equal(
    validateMiningSetup({ ...base, coin: xmr, engine: 'xlarig' }).engine,
    'validation.engine'
  );
  assert.equal(validateMiningSetup({ ...base, coin: xmr }).engine, '');
  assert.equal(validateMiningSetup(base).engine, '');
});

test('Tari and Salvium run on the XMRig family with the slash worker format', () => {
  for (const id of ['sal', 'xtm']) {
    const coin = getCryptocurrencyById(id);
    assert.equal(coin.xmrigAlgo, 'rx/0');
    assert.equal(coin.workerSeparator, '/');
    assert.equal(coin.supportStatus, 'bundled');
    assert.match(coin.supportNote, /experimental/);
    assert.equal(coinFitsEngine(coin, 'xmrig'), true);
    assert.equal(coinFitsEngine(coin, 'xmrigcc'), true);
    assert.equal(coinFitsEngine(coin, 'xlarig'), false);
  }
});

test('every offered coin has an engine and retired coins are gone', () => {
  for (const coin of cryptocurrencies)
    assert.ok(
      ['xmrig', 'xmrigcc', 'xlarig'].some((engine) => coinFitsEngine(coin, engine)),
      `${coin.id} has no engine`
    );
  for (const id of ['arq', 'sfx', 'kva', 'chukwa', 'chukwav2', 'ninja', 'tlo', 'vkax', 'dero'])
    assert.equal(getCryptocurrencyById(id), undefined, id);
});

test('a saved setup for a coin that is no longer offered fails validation with a clear key', () => {
  const base = { walletAddress: 'w', poolUrl: 'p', poolPort: 1 };
  assert.equal(
    validateMiningSetup({ ...base, coin: { id: 'arq', xmrigAlgo: 'rx/arq' } }).coin,
    'validation.coin'
  );
  assert.equal(validateMiningSetup({ ...base, coin: getCryptocurrencyById('xmr') }).coin, '');
  assert.equal(validateMiningSetup(base).coin, '');
});
