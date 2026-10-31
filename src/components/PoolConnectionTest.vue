<script setup lang="ts">
import { ref } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
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

async function testConnection() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  report.value = null;
  preview.value = '';
  copied.value = false;
  try {
    if (!Capacitor.isNativePlatform())
      throw new Error(t('pool.androidOnly'));
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
  <div class="space-y-3">
    <button class="outline-button" type="button" :disabled="busy" @click="testConnection">
      {{ busy ? $t('pool.testing') : $t('pool.test') }}
    </button>
    <p class="section-copy">
      {{ $t('pool.testCopy') }}
    </p>
    <p v-if="error" role="alert" class="field-error">{{ error }}</p>
    <ol v-if="report" class="section-copy" aria-live="polite">
      <li v-for="(stage, index) in report.stages" :key="index">
        <strong>{{ stage.stage }} · {{ stage.passed ? $t('pool.passed') : $t('pool.failed') }}</strong
        >: {{ stage.detail }}
      </li>
    </ol>
    <details v-if="preview">
      <summary>{{ $t('pool.preview') }}</summary>
      <p class="section-copy">
        {{ $t('pool.previewCopy') }}
      </p>
      <pre class="section-copy overflow-x-auto" tabindex="0">{{ preview }}</pre>
      <button class="outline-button" type="button" @click="copyReport">
        {{ copied ? $t('pool.copied') : $t('pool.copy') }}
      </button>
    </details>
  </div>
</template>
