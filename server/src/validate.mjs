import { readFileSync } from 'node:fs';

const countryCodes = new Set(
  JSON.parse(readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8'))
);

export const VARIANTS = ['download', 'tls', 'notls'];
const allowedFields = new Set([
  'v',
  'installationId',
  'country',
  'appVersion',
  'androidMajor',
  'variant',
  'miningSeconds',
  'acceptedShares'
]);
const MAX_MINING_SECONDS = 10 * 365 * 86_400;
const MAX_ACCEPTED_SHARES = 10_000_000_000;
const idPattern = /^[0-9a-f]{32}$/;
const versionPattern = /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?(?:-[0-9A-Za-z.]{1,16})?$/;

export const isInstallationId = (value) => typeof value === 'string' && idPattern.test(value);
export const isCountryCode = (value) => typeof value === 'string' && countryCodes.has(value);

/** A heartbeat carries only the installation ID; anything else is rejected. */
export const validateHeartbeat = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  if (Object.keys(body).some((key) => key !== 'v' && key !== 'installationId')) {
    return { ok: false, error: 'Request contains an unexpected field.' };
  }
  if (body.v !== 1) return { ok: false, error: 'Unsupported schema version.' };
  if (!isInstallationId(body.installationId)) {
    return { ok: false, error: 'installationId must be 32 lowercase hex characters.' };
  }
  return { ok: true, value: { installationId: body.installationId } };
};

/** Returns `{ ok: true, value }` or `{ ok: false, error }`. Unknown fields are rejected. */
export const validateCheckin = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key))
      return { ok: false, error: 'Request contains an unexpected field.' };
  }
  if (body.v !== 1) return { ok: false, error: 'Unsupported schema version.' };
  if (!isInstallationId(body.installationId)) {
    return { ok: false, error: 'installationId must be 32 lowercase hex characters.' };
  }
  const country = body.country ?? null;
  if (country !== null && !isCountryCode(country)) {
    return { ok: false, error: 'country must be an ISO 3166-1 alpha-2 code or null.' };
  }
  const appVersion = body.appVersion ?? null;
  const androidMajor = body.androidMajor ?? null;
  const variant = body.variant ?? null;
  if (appVersion !== null && (typeof appVersion !== 'string' || !versionPattern.test(appVersion))) {
    return { ok: false, error: 'appVersion is not a valid version string or null.' };
  }
  if (
    androidMajor !== null &&
    (!Number.isInteger(androidMajor) || androidMajor < 5 || androidMajor > 40)
  ) {
    return { ok: false, error: 'androidMajor must be an integer between 5 and 40, or null.' };
  }
  if (variant !== null && !VARIANTS.includes(variant)) {
    return { ok: false, error: `variant must be one of: ${VARIANTS.join(', ')}, or null.` };
  }
  const miningSeconds = body.miningSeconds ?? null;
  const acceptedShares = body.acceptedShares ?? null;
  if (
    miningSeconds !== null &&
    (!Number.isInteger(miningSeconds) || miningSeconds < 0 || miningSeconds > MAX_MINING_SECONDS)
  ) {
    return { ok: false, error: 'miningSeconds must be a non-negative integer or null.' };
  }
  if (
    acceptedShares !== null &&
    (!Number.isInteger(acceptedShares) ||
      acceptedShares < 0 ||
      acceptedShares > MAX_ACCEPTED_SHARES)
  ) {
    return { ok: false, error: 'acceptedShares must be a non-negative integer or null.' };
  }
  return {
    ok: true,
    value: {
      installationId: body.installationId,
      country,
      appVersion,
      androidMajor,
      variant,
      miningSeconds,
      acceptedShares
    }
  };
};
