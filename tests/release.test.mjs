import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease } from '../website/src/site/release.ts';

const base = 'https://github.com/Stawa/AndroMiner/releases/download/v1.0.0/';
const sha = (c) => c.repeat(64);
const asset = (name, extra = {}) => ({
  name,
  size: 100,
  browser_download_url: base + name,
  ...extra
});

test('maps variants and prefers the asset digest', () => {
  const info = parseRelease({
    tag_name: 'v1.0.0',
    prerelease: false,
    assets: [
      asset('androminer-tls-v1.0.0.apk', { digest: `sha256:${sha('a')}` }),
      asset('androminer-notls-v1.0.0.apk'),
      asset('androminer-web-v1.0.0.zip')
    ],
    body: `| \`androminer-notls-v1.0.0.apk\` | \`${sha('b')}\` |`
  });
  assert.equal(info.apks.tls.sha256, sha('a'));
  assert.equal(info.apks.notls.sha256, sha('b'));
  assert.equal(info.apks.download, undefined);
  assert.equal(info.taggedPreview, false);
});

test('missing checksum stays null and foreign URLs are dropped', () => {
  const info = parseRelease({
    tag_name: 'v1.0.0-beta.1',
    assets: [
      asset('androminer-download-v1.0.0.apk'),
      { ...asset('androminer-tls-v1.0.0.apk'), browser_download_url: 'https://evil.test/x.apk' }
    ]
  });
  assert.equal(info.apks.download.sha256, null);
  assert.equal(info.apks.tls, undefined);
  assert.equal(info.taggedPreview, true);
});

test('rejects a malformed payload', () => {
  assert.throws(() => parseRelease({}), /Unexpected/);
});
