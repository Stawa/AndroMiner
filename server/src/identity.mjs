import { createHash } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The short code shown on the leaderboard and in the app. The installation ID is the secret that
 * authorizes deleting a record, so the public code is a one-way hash of it: 40 bits, written in
 * Crockford base32 as `XXXX-XXXX`. `src/utils/telemetryClient.ts` derives the same value on the
 * phone; both sides are pinned to one test vector.
 */
export const publicIdOf = (installationId) => {
  const digest = createHash('sha256').update(`androminer:public-id:v1:${installationId}`).digest();
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    const bit = i * 5;
    const window = (digest[bit >> 3] << 8) | digest[(bit >> 3) + 1];
    code += ALPHABET[(window >> (11 - (bit & 7))) & 31];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
};
