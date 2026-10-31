<script setup lang="ts">
import { ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import type { MinerBinaryVariant } from '../composables/useMiningController';

interface MinerDownloadProgress {
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
}

const props = defineProps<MinerDownloadWarningSheetProps>();

const emit = defineEmits<{
  confirm: [variant: MinerBinaryVariant];
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
        {{ $t('download.copy') }}
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
        <strong>{{
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
          class="primary-button"
          :disabled="downloading"
          @click="emit('confirm', selectedVariant)"
        >
          {{ downloading ? $t('download.downloading') : $t('download.confirm') }}
        </button>
      </div>
    </section>
  </div>
</template>
