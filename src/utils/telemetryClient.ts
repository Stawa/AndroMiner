export const TELEMETRY_STORAGE_KEY = 'androminer-telemetry';
export const DEFAULT_CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_BACKOFF_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export type ApkVariant = 'download' | 'tls' | 'notls';

export interface TelemetryState {
  enabled: boolean;
  installationId: string;
  country: string | null;
  lastCheckinAt: number | null;
  lastAttemptAt: number | null;
  pendingDeletion: string[];
}

export interface TelemetryEnvironment {
  appVersion: string;
  androidMajor: number;
  variant: ApkVariant;
}

export interface CheckinPayload {
  v: 1;
  installationId: string;
  country: string | null;
  appVersion: string;
  androidMajor: number;
  variant: ApkVariant;
}

export type CheckinResult =
  'sent' | 'unavailable' | 'disabled' | 'not-due' | 'backoff' | 'unsupported' | 'failed';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TelemetryClientOptions {
  /** Base URL of the statistics service. Empty disables the feature entirely. */
  endpoint: string;
  storage: KeyValueStorage;
  fetchImpl: typeof fetch;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  /** Returns null when this build cannot report (for example the web build). */
  getEnvironment: () => Promise<TelemetryEnvironment | null>;
  intervalMs?: number;
}

const idPattern = /^[0-9a-f]{32}$/;
const countryPattern = /^[A-Z]{2}$/;

export const defaultState = (): TelemetryState => ({
  enabled: false,
  installationId: '',
  country: null,
  lastCheckinAt: null,
  lastAttemptAt: null,
  pendingDeletion: []
});

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const normalizeState = (raw: unknown): TelemetryState => {
  const defaults = defaultState();
  if (!raw || typeof raw !== 'object') return defaults;
  const source = raw as Partial<Record<keyof TelemetryState, unknown>>;
  return {
    enabled: source.enabled === true,
    installationId:
      typeof source.installationId === 'string' && idPattern.test(source.installationId)
        ? source.installationId
        : '',
    country:
      typeof source.country === 'string' && countryPattern.test(source.country)
        ? source.country
        : null,
    lastCheckinAt: finiteOrNull(source.lastCheckinAt),
    lastAttemptAt: finiteOrNull(source.lastAttemptAt),
    pendingDeletion: Array.isArray(source.pendingDeletion)
      ? source.pendingDeletion.filter(
          (id): id is string => typeof id === 'string' && idPattern.test(id)
        )
      : []
  };
};

export const generateInstallationId = (
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length))
): string => Array.from(randomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The complete set of fields ever transmitted. Nothing else is read from the app or device. */
export const buildPayload = (
  state: TelemetryState,
  environment: TelemetryEnvironment
): CheckinPayload => ({
  v: 1,
  installationId: state.installationId,
  country: state.country,
  appVersion: environment.appVersion,
  androidMajor: environment.androidMajor,
  variant: environment.variant
});

export const isAcceptableEndpoint = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return url.protocol === 'https:' || (url.protocol === 'http:' && local);
  } catch {
    return false;
  }
};

export const createTelemetryClient = (options: TelemetryClientOptions) => {
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? DEFAULT_CHECKIN_INTERVAL_MS;
  const endpoint = options.endpoint.replace(/\/+$/, '');
  const available = endpoint !== '' && isAcceptableEndpoint(endpoint);
  let state = defaultState();
  let flushing: Promise<void> | null = null;

  const load = (): TelemetryState => {
    try {
      const raw = options.storage.getItem(TELEMETRY_STORAGE_KEY);
      state = raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch {
      state = defaultState();
    }
    return state;
  };

  const save = (): void => {
    try {
      options.storage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Storage unavailable: telemetry state simply does not persist. */
    }
  };

  const request = async (path: string, init: RequestInit): Promise<Response> =>
    options.fetchImpl(`${endpoint}${path}`, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

  /** Sends queued deletion requests. Runs even while reporting is off because the user asked for it. */
  const flushDeletions = (): Promise<void> => {
    if (!available || state.pendingDeletion.length === 0) return Promise.resolve();
    flushing ??= (async () => {
      for (const id of [...state.pendingDeletion]) {
        try {
          const response = await request(`/v1/installations/${id}`, { method: 'DELETE' });
          if (response.status === 204 || response.status === 404) {
            state.pendingDeletion = state.pendingDeletion.filter((pending) => pending !== id);
            save();
          }
        } catch {
          /* Retried the next time the app starts. */
        }
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  };

  const queueDeletion = (id: string): void => {
    if (id && !state.pendingDeletion.includes(id)) state.pendingDeletion.push(id);
  };

  return {
    available,
    load,
    getState: (): TelemetryState => state,
    flushDeletions,

    setEnabled(enabled: boolean): void {
      state.enabled = enabled;
      if (enabled && !state.installationId)
        state.installationId = generateInstallationId(options.randomBytes);
      save();
    },

    setCountry(country: string | null): void {
      state.country = country && countryPattern.test(country) ? country : null;
      save();
    },

    /** Issues a new random ID and asks the service to forget the old one. */
    async resetInstallationId(): Promise<void> {
      queueDeletion(state.installationId);
      state.installationId = state.enabled ? generateInstallationId(options.randomBytes) : '';
      state.lastCheckinAt = null;
      state.lastAttemptAt = null;
      save();
      await flushDeletions();
    },

    /** Stops reporting, forgets local identity, and asks the service to delete the record. */
    async withdraw(): Promise<void> {
      queueDeletion(state.installationId);
      state = { ...defaultState(), pendingDeletion: state.pendingDeletion };
      save();
      await flushDeletions();
    },

    /** Sends at most one anonymous check-in per interval. Never throws. */
    async checkinIfDue(): Promise<CheckinResult> {
      try {
        if (!available) return 'unavailable';
        if (!state.enabled || !state.installationId) return 'disabled';
        const current = now();
        // A last check-in in the future means the clock moved; treat it as due.
        if (
          state.lastCheckinAt !== null &&
          state.lastCheckinAt <= current &&
          current - state.lastCheckinAt < intervalMs
        ) {
          return 'not-due';
        }
        if (
          state.lastAttemptAt !== null &&
          state.lastAttemptAt <= current &&
          current - state.lastAttemptAt < RETRY_BACKOFF_MS
        ) {
          return 'backoff';
        }
        const environment = await options.getEnvironment();
        if (!environment) return 'unsupported';
        if (!state.enabled) return 'disabled';

        const payload = buildPayload(state, environment);
        state.lastAttemptAt = current;
        save();
        const response = await request('/v1/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) return 'failed';
        // Discard the result if the user turned reporting off or reset the ID while in flight.
        if (state.enabled && state.installationId === payload.installationId) {
          state.lastCheckinAt = now();
          save();
        }
        return 'sent';
      } catch {
        return 'failed';
      }
    }
  };
};

export type TelemetryClient = ReturnType<typeof createTelemetryClient>;
