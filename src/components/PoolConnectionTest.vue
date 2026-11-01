<script setup lang="ts">
import { computed, ref } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import MaterialIcon from './MaterialIcon.vue';
import type { MiningConfig } from '../types/mining';
import { t } from '../i18n';

const props = defineProps<{ config: MiningConfig }>();
interface Stage {
  stage: string;
  passed: boolean;
  detail: string;
}
interface Report {
  stages: Stage[];
  checkedAt: number;
}
const native = registerPlugin<{
  testPool(options: { host: string; port: number; tls: boolean }): Promise<Report>;
}>('NativeMiner');
const busy = ref(false);
const error = ref('');
const report = ref<Report | null>(null);
const preview = ref('');
const copied = ref(false);
const target = computed(() => `${props.config.poolUrl}:${props.config.poolPort}`);
const failedCount = computed(
  () => report.value?.stages.filter((stage) => !stage.passed).length ?? 0
);

async function testConnection() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  report.value = null;
  preview.value = '';
  copied.value = false;
  try {
    if (!Capacitor.isNativePlatform()) throw new Error(t('pool.androidOnly'));
    const tls = /ssl|tls|https/.test(props.config.protocol);
    report.value = await native.testPool({
      host: props.config.poolUrl,
      port: props.config.poolPort,
      tls
    });
    preview.value = JSON.stringify(
      {
        schemaVersion: 1,
        kind: 'pool-reachability',
        tls,
        ...report.value,
        credentialsTested: false
      },
      null,
      2
    );
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : t('pool.failedGeneric');
  } finally {
    busy.value = false;
  }
}

async function copyReport() {
  try {
    await Clipboard.write({ string: preview.value });
    copied.value = true;
  } catch {
    error.value = t('pool.copyFailed');
  }
}
</script>

<template>
  <section class="pool-test" :aria-busy="busy">
    <header class="pool-test-head">
      <span class="pool-test-icon" aria-hidden="true"><MaterialIcon name="lan" :size="22" /></span>
      <div>
        <h4>{{ $t('pool.test') }}</h4>
        <code class="pool-test-target">{{ target }}</code>
      </div>
      <button class="pool-test-run" type="button" :disabled="busy" @click="testConnection">
        <MaterialIcon
          :name="busy ? 'progress_activity' : report ? 'refresh' : 'play_arrow'"
          :size="20"
          :class="{ 'pool-test-spin': busy }"
        />
        <span>{{ busy ? $t('pool.testing') : report ? $t('pool.retest') : $t('pool.run') }}</span>
      </button>
    </header>
    <p v-if="!report && !error" class="pool-test-copy">{{ $t('pool.testCopy') }}</p>
    <p v-if="error" role="alert" class="pool-test-banner" data-tone="bad">
      <MaterialIcon name="error" :size="20" />{{ error }}
    </p>
    <div v-if="report" aria-live="polite">
      <p class="pool-test-banner" :data-tone="failedCount ? 'bad' : 'good'">
        <MaterialIcon :name="failedCount ? 'cancel' : 'check_circle'" :size="20" filled />
        {{
          failedCount
            ? $t('pool.summaryFailed', { count: failedCount, total: report.stages.length })
            : $t('pool.summaryPassed')
        }}
      </p>
      <ol class="pool-test-stages">
        <li
          v-for="(stage, index) in report.stages"
          :key="index"
          :data-tone="stage.passed ? 'good' : 'bad'"
        >
          <MaterialIcon :name="stage.passed ? 'check_circle' : 'cancel'" :size="20" filled />
          <div>
            <strong>{{ stage.stage }}</strong>
            <span class="sr-only">{{ stage.passed ? $t('pool.passed') : $t('pool.failed') }}</span>
            <small>{{ stage.detail }}</small>
          </div>
        </li>
      </ol>
    </div>
    <details v-if="preview" class="pool-test-preview">
      <summary>{{ $t('pool.preview') }}</summary>
      <p class="pool-test-copy">{{ $t('pool.previewCopy') }}</p>
      <pre tabindex="0">{{ preview }}</pre>
      <button class="outline-button" type="button" @click="copyReport">
        <MaterialIcon :name="copied ? 'check' : 'content_copy'" :size="18" />
        {{ copied ? $t('pool.copied') : $t('pool.copy') }}
      </button>
    </details>
  </section>
</template>
