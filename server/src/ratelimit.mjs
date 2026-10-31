import { createHmac, randomBytes } from 'node:crypto';

/**
 * Fixed-window limiter held only in memory. Client addresses are keyed through an HMAC with a
 * per-process random secret, so a memory dump after a restart cannot recover them, and nothing is
 * ever written to disk or logs.
 */
export const createRateLimiter = ({ limit, windowMs = 60_000, now = Date.now }) => {
  const secret = randomBytes(32);
  const windows = new Map();
  const keyFor = (address) => createHmac('sha256', secret).update(String(address)).digest('base64');

  const sweep = (at) => {
    for (const [key, entry] of windows) if (entry.resetAt <= at) windows.delete(key);
  };

  return {
    /** Returns `{ allowed, retryAfterSeconds }`. */
    check(address, bucket = 'default') {
      const at = now();
      if (windows.size > 50_000) sweep(at);
      const key = `${bucket}:${keyFor(address)}`;
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000))
      };
    }
  };
};
