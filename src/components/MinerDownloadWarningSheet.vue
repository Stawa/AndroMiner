<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import type { MinerBinaryVariant } from '../composables/useMiningController';
import { downloadableEngines } from '../utils/engineDownloads';
import type { NativeEngineInfo } from '../utils/engines';

interface MinerDownloadProgress {
  engine: string;
  variant: MinerBinaryVariant;
  percent: number;
  downloadedBytes: number;
  totalBytes: number | null;
}

interface MinerDownloadWarningSheetProps {
  open: boolean;
  downloading: boolean;
  progress: MinerDownloadProgress;
  error?: string;
  /** What this device reports for every engine; empty until the native layer has answered. */
  engines: readonly NativeEngineInfo[];
  selectedId: string;
}

const props = defineProps<MinerDownloadWarningSheetProps>();

const emit = defineEmits<{
  confirm: [variant: MinerBinaryVariant, scope: 'selected' | 'all'];
  cancel: [];
}>();

const selectedVariant = ref<MinerBinaryVariant>('tls');

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${Math.round(bytes)} B`;
};
const missing = computed(() => downloadableEngines(props.engines));
const selectedMissing = computed(() =>
  missing.value.some((engine) => engine.id === props.selectedId)
);
const nameOf = (id: string): string =>
  props.engines.find((engine) => engine.id === id)?.name ?? (id === 'xmrig' ? 'XMRig' : id);
const selectedName = computed(() => nameOf(props.selectedId));
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => props.open,
  panel,
  () => {
    if (!props.downloading) emit('cancel');
  }
);
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="!downloading && emit('cancel')">
    <section
      ref="panel"
      class="detail-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-title"
      tabindex="-1"
    >
      <div class="section-heading">
        <h2 id="download-title" class="dialog-title">{{ $t('download.title') }}</h2>
        <button
          class="outline-button"
          :aria-label="$t('download.close')"
          :disabled="downloading"
          @click="emit('cancel')"
        >
          <MaterialIcon name="close" :size="20" />
        </button>
      </div>
      <p class="section-copy">
        {{
          $t('download.copy', {
            engine: selectedMissing || !missing.length ? selectedName : $t('download.engines')
          })
        }}
      </p>
      <div class="notice">
        <MaterialIcon name="info" :size="20" />
        <p>
          {{ $t('download.notice') }}
        </p>
      </div>
      <div class="variant-picker">
        <button
          :aria-pressed="selectedVariant === 'tls'"
          :disabled="downloading"
          @click="selectedVariant = 'tls'"
        >
          <MaterialIcon name="lock" :size="20" /><strong>TLS</strong
          ><small>{{ $t('download.tlsHint') }}</small></button
        ><button
          :aria-pressed="selectedVariant === 'notls'"
          :disabled="downloading"
          @click="selectedVariant = 'notls'"
        >
          <MaterialIcon name="lock_open" :size="20" /><strong>No TLS</strong
          ><small>{{ $t('download.noTlsHint') }}</small>
        </button>
      </div>
      <div v-if="downloading" class="download-progress" role="status" aria-live="polite">
        <strong
          >{{ nameOf(progress.engine) }} ·
          {{
            progress.totalBytes ? Math.round(progress.percent) + '%' : $t('download.downloading')
          }}</strong
        ><progress
          v-if="progress.totalBytes"
          :value="progress.percent"
          max="100"
          :aria-label="$t('download.progress')"
        /><progress v-else :aria-label="$t('download.progress')" />
        <p>
          {{
            progress.totalBytes
              ? formatBytes(progress.downloadedBytes) + ' / ' + formatBytes(progress.totalBytes)
              : $t('download.bytesDownloaded', { size: formatBytes(progress.downloadedBytes) })
          }}
        </p>
      </div>
      <div v-if="error" class="notice notice-error" role="alert">
        <p>{{ error }}</p>
      </div>
      <div class="action-row dialog-actions">
        <button class="outline-button" :disabled="downloading" @click="emit('cancel')">
          {{ $t('common.cancel') }}</button
        ><button
          v-if="selectedMissing || !missing.length"
          class="primary-button"
          :disabled="downloading"
          @click="emit('confirm', selectedVariant, 'selected')"
        >
          {{
            downloading
              ? $t('download.downloading')
              : missing.length
                ? $t('download.confirmOne', { engine: selectedName })
                : $t('download.confirm')
          }}</button
        ><button
          v-if="missing.length > 1 || (missing.length === 1 && !selectedMissing)"
          :class="selectedMissing ? 'outline-button' : 'primary-button'"
          :disabled="downloading"
          @click="emit('confirm', selectedVariant, 'all')"
        >
          {{
            missing.length === 1
              ? $t('download.confirmOne', { engine: missing[0].name })
              : $t('download.confirmAll', { count: missing.length })
          }}
        </button>
      </div>
    </section>
  </div>
</template>
