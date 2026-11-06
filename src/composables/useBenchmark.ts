import { readonly, ref } from 'vue';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { t } from '../i18n';
import type { MiningEngineId } from '../types/mining';
import {
  buildBenchmarkPayload,
  submitBenchmark,
  type BenchmarkResult,
  type SubmitOutcome
} from '../utils/benchmarkClient';
import { isAcceptableEndpoint } from '../utils/telemetryClient';

interface NativeBenchmark {
  benchmark(options: { engine: string }): Promise<BenchmarkResult>;
  cancelBenchmark(): Promise<void>;
  addListener(
    eventName: 'benchmarkLog',
    listener: (event: BenchmarkLogEvent) => void
  ): Promise<PluginListenerHandle>;
}

interface BenchmarkLogEvent {
  level: 'info' | 'miner' | 'warn' | 'error';
  line: string;
  /** Speed readings taken so far; -1 when the line is not a reading. */
  samples: number;
  total: number;
}

export interface BenchmarkLogLine {
  id: number;
  level: BenchmarkLogEvent['level'];
  text: string;
}

const LOG_LIMIT = 200;

const native = registerPlugin<NativeBenchmark>('NativeMiner');
const endpoint = String(import.meta.env.VITE_TELEMETRY_ENDPOINT || '');

export type ShareState = 'idle' | 'sending' | SubmitOutcome;

/** Module state, so a run keeps going and its result survives switching tabs. */
const running = ref(false);
const result = ref<BenchmarkResult | null>(null);
const error = ref('');
const shareState = ref<ShareState>('idle');
const log = ref<BenchmarkLogLine[]>([]);
/** 0 to 1, from the speed readings taken so far. */
const progress = ref(0);
let nextLogId = 0;

const addLog = (level: BenchmarkLogLine['level'], text: string) => {
  log.value.push({ id: nextLogId++, level, text });
  if (log.value.length > LOG_LIMIT) log.value.splice(0, log.value.length - LOG_LIMIT);
};

const shareHost = ((): string => {
  try {
    return isAcceptableEndpoint(endpoint) ? new URL(endpoint).host : '';
  } catch {
    return '';
  }
})();

/**
 * Local speed benchmark. Running it sends nothing anywhere; sharing the result is a separate call
 * the user starts after seeing the warning, and it is independent of the usage-statistics setting.
 */
export const useBenchmark = () => ({
  running: readonly(running),
  result: readonly(result),
  error: readonly(error),
  shareState: readonly(shareState),
  log: readonly(log),
  progress: readonly(progress),
  /** Empty when this build has no statistics service, so results cannot be shared. */
  shareHost,

  async run(engine: MiningEngineId): Promise<void> {
    if (running.value) return;
    running.value = true;
    error.value = '';
    result.value = null;
    shareState.value = 'idle';
    log.value = [];
    progress.value = 0;
    let handle: PluginListenerHandle | undefined;
    try {
      if (!Capacitor.isNativePlatform()) throw new Error(t('bench.androidOnly'));
      handle = await native.addListener('benchmarkLog', (event) => {
        if (event.samples >= 0 && event.total > 0) progress.value = event.samples / event.total;
        addLog(event.level, event.line);
      });
      result.value = await native.benchmark({ engine: engine === 'xmrigcc' ? 'xmrigcc' : 'xmrig' });
    } catch (failure) {
      const { message, code } = failure as { message?: string; code?: string };
      error.value = code === 'cancelled' ? t('bench.cancelled') : message || t('bench.failed');
      // The native side logs its own failures; this covers the ones it never saw.
      if (code !== 'cancelled' && !log.value.some((entry) => entry.level === 'error'))
        addLog('error', error.value);
    } finally {
      await handle?.remove();
      running.value = false;
    }
  },

  async cancel(): Promise<void> {
    try {
      await native.cancelBenchmark();
    } catch {
      /* Nothing to cancel. */
    }
  },

  async share(appVersion: string): Promise<void> {
    if (
      !result.value ||
      !shareHost ||
      shareState.value === 'sending' ||
      shareState.value === 'sent'
    )
      return;
    shareState.value = 'sending';
    shareState.value = await submitBenchmark({
      endpoint,
      payload: buildBenchmarkPayload(result.value, appVersion),
      fetchImpl: (input, init) => fetch(input, init)
    });
  }
});
