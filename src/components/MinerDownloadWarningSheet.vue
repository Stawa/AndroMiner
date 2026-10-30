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
        <h2 id="download-title" class="dialog-title">Download mining engine</h2>
        <button
          class="outline-button"
          aria-label="Close download warning"
          :disabled="downloading"
          @click="emit('cancel')"
        >
          <MaterialIcon name="close" :size="20" />
        </button>
      </div>
      <p class="section-copy">
        This APK needs an ARM64 XMRig executable. It downloads from the AndroMiner project's GitHub
        miner-builder branch and runs locally on your phone.
      </p>
      <div class="notice">
        <MaterialIcon name="info" :size="20" />
        <p>
          Continue only if you trust this source. Security apps may flag mining software. Downloaded
          binaries need the compatible download APK.
        </p>
      </div>
      <div class="variant-picker">
        <button
          :aria-pressed="selectedVariant === 'tls'"
          :disabled="downloading"
          @click="selectedVariant = 'tls'"
        >
          <MaterialIcon name="lock" :size="20" /><strong>TLS</strong
          ><small>Encrypted pools supported</small></button
        ><button
          :aria-pressed="selectedVariant === 'notls'"
          :disabled="downloading"
          @click="selectedVariant = 'notls'"
        >
          <MaterialIcon name="lock_open" :size="20" /><strong>No TLS</strong
          ><small>Plain TCP only</small>
        </button>
      </div>
      <div v-if="downloading" class="download-progress" role="status" aria-live="polite">
        <strong>{{
          progress.totalBytes ? Math.round(progress.percent) + '%' : 'Downloading…'
        }}</strong
        ><progress
          v-if="progress.totalBytes"
          :value="progress.percent"
          max="100"
          aria-label="Miner download progress"
        /><progress v-else aria-label="Miner download progress" />
        <p>
          {{ formatBytes(progress.downloadedBytes)
          }}{{ progress.totalBytes ? ' / ' + formatBytes(progress.totalBytes) : ' downloaded' }}
        </p>
      </div>
      <div v-if="error" class="notice notice-error" role="alert">
        <p>{{ error }}</p>
      </div>
      <div class="action-row dialog-actions">
        <button class="outline-button" :disabled="downloading" @click="emit('cancel')">
          Cancel</button
        ><button
          class="primary-button"
          :disabled="downloading"
          @click="emit('confirm', selectedVariant)"
        >
          {{ downloading ? 'Downloading…' : 'Download & continue' }}
        </button>
      </div>
    </section>
  </div>
</template>
