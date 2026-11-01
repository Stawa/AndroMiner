<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import ToggleRow from './ToggleRow.vue';
import { useSettingsStore } from '../stores/settings';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import { useGitHubReleaseUpdater } from '../composables/useGitHubReleaseUpdater';
import { formatDate, formatNumber, t } from '../i18n';

const settings = useSettingsStore();
const { apkVariant } = useNativeMinerInfo();
const {
  apkAssets,
  availableVersion,
  checking,
  checkForUpdates,
  currentVersionDisplay,
  formatAssetLabel,
  lastCheckedAt,
  message,
  openAsset,
  openRelease,
  refreshCurrentVersion,
  releasedAt,
  releaseUrl,
  status
} = useGitHubReleaseUpdater();
const opening = ref(false);
const openError = ref('');
const hasRelease = computed(() => status.value === 'ready' || status.value === 'up-to-date');
const preferredAsset = computed(
  () =>
    apkAssets.value.find((asset) => asset.name.toLowerCase().includes(`-${apkVariant.value}-`)) ||
    apkAssets.value[0]
);
const otherAssets = computed(() =>
  apkAssets.value.filter((asset) => asset.id !== preferredAsset.value?.id)
);
const heading = computed(
  () =>
    ({
      idle: t('updates.headingIdle'),
      checking: t('updates.headingChecking'),
      ready: t('updates.headingReady'),
      'up-to-date': t('updates.headingUpToDate'),
      error: t('updates.headingError')
    })[status.value]
);
const statusIcon = computed(
  () =>
    ({
      idle: 'system_update',
      checking: 'progress_activity',
      ready: 'download',
      'up-to-date': 'check',
      error: 'wifi_off'
    })[status.value]
);
const description = computed(
  () =>
    ({
      idle: t('updates.descIdle'),
      checking: t('updates.descChecking'),
      ready: `${t('updates.descReady', { version: availableVersion.value.replace(/^v/i, '') })}${releaseDate.value ? ' · ' + releaseDate.value : ''}`,
      'up-to-date': t('updates.descUpToDate'),
      error: message.value
    })[status.value]
);
const releaseDate = computed(() => {
  const date = new Date(releasedAt.value);
  return Number.isNaN(date.getTime())
    ? ''
    : formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' });
});
const checked = computed(() =>
  lastCheckedAt.value
    ? formatDate(lastCheckedAt.value, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : t('updates.notChecked')
);
const assetSize = (bytes: number) =>
  Number.isFinite(bytes) && bytes > 0
    ? `${formatNumber(bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`
    : '';
const assetDescription = (name: string) =>
  name.toLowerCase().includes('-notls-')
    ? t('updates.miner.notls')
    : name.toLowerCase().includes('-tls-')
      ? t('updates.miner.tls')
      : name.toLowerCase().includes('-download-')
        ? t('updates.miner.download')
        : t('updates.miner.other');
const openDownload = async (action: () => Promise<void>) => {
  if (opening.value) return;
  openError.value = '';
  opening.value = true;
  try {
    await action();
  } catch {
    openError.value = t('updates.openFailed');
  } finally {
    opening.value = false;
  }
};
onMounted(() => {
  void refreshCurrentVersion();
});
</script>

<template>
  <section class="surface updates-card" aria-labelledby="updates-title" :data-status="status">
    <header class="updates-header">
      <h3 id="updates-title">{{ $t('updates.title') }}</h3>
      <span class="updates-source"
        ><MaterialIcon name="code" :size="15" />{{ $t('updates.source') }}</span
      >
    </header>

    <div class="updates-status" role="status" aria-live="polite" aria-atomic="true">
      <span class="updates-status-icon"
        ><MaterialIcon :name="statusIcon" :size="23" :class="{ 'animate-spin': checking }"
      /></span>
      <div>
        <h4>{{ heading }}</h4>
        <p>{{ description }}</p>
      </div>
    </div>

    <div class="updates-installed">
      <span>{{ $t('updates.installed') }}</span
      ><strong>{{ currentVersionDisplay }}</strong>
    </div>

    <div class="updates-actions">
      <template v-if="status === 'ready' && preferredAsset">
        <button
          class="primary-button"
          :disabled="opening"
          @click="openDownload(() => openAsset(preferredAsset!))"
        >
          <MaterialIcon name="download" :size="20" />{{ $t('updates.downloadApk')
          }}<MaterialIcon name="open_in_new" :size="16" />
        </button>
        <p class="updates-download-caption">
          {{ formatAssetLabel(preferredAsset)
          }}<span v-if="assetSize(preferredAsset.size)">
            · {{ assetSize(preferredAsset.size) }}</span
          >
        </p>
        <p class="updates-download-caption">{{ $t('updates.opensBrowser') }}</p>
      </template>
      <button
        v-else
        class="outline-button updates-check"
        :disabled="checking"
        :aria-busy="checking"
        @click="checkForUpdates()"
      >
        <MaterialIcon :name="status === 'error' ? 'refresh' : 'sync'" :size="19" />{{
          checking
            ? $t('updates.checking')
            : status === 'error'
              ? $t('updates.tryAgain')
              : $t('updates.check')
        }}
      </button>
      <div v-if="hasRelease && releaseUrl" class="updates-links">
        <button class="text-button" :disabled="opening" @click="openDownload(openRelease)">
          {{ $t('updates.releaseNotes') }}<MaterialIcon name="arrow_outward" :size="16" />
        </button>
        <button v-if="status === 'ready'" class="text-button" @click="checkForUpdates()">
          {{ $t('updates.checkAgain') }}
        </button>
      </div>
      <p v-if="openError" class="field-error" role="alert">{{ openError }}</p>
    </div>

    <details
      v-if="hasRelease && (status === 'ready' ? otherAssets.length : apkAssets.length)"
      class="updates-builds"
    >
      <summary>
        {{ status === 'ready' ? $t('updates.otherOptions') : $t('updates.downloadRelease') }}
      </summary>
      <p>{{ $t('updates.browserNote') }}</p>
      <button
        v-for="asset in status === 'ready' ? otherAssets : apkAssets"
        :key="asset.id"
        class="updates-build"
        :disabled="opening"
        @click="openDownload(() => openAsset(asset))"
      >
        <span
          ><strong>{{ formatAssetLabel(asset) }}</strong
          ><small>{{ assetDescription(asset.name) }}</small
          ><small v-if="assetSize(asset.size)">{{ assetSize(asset.size) }}</small></span
        >
        <MaterialIcon name="download" :size="20" />
      </button>
    </details>

    <footer class="updates-footer">
      <ToggleRow
        v-model="settings.updates.autoUpdate"
        :label="$t('updates.auto')"
        :supporting-text="$t('updates.autoHint')"
      />
      <p class="updates-checked">
        <MaterialIcon name="schedule" :size="14" /><span>{{
          lastCheckedAt ? $t('updates.lastSuccess', { when: checked }) : checked
        }}</span>
      </p>
    </footer>
  </section>
</template>

<style scoped>
.updates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.updates-header h3 {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-app-muted));
}
.updates-source {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.6875rem;
  background: rgb(var(--color-app-elevated));
  color: rgb(var(--color-app-muted));
}
.updates-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 0;
}
.updates-status-icon {
  display: grid;
  place-items: center;
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 20px;
  color: rgb(var(--color-app-green-ink));
  background: rgb(var(--color-app-green-dim));
}
.updates-status > div {
  min-width: 0;
}
.updates-status h4 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
.updates-status p {
  margin-top: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgb(var(--color-app-muted));
  overflow-wrap: anywhere;
}
[data-status='error'] .updates-status-icon {
  background: rgb(var(--color-app-yellow) / 0.14);
  color: rgb(var(--color-app-yellow));
}
.updates-installed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid rgb(var(--color-app-line) / 0.7);
  font-size: 0.875rem;
}
.updates-installed > span {
  color: rgb(var(--color-app-muted));
}
.updates-installed strong {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}
.updates-actions {
  padding: 4px 0;
}
.updates-actions > button {
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 18px;
  font-size: 1rem;
  font-weight: 650;
}
.updates-check {
  background: rgb(var(--color-app-elevated));
}
.updates-download-caption {
  font-size: 0.75rem;
  text-align: center;
  color: rgb(var(--color-app-muted));
  margin-top: 10px;
}
.updates-links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
.updates-links .text-button {
  font-size: 0.8125rem;
  font-weight: 550;
}
.updates-builds {
  margin: 8px 0 0;
}
.updates-builds > summary {
  font-size: 0.8125rem;
  font-weight: 600;
}
.updates-builds > p {
  color: rgb(var(--color-app-muted));
  font-size: 0.75rem;
  line-height: 1.6;
  margin-bottom: 12px;
}
.updates-build {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 14px;
  background: rgb(var(--color-app-elevated));
}
.updates-build > span:first-child {
  flex: 1;
  min-width: 0;
}
.updates-build strong {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.updates-build small {
  display: block;
  font-size: 0.75rem;
  color: rgb(var(--color-app-muted));
  margin-top: 3px;
}
.updates-build > .material-symbols-rounded {
  color: rgb(var(--color-app-green-ink));
  flex-shrink: 0;
}
.updates-footer {
  margin-top: 12px;
  padding-top: 4px;
  border-top: 1px solid rgb(var(--color-app-line) / 0.7);
}
.updates-checked {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--color-app-muted));
  font-size: 0.75rem;
  padding-top: 2px;
}
.updates-checked > span {
  min-width: 0;
}
@media (max-width: 359px) {
  .updates-status {
    gap: 12px;
  }
  .updates-status h4 {
    font-size: 1.125rem;
  }
  .updates-status-icon {
    width: 46px;
    height: 46px;
    flex-basis: 46px;
    border-radius: 16px;
  }
}
</style>
