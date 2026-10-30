<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import ToggleRow from './ToggleRow.vue';
import { useSettingsStore } from '../stores/settings';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import { useGitHubReleaseUpdater } from '../composables/useGitHubReleaseUpdater';

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
      idle: 'Keep your miner current',
      checking: 'Checking for updates',
      ready: 'A release is available',
      'up-to-date': 'You’re up to date',
      error: 'Couldn’t check for updates'
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
      idle: 'Check for the latest version of AndroMiner.',
      checking: 'Looking for the latest release on GitHub…',
      ready: `Version ${availableVersion.value.replace(/^v/i, '')}${releaseDate.value ? ' · ' + releaseDate.value : ''}`,
      'up-to-date': 'Your installed version is current with the latest release.',
      error: message.value
    })[status.value]
);
const releaseDate = computed(() => {
  const date = new Date(releasedAt.value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
});
const checked = computed(() =>
  lastCheckedAt.value
    ? new Date(lastCheckedAt.value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Not checked yet'
);
const assetSize = (bytes: number) =>
  Number.isFinite(bytes) && bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
const assetDescription = (name: string) =>
  name.toLowerCase().includes('-notls-')
    ? 'Miner included · plain TCP pools'
    : name.toLowerCase().includes('-tls-')
      ? 'Miner included · encrypted pools supported'
      : name.toLowerCase().includes('-download-')
        ? 'Download the mining engine on first use'
        : 'Android installation package';
const openDownload = async (action: () => Promise<void>) => {
  if (opening.value) return;
  openError.value = '';
  opening.value = true;
  try {
    await action();
  } catch {
    openError.value = 'Could not open the download page. Please try again.';
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
      <h3 id="updates-title">App updates</h3>
      <span class="updates-source"><MaterialIcon name="code" :size="15" />GitHub releases</span>
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
      <span>Installed version</span><strong>{{ currentVersionDisplay }}</strong>
    </div>

    <div class="updates-actions">
      <template v-if="status === 'ready' && preferredAsset">
        <button
          class="primary-button"
          :disabled="opening"
          @click="openDownload(() => openAsset(preferredAsset!))"
        >
          <MaterialIcon name="download" :size="20" />Download APK<MaterialIcon
            name="open_in_new"
            :size="16"
          />
        </button>
        <p class="updates-download-caption">
          {{ formatAssetLabel(preferredAsset)
          }}<span v-if="assetSize(preferredAsset.size)">
            · {{ assetSize(preferredAsset.size) }}</span
          >
        </p>
        <p class="updates-download-caption">Opens in your browser · install manually</p>
      </template>
      <button
        v-else
        class="outline-button updates-check"
        :disabled="checking"
        :aria-busy="checking"
        @click="checkForUpdates()"
      >
        <MaterialIcon :name="status === 'error' ? 'refresh' : 'sync'" :size="19" />{{
          checking ? 'Checking…' : status === 'error' ? 'Try again' : 'Check for updates'
        }}
      </button>
      <div v-if="hasRelease && releaseUrl" class="updates-links">
        <button class="text-button" :disabled="opening" @click="openDownload(openRelease)">
          Release notes<MaterialIcon name="arrow_outward" :size="16" />
        </button>
        <button v-if="status === 'ready'" class="text-button" @click="checkForUpdates()">
          Check again
        </button>
      </div>
      <p v-if="openError" class="field-error" role="alert">{{ openError }}</p>
    </div>

    <details
      v-if="hasRelease && (status === 'ready' ? otherAssets.length : apkAssets.length)"
      class="updates-builds"
    >
      <summary>
        {{ status === 'ready' ? 'Other download options' : 'Download this release' }}
      </summary>
      <p>APK downloads open in your browser. Install the file manually to finish.</p>
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
        label="Check automatically"
        supporting-text="On launch and when you return to the app"
      />
      <p class="updates-checked">
        <MaterialIcon name="schedule" :size="14" /><span
          >{{ lastCheckedAt ? 'Last successful check · ' : '' }}{{ checked }}</span
        >
      </p>
    </footer>
  </section>
</template>

<style scoped>
.updates-card {
  padding: 0;
  overflow: hidden;
}
.updates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 0;
}
.updates-header h3 {
  font-size: 14px;
  font-weight: 650;
}
.updates-source {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgb(var(--color-app-muted));
}
.updates-status {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 26px 18px 22px;
}
.updates-status-icon {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: rgb(var(--color-app-green));
  background: rgb(var(--color-app-green-dim));
}
.updates-status > div {
  min-width: 0;
}
.updates-status h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.025em;
}
.updates-status p {
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(var(--color-app-muted));
  overflow-wrap: anywhere;
}
[data-status='error'] .updates-status-icon {
  background: rgb(var(--color-app-yellow) / 0.12);
  color: rgb(var(--color-app-yellow));
}
.updates-installed {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 18px;
  padding: 13px 0;
  border-block: 1px solid rgb(var(--color-app-line));
  font-size: 11px;
}
.updates-installed > span {
  color: rgb(var(--color-app-muted));
}
.updates-installed strong {
  font-weight: 550;
  text-align: right;
  overflow-wrap: anywhere;
}
.updates-actions {
  padding: 18px;
}
.updates-actions > button {
  width: 100%;
}
.updates-check {
  background: rgb(var(--color-app-elevated) / 0.55);
}
.updates-download-caption {
  font-size: 11px;
  text-align: center;
  color: rgb(var(--color-app-muted));
  margin-top: 9px;
}
.updates-links {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
.updates-links .text-button {
  font-size: 12px;
  font-weight: 500;
}
.updates-builds {
  border-top: 1px solid rgb(var(--color-app-line));
  margin: 0 18px;
}
.updates-builds > summary {
  font-size: 12px;
  font-weight: 550;
}
.updates-builds > p {
  color: rgb(var(--color-app-muted));
  font-size: 11px;
  line-height: 1.6;
  margin-bottom: 12px;
}
.updates-build {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 12px 0;
  border-top: 1px solid rgb(var(--color-app-line) / 0.6);
}
.updates-build > span:first-child {
  flex: 1;
  min-width: 0;
}
.updates-build strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.updates-build small {
  display: block;
  font-size: 11px;
  color: rgb(var(--color-app-muted));
  margin-top: 4px;
}
.updates-build > .material-symbols-rounded {
  color: rgb(var(--color-app-green));
  flex-shrink: 0;
}
.updates-footer {
  padding: 0 18px 16px;
  border-top: 1px solid rgb(var(--color-app-line));
  background: rgb(var(--color-app-elevated) / 0.25);
}
.updates-checked {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--color-app-muted));
  font-size: 10px;
  padding-top: 2px;
}
.updates-checked > span {
  min-width: 0;
}
@media (max-width: 359px) {
  .updates-header {
    align-items: flex-start;
  }
  .updates-source {
    font-size: 9px;
  }
  .updates-status {
    gap: 10px;
  }
  .updates-status h4 {
    font-size: 17px;
  }
  .updates-status-icon {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 12px;
  }
}
</style>
