<script setup lang="ts">
import { ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
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
}

defineProps<MinerDownloadWarningSheetProps>();

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
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/[0.62]"
      @click="!downloading && emit('cancel')"
    />
  </Transition>
  <Transition name="sheet">
    <section
      v-if="open"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-[28px] border border-app-line bg-app-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 text-center"
    >
      <div
        class="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-app-yellow text-app-yellow"
      >
        <MaterialIcon name="warning" :size="34" />
      </div>
      <h2 class="mt-5 text-[22px] font-semibold leading-7 text-white">Download Miner?</h2>
      <p class="mx-auto mt-3 max-w-[310px] text-[15px] leading-6 text-white/82">
        AndroMiner does not include the native miner in the APK. To start mining, it will download
        the ARM64 XMRig binary from the project's GitHub miner-builder branch and run it locally.
      </p>
      <p class="mx-auto mt-3 max-w-[310px] text-[13px] leading-5 text-app-muted">
        Mining can heat your device, drain battery, and may be flagged by security apps. Continue
        only if you trust this source and understand the workload.
      </p>

      <div
        class="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-app-elevated p-1 text-left min-[360px]:grid-cols-2"
      >
        <button
          class="ripple min-h-[76px] rounded-xl px-3 py-2 disabled:opacity-55"
          :class="
            selectedVariant === 'tls'
              ? 'bg-app-green-dim text-app-green'
              : 'text-white active:bg-white/5'
          "
          type="button"
          :disabled="downloading"
          @click="selectedVariant = 'tls'"
        >
          <MaterialIcon name="lock" :size="21" />
          <span class="mt-1 block text-[14px] font-semibold leading-5">TLS</span>
          <span class="block text-[11px] leading-4 text-app-muted">Encrypted pool support</span>
        </button>
        <button
          class="ripple min-h-[76px] rounded-xl px-3 py-2 disabled:opacity-55"
          :class="
            selectedVariant === 'notls'
              ? 'bg-app-green-dim text-app-green'
              : 'text-white active:bg-white/5'
          "
          type="button"
          :disabled="downloading"
          @click="selectedVariant = 'notls'"
        >
          <MaterialIcon name="lock_open" :size="21" />
          <span class="mt-1 block text-[14px] font-semibold leading-5">No TLS</span>
          <span class="block text-[11px] leading-4 text-app-muted">Plain TCP only</span>
        </button>
      </div>

      <div v-if="downloading" class="mt-5 text-left">
        <div class="mb-2 flex items-center justify-between gap-3 text-[12px] leading-4">
          <span class="min-w-0 truncate font-medium text-white">
            {{ progress.variant === 'tls' ? 'TLS' : 'No TLS' }} miner
          </span>
          <span class="shrink-0 font-semibold text-app-green"
            >{{ Math.round(progress.percent) }}%</span
          >
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-app-green transition-[width] duration-200"
            :style="{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }"
          />
        </div>
        <p class="mt-2 break-words text-[11px] leading-4 text-app-muted">
          <template v-if="progress.totalBytes">
            {{ formatBytes(progress.downloadedBytes) }} / {{ formatBytes(progress.totalBytes) }}
          </template>
          <template v-else> {{ formatBytes(progress.downloadedBytes) }} downloaded </template>
        </p>
      </div>

      <div class="mt-5 space-y-3">
        <button
          class="ripple min-h-14 w-full rounded-xl bg-app-green-dim px-3 py-3 text-[15px] font-semibold leading-5 text-app-green disabled:opacity-55"
          type="button"
          :disabled="downloading"
          @click="emit('confirm', selectedVariant)"
        >
          <MaterialIcon
            class="mr-2 inline-block align-middle"
            :name="downloading ? 'downloading' : 'download'"
            :size="22"
          />
          <span class="align-middle">
            {{
              downloading
                ? `Downloading ${Math.round(progress.percent)}%`
                : `Download ${selectedVariant === 'tls' ? 'TLS' : 'No TLS'} & Start`
            }}
          </span>
        </button>
        <button
          class="ripple h-12 w-full rounded-xl text-[15px] font-medium text-app-muted disabled:opacity-55"
          type="button"
          :disabled="downloading"
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </section>
  </Transition>
</template>
