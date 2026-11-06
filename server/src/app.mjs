import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { computeBenchmarks } from './benchmarks.mjs';
import { createDownloadsSource } from './github.mjs';
import { createRateLimiter } from './ratelimit.mjs';
import { computeStats } from './stats.mjs';
import {
  isInstallationId,
  validateBenchmark,
  validateCheckin,
  validateHeartbeat
} from './validate.mjs';

const MAX_BODY_BYTES = 1024;
const LEADERBOARD_SIZE = 50;
const CLIENT_ERRORS = {
  contentType: 'Content-Type must be application/json.',
  tooLarge: 'Request body is too large.',
  badJson: 'Body is not valid JSON.',
  rateLimited: 'Too many requests.',
  busy: 'Service is busy.',
  badId: 'Invalid installation ID.',
  unauthorized: 'Unauthorized.',
  notFound: 'Not found.'
};

class HttpError extends Error {
  constructor(status, code, headers = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

const readJson = async (request) => {
  const type = (request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    throw new HttpError(415, 'contentType');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'tooLarge');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'badJson');
  }
};

const digest = (value) => createHash('sha256').update(value).digest();
const isCronAuthorized = (header, secret) =>
  timingSafeEqual(digest(String(header ?? '')), digest(`Bearer ${secret}`));

/**
 * Builds the request handler around a store (SQLite or Firestore). `now` and `fetchImpl` are
 * injectable for tests. Requests are never logged: no address, installation ID, or payload is
 * written anywhere except the record the user's own check-in creates.
 */
export const createApp = ({ config, store, now = Date.now, fetchImpl }) => {
  const nowSeconds = () => Math.floor(now() / 1000);
  const writeLimiter = createRateLimiter({ limit: config.rateLimitPerMinute, now });
  const readLimiter = createRateLimiter({ limit: config.rateLimitPerMinute * 4, now });
  const downloads = createDownloadsSource({ config, store, fetchImpl, now });

  const clientAddress = (request) => {
    if (config.clientIpHeader) {
      const forwarded = String(request.headers[config.clientIpHeader] || '');
      const last = forwarded.split(',').pop().trim();
      if (last) return last;
    }
    return request.socket.remoteAddress || 'unknown';
  };

  const limit = (limiter, request, bucket) => {
    const result = limiter.check(clientAddress(request), bucket);
    if (!result.allowed) {
      throw new HttpError(429, 'rateLimited', {
        'Retry-After': String(result.retryAfterSeconds)
      });
    }
  };

  const route = async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const { pathname } = url;

    if (request.method === 'GET' && pathname === '/healthz') {
      return send(response, 200, { ok: true });
    }

    if (request.method === 'GET' && pathname === '/v1/stats') {
      limit(readLimiter, request, 'read');
      const [inputs, downloadSummary] = await Promise.all([
        store.readStatsInputs(nowSeconds()),
        downloads.get()
      ]);
      const payload = computeStats(inputs, nowSeconds(), config, downloadSummary);
      return send(response, 200, payload, { 'Cache-Control': 'public, max-age=300' });
    }

    if (request.method === 'GET' && pathname === '/v1/leaderboard') {
      limit(readLimiter, request, 'read');
      const rows = await store.readLeaderboard(LEADERBOARD_SIZE, nowSeconds());
      const entries = rows.map((row, index) => ({ rank: index + 1, ...row }));
      const payload = { generatedAt: new Date(now()).toISOString(), entries };
      return send(response, 200, payload, { 'Cache-Control': 'public, max-age=60' });
    }

    if (request.method === 'GET' && pathname === '/v1/benchmarks') {
      limit(readLimiter, request, 'read');
      const rows = await store.readBenchmarkRows(
        nowSeconds() - config.retentionDays * 86_400,
        nowSeconds()
      );
      const payload = computeBenchmarks(rows, config.minBenchmarkSamples, nowSeconds());
      return send(response, 200, payload, { 'Cache-Control': 'public, max-age=300' });
    }

    if (request.method === 'POST' && pathname === '/v1/benchmark') {
      limit(writeLimiter, request, 'benchmark');
      const result = validateBenchmark(await readJson(request));
      if (!result.ok) return send(response, 400, { ok: false, error: result.error });
      const outcome = await store.addBenchmark(result.value, nowSeconds(), {
        maxPerHour: config.maxBenchmarksPerHour
      });
      if (outcome.busy) throw new HttpError(429, 'busy', { 'Retry-After': '3600' });
      return send(response, 200, { ok: true });
    }

    if (request.method === 'POST' && pathname === '/v1/heartbeat') {
      limit(writeLimiter, request, 'heartbeat');
      const result = validateHeartbeat(await readJson(request));
      if (!result.ok) return send(response, 400, { ok: false, error: result.error });
      const outcome = await store.heartbeat(result.value.installationId, nowSeconds());
      return send(response, 200, { ok: true, counted: outcome.counted });
    }

    if (request.method === 'POST' && pathname === '/v1/checkin') {
      limit(writeLimiter, request, 'write');
      const result = validateCheckin(await readJson(request));
      if (!result.ok) return send(response, 400, { ok: false, error: result.error });
      const outcome = await store.checkin(result.value, nowSeconds(), {
        minIntervalSeconds: config.minCheckinIntervalHours * 3600,
        maxNewPerHour: config.maxNewInstallsPerHour
      });
      if (outcome.busy) throw new HttpError(429, 'busy', { 'Retry-After': '3600' });
      return send(response, 200, { ok: true, counted: outcome.counted });
    }

    const deletion = pathname.match(/^\/v1\/installations\/([^/]+)$/);
    if (request.method === 'DELETE' && deletion) {
      limit(writeLimiter, request, 'write');
      if (!isInstallationId(deletion[1])) throw new HttpError(400, 'badId');
      // The same 204 is returned whether or not a record existed, so IDs cannot be probed.
      await store.deleteInstallation(deletion[1]);
      response.writeHead(204, baseHeaders());
      return response.end();
    }

    if (request.method === 'GET' && pathname === '/v1/maintenance/prune' && config.cronSecret) {
      if (!isCronAuthorized(request.headers.authorization, config.cronSecret)) {
        throw new HttpError(401, 'unauthorized');
      }
      await store.prune(nowSeconds(), config);
      return send(response, 200, { ok: true });
    }

    throw new HttpError(404, 'notFound');
  };

  const baseHeaders = (extra = {}) => ({
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  });

  const send = (response, status, body, extra) => {
    response.writeHead(status, baseHeaders({ 'Content-Type': 'application/json', ...extra }));
    response.end(JSON.stringify(body));
  };

  const handler = async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, baseHeaders());
        return response.end();
      }
      await route(request, response);
    } catch (error) {
      if (error instanceof HttpError) {
        return send(
          response,
          error.status,
          { ok: false, error: CLIENT_ERRORS[error.code] },
          error.headers
        );
      }
      console.error(`Unhandled error: ${error instanceof Error ? error.message : 'unknown'}`);
      send(response, 500, { ok: false, error: 'Internal error.' });
    }
  };

  return {
    handler,
    store,
    prune: () => store.prune(nowSeconds(), config),
    listen: () => createServer(handler).listen(config.port, config.host)
  };
};
