import { isAcceptableEndpoint } from './telemetryClient.ts';

const REQUEST_TIMEOUT_MS = 10_000;
const versionPattern = /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?(?:-[0-9A-Za-z.]{1,16})?$/;

/** What the native benchmark measured on this phone. */
export interface BenchmarkResult {
  /** Median speed in hashes per second. */
  hashrate: number;
  samples: number;
  seconds: number;
  engine: string;
  engineName: string;
  engineVersion: string;
  abi: string;
  cpuThreads: number;
  lightMode: boolean;
  device: string;
  soc: string;
  completedAt: number;
}

/** The complete body of a shared result. It has no installation ID, wallet, pool or location. */
export interface BenchmarkPayload {
  v: 1;
  device: string;
  soc: string | null;
  abi: string;
  cpuThreads: number;
  engine: string;
  engineVersion: string | null;
  appVersion: string | null;
  hashrate: number;
}

export type SubmitOutcome = 'sent' | 'unavailable' | 'rejected' | 'failed';

const version = (value: string): string | null => (versionPattern.test(value) ? value : null);

export const buildBenchmarkPayload = (
  result: BenchmarkResult,
  appVersion: string
): BenchmarkPayload => ({
  v: 1,
  device: result.device,
  soc: result.soc || null,
  abi: result.abi,
  cpuThreads: result.cpuThreads,
  engine: result.engine,
  engineVersion: version(result.engineVersion),
  appVersion: version(appVersion),
  hashrate: Math.round(result.hashrate * 10) / 10
});

/** Sends one result. Never throws; the caller decides what to tell the user. */
export const submitBenchmark = async (options: {
  endpoint: string;
  payload: BenchmarkPayload;
  fetchImpl: typeof fetch;
}): Promise<SubmitOutcome> => {
  const endpoint = options.endpoint.replace(/\/+$/, '');
  if (endpoint === '' || !isAcceptableEndpoint(endpoint)) return 'unavailable';
  try {
    const response = await options.fetchImpl(`${endpoint}/v1/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.payload),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (response.ok) return 'sent';
    return response.status >= 400 && response.status < 500 && response.status !== 429
      ? 'rejected'
      : 'failed';
  } catch {
    return 'failed';
  }
};
