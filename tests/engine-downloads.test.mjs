import test from 'node:test';
import assert from 'node:assert/strict';
import {
  downloadOrder,
  downloadableEngines,
  missingEngineAction
} from '../src/utils/engineDownloads.ts';

const engine = (id, overrides = {}) => ({
  id,
  name: id,
  status: 'experimental',
  version: '',
  installedVersion: null,
  license: '',
  upstream: '',
  note: '',
  algorithms: [],
  protocols: [],
  abis: ['arm64-v8a'],
  abiSupported: true,
  installed: false,
  downloadable: true,
  downloadApproved: true,
  source: 'missing',
  intensityControl: { method: 'duty-cycle', verifiedOnDevice: false },
  ...overrides
});

const all = [
  engine('xmrig', { status: 'supported' }),
  engine('xmrigcc'),
  engine('xlarig'),
  engine('legacy', { status: 'unsupported', downloadable: false, downloadApproved: false })
];

test('only approved, supported, missing engines are offered for download', () => {
  assert.deepEqual(
    downloadableEngines(all).map((item) => item.id),
    ['xmrig', 'xmrigcc', 'xlarig']
  );
  const some = [
    engine('xmrig', { installed: true }),
    engine('xmrigcc', { downloadApproved: false }),
    engine('xlarig', { abiSupported: false })
  ];
  assert.deepEqual(downloadableEngines(some), []);
});

test('a missing engine is downloaded, an unapproved one is reported, an installed one is left', () => {
  assert.equal(missingEngineAction('xmrigcc', all), 'download');
  assert.equal(missingEngineAction('xmrigcc', [engine('xmrigcc', { installed: true })]), 'none');
  assert.equal(
    missingEngineAction('xmrigcc', [engine('xmrigcc', { downloadApproved: false })]),
    'unavailable'
  );
  assert.equal(missingEngineAction('xmrig', []), 'none');
});

test('downloading all puts the selected engine first so another failure cannot block it', () => {
  assert.deepEqual(downloadOrder('selected', 'xlarig', all), ['xlarig']);
  assert.deepEqual(downloadOrder('all', 'xlarig', all), ['xlarig', 'xmrig', 'xmrigcc']);
  assert.deepEqual(downloadOrder('selected', 'xmrig', [engine('xmrig', { installed: true })]), []);
  assert.deepEqual(downloadOrder('all', 'xmrig', [engine('xmrig', { installed: true })]), []);
});
