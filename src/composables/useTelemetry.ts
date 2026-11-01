import { readonly, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { useAppVersion } from './useAppVersion';
import { useNativeMinerInfo } from './useNativeMinerInfo';
import {
  createTelemetryClient,
  defaultState,
  type CheckinResult,
  type ShareField,
  type TelemetryEnvironment,
  type TelemetryState
} from '../utils/telemetryClient';

const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || '');
const startupDelayMs = 20_000;
const dueCheckIntervalMs = 60 * 60 * 1000;

const nativePlatform = Capacitor.isNativePlatform();
const { refreshAppVersion, version } = useAppVersion();
const { apkVariant } = useNativeMinerInfo();

const getEnvironment = async (): Promise<TelemetryEnvironment | null> => {
  if (!nativePlatform) return null;
  await refreshAppVersion();
  const info = await Device.getInfo();
  const androidMajor = Number.parseInt(info.osVersion, 10);
  if (!Number.isInteger(androidMajor)) return null;
  return { appVersion: version.value, androidMajor, variant: apkVariant.value };
};

const client = createTelemetryClient({
  endpoint,
  storage: window.localStorage,
  fetchImpl: (input, init) => fetch(input, init),
  getEnvironment
});

const state = ref<TelemetryState>(defaultState());
const busy = ref(false);
const lastResult = ref<CheckinResult | ''>('');
let started = false;

const sync = (): void => {
  const current = client.getState();
  state.value = {
    ...current,
    share: { ...current.share },
    pendingDeletion: [...current.pendingDeletion]
  };
};

const run = async (task: () => Promise<void>): Promise<void> => {
  busy.value = true;
  try {
    await task();
  } finally {
    sync();
    busy.value = false;
  }
};

/**
 * Opt-in anonymous statistics. Everything here is fire-and-forget and swallows its own errors, so
 * it can never delay startup or interact with mining. The statistics state lives under its own
 * storage key and is deliberately excluded from configuration export.
 */
export const useTelemetry = () => ({
  state: readonly(state),
  busy: readonly(busy),
  lastResult: readonly(lastResult),
  /** False in builds without a configured endpoint and in the web build. */
  supported: client.available && nativePlatform,
  buildHasEndpoint: client.available,

  /** Loads saved state and schedules the first check-in after startup has settled. */
  start(): void {
    if (started) return;
    started = true;
    client.load();
    sync();
    if (!client.available) return;
    const tick = (): void => {
      void client.checkinIfDue().then((result) => {
        lastResult.value = result;
        sync();
      });
    };
    window.setTimeout(() => {
      void client.flushDeletions().then(sync);
      tick();
      window.setInterval(tick, dueCheckIntervalMs);
    }, startupDelayMs);
  },

  async enable(): Promise<void> {
    client.setEnabled(true);
    sync();
    lastResult.value = await client.checkinIfDue();
    sync();
  },

  disable(): void {
    client.setEnabled(false);
    sync();
  },

  setCountry(country: string | null): void {
    client.setCountry(country);
    sync();
  },

  setShare(field: ShareField, shared: boolean): void {
    client.setShare(field, shared);
    sync();
  },

  resetInstallationId: () => run(() => client.resetInstallationId()),
  withdraw: () => run(() => client.withdraw())
});
