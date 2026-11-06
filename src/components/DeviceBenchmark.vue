<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useAppVersion } from '../composables/useAppVersion';
import { useBenchmark } from '../composables/useBenchmark';
import { formatDuration, formatNumber, t } from '../i18n';
import type { MiningEngineId } from '../types/mining';
import { buildBenchmarkPayload } from '../utils/benchmarkClient';

const props = defineProps<{ engine: MiningEngineId | undefined; mining: boolean }>();

const { version } = useAppVersion();
const { running, result, error, shareState, shareHost, log, progress, run, cancel, share } =
  useBenchmark();

const logList = ref<HTMLElement | null>(null);
watch(
  () => log.value.length,
  async () => {
    await nextTick();
    if (logList.value) logList.value.scrollTop = logList.value.scrollHeight;
  }
);

const engineName = computed(() => (props.engine === 'xmrigcc' ? 'XMRigCC' : 'XMRig'));
const preview = computed(() =>
  result.value ? JSON.stringify(buildBenchmarkPayload(result.value, version.value), null, 2) : ''
);
const rows = computed(() => {
  const value = result.value;
  if (!value) return [];
  return [
    { label: t('bench.engine'), value: `${value.engineName} ${value.engineVersion}` },
    { label: t('metric.cpuThreads'), value: formatNumber(value.cpuThreads) },
    { label: t('bench.abi'), value: value.abi },
    { label: t('bench.measured'), value: formatDuration(value.seconds) }
  ];
});
const shareMessage = computed(() => {
  switch (shareState.value) {
    case 'sent':
      return t('bench.shared');
    case 'failed':
      return t('bench.shareFailed');
    case 'rejected':
      return t('bench.shareRejected');
    case 'unavailable':
      return t('bench.noService');
    default:
      return '';
  }
});
</script>

<template>
  <section class="dv-group bench" :aria-label="$t('bench.title')" :aria-busy="running">
    <h2 class="eyebrow">{{ $t('bench.title') }}</h2>
    <p v-if="!result && !running" class="dv-note">
      {{ $t('bench.copy', { engine: engineName }) }}
    </p>

    <div v-if="running" class="bench-running" role="status">
      <progress
        :aria-label="$t('bench.running')"
        :value="progress > 0 ? progress : undefined"
        max="1"
      />
      <p class="dv-note">{{ $t('bench.runningCopy') }}</p>
    </div>

    <details v-if="log.length" class="bench-log" :open="running || !!error">
      <summary>{{ $t('bench.log') }}</summary>
      <ol ref="logList" tabindex="0" role="log" :aria-label="$t('bench.log')">
        <li v-for="entry in log" :key="entry.id" :class="`bench-log-${entry.level}`">
          {{ entry.text }}
        </li>
      </ol>
    </details>

    <p v-if="error" role="alert" class="notice notice-error">
      <MaterialIcon name="error" :size="20" />{{ error }}
    </p>

    <template v-if="result && !running">
      <p class="dv-reading">
        {{ formatNumber(result.hashrate, { maximumFractionDigits: 1 }) }}<span>H/s</span>
      </p>
      <p class="dv-note">{{ $t('bench.median') }} · {{ result.device }}</p>
      <p v-if="result.lightMode" class="dv-note" role="note">{{ $t('bench.lightMode') }}</p>
      <dl class="dv-list">
        <div v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <div class="bench-share">
        <h3 class="bench-share-title">{{ $t('bench.shareTitle') }}</h3>
        <template v-if="shareHost">
          <div class="notice" role="note">
            <MaterialIcon name="warning" :size="20" />
            <div>
              <p>{{ $t('bench.warning', { host: shareHost }) }}</p>
              <p>{{ $t('bench.sends') }}</p>
            </div>
          </div>
          <details class="bench-preview">
            <summary>{{ $t('bench.preview') }}</summary>
            <pre tabindex="0">{{ preview }}</pre>
          </details>
          <p
            v-if="shareMessage"
            class="notice"
            :class="{ 'notice-error': shareState !== 'sent' }"
            role="status"
          >
            {{ shareMessage }}
          </p>
          <button
            class="outline-button"
            type="button"
            :disabled="shareState === 'sending' || shareState === 'sent'"
            @click="share(version)"
          >
            <MaterialIcon name="upload" :size="20" />
            {{ shareState === 'sending' ? $t('bench.sharing') : $t('bench.share') }}
          </button>
        </template>
        <p v-else class="dv-note">{{ $t('bench.noService') }}</p>
      </div>
    </template>

    <p v-if="mining && !running" class="dv-note" role="status">{{ $t('bench.stopMining') }}</p>
    <div class="bench-actions">
      <button v-if="running" class="outline-button" type="button" @click="cancel">
        {{ $t('bench.cancel') }}
      </button>
      <button
        v-else
        class="primary-button"
        type="button"
        :disabled="mining"
        @click="run(props.engine ?? 'xmrig')"
      >
        <MaterialIcon name="speed" :size="20" />
        {{ result ? $t('bench.rerun') : $t('bench.run') }}
      </button>
    </div>
  </section>
</template>
