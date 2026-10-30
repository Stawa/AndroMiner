<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import ConfigSelect from '../components/ConfigSelect.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import SavedSetupPicker from '../components/SavedSetupPicker.vue';
import ProfileChip from '../components/ProfileChip.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { profilePresets, type MinerBackendState } from '../composables/useMiningController';
import { cryptocurrencies } from '../data/miningCatalog';
import { validateMiningSetup } from '../utils/configValidation';
import { useProfilesStore } from '../stores/profiles';
import { useSettingsStore } from '../stores/settings';
import type {
  CpuAffinity,
  CpuPriority,
  DeviceTelemetry,
  MiningConfig,
  MiningProfile,
  MiningProtocol,
  SavedMiningProfile
} from '../types/mining';

interface MiningConfigViewProps {
  config: MiningConfig;
  locked?: boolean;
  device: DeviceTelemetry;
  backendState: MinerBackendState;
  backendMessage: string;
}

interface ConfigSelectOption {
  value: string;
  label: string;
  supportingText?: string;
  iconText?: string;
  iconClass?: string;
  coinSymbol?: string;
  coinName?: string;
  disabled?: boolean;
}

type SetupSection = 'setup' | 'pool' | 'performance' | 'safety';

const props = defineProps<MiningConfigViewProps>();

const emit = defineEmits<{
  profile: [value: MiningProfile];
  coin: [value: string];
  applyProfile: [profile: SavedMiningProfile];
  start: [];
}>();

const profileNameDraft = ref('');
const setupSection = ref<SetupSection>('setup');
const saveFeedbackVisible = ref(false);
const validationVisible = ref(false);
const errors = computed(() => validateMiningSetup(props.config));
const savedProfiles = useProfilesStore();
const settings = useSettingsStore();
let saveFeedbackTimer = 0;

const setupSections: Array<{ id: SetupSection; label: string; icon: string }> = [
  { id: 'setup', label: 'Setup', icon: 'folder_managed' },
  { id: 'pool', label: 'Pool', icon: 'hub' },
  { id: 'performance', label: 'Engine', icon: 'memory' },
  { id: 'safety', label: 'Safety', icon: 'health_and_safety' }
];

const formatThreadCount = (threads: number): string =>
  `${threads} ${threads === 1 ? 'thread' : 'threads'}`;

const profileCoreShortLabel = (affinity: CpuAffinity): string => {
  const labels: Record<CpuAffinity, string> = {
    auto: 'All cores',
    little: 'Eco cores',
    big: 'Fast cores',
    custom: 'Manual cores'
  };

  return labels[affinity];
};

const profileDescriptions: Record<MiningProfile, string> = {
  battery_saver: 'Cooler phone, slower hashrate',
  balanced: 'A moderate starting point',
  performance: 'Faster mining, more heat',
  custom: 'Manual thread tuning'
};

const profileIcons: Record<MiningProfile, string> = {
  battery_saver: 'battery_saver',
  balanced: 'balance',
  performance: 'speed',
  custom: 'tune'
};

const profiles = computed(() =>
  profilePresets.map((preset) => {
    const threadCount = preset.id === 'custom' ? props.config.customThreadCount : preset.threads;
    const affinity = preset.id === 'custom' ? props.config.affinity : preset.affinity;

    return {
      id: preset.id,
      label: preset.label,
      supportingText: profileDescriptions[preset.id],
      icon: profileIcons[preset.id],
      threadLabel: formatThreadCount(threadCount),
      coreLabel: profileCoreShortLabel(affinity)
    };
  })
);

const priorityOptions: Array<{ value: CpuPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' }
];

const affinityOptions: Array<{ value: CpuAffinity; label: string }> = [
  { value: 'auto', label: 'All cores' },
  { value: 'little', label: 'Efficiency cores' },
  { value: 'big', label: 'Performance cores' },
  { value: 'custom', label: 'Custom affinity' }
];

const protocolOptions: Array<{ value: MiningProtocol; label: string; supportingText: string }> = [
  { value: 'stratum', label: 'Stratum', supportingText: 'Standard pool connection' },
  { value: 'stratum+tcp', label: 'Stratum TCP', supportingText: 'Plain TCP transport' },
  { value: 'stratum+ssl', label: 'Stratum SSL', supportingText: 'Encrypted SSL transport' },
  { value: 'stratum+tls', label: 'Stratum TLS', supportingText: 'Encrypted TLS transport' },
  { value: 'daemon', label: 'Daemon RPC', supportingText: 'Direct daemon mining endpoint' },
  { value: 'daemon+ssl', label: 'Daemon RPC SSL', supportingText: 'Encrypted daemon RPC' },
  { value: 'self-select', label: 'Self-select', supportingText: 'Miner selects block template' },
  { value: 'xmrig-proxy', label: 'XMRig proxy', supportingText: 'Proxy-based mining endpoint' },
  { value: 'ssl', label: 'SSL', supportingText: 'Generic SSL endpoint' },
  { value: 'tls', label: 'TLS', supportingText: 'Generic TLS endpoint' },
  { value: 'tcp', label: 'TCP', supportingText: 'Generic TCP endpoint' },
  { value: 'http', label: 'HTTP', supportingText: 'HTTP endpoint' },
  { value: 'https', label: 'HTTPS', supportingText: 'HTTPS endpoint' },
  { value: 'solo', label: 'Solo', supportingText: 'Solo mining endpoint' },
  { value: 'nicehash', label: 'NiceHash', supportingText: 'NiceHash compatible mode' }
];

const coinOptions = computed<ConfigSelectOption[]>(() =>
  cryptocurrencies.map((coin) => ({
    value: coin.id,
    label: `${coin.name} / ${coin.symbol}`,
    supportingText:
      coin.supportStatus === 'bundled'
        ? `${coin.algorithm} / ${coin.xmrigAlgo}`
        : `${coin.algorithm} · ${coin.supportNote || 'Custom miner required'}`,
    coinSymbol: coin.symbol,
    coinName: coin.name,
    disabled: coin.supportStatus !== 'bundled'
  }))
);

const prioritySelectOptions: ConfigSelectOption[] = priorityOptions.map((option) => ({
  value: option.value,
  label: option.label,
  supportingText:
    option.value === 'low'
      ? 'Lower heat and battery use'
      : option.value === 'high'
        ? 'Higher CPU scheduling priority'
        : 'Recommended default'
}));

const affinitySelectOptions: ConfigSelectOption[] = affinityOptions.map((option) => ({
  value: option.value,
  label: option.label,
  supportingText:
    option.value === 'little'
      ? 'Best for Battery Saver. Uses lower-power cores when Android exposes them; cooler but usually lower H/s.'
      : option.value === 'big'
        ? 'Best for speed tests. Uses the fastest cores when available; expect more heat and battery drain.'
        : option.value === 'custom'
          ? 'Advanced/manual option for exact core masks. Until masks are exposed here, Android scheduling is used.'
          : 'Default for beginners and a clean baseline for advanced tuning. Android can move workers across all cores.'
}));

const donateOverProxySelectOptions: ConfigSelectOption[] = [
  { value: '0', label: 'Off', supportingText: 'Do not donate over proxy' },
  { value: '1', label: 'Auto', supportingText: 'Use XMRig default proxy donation mode' },
  { value: '2', label: 'Always', supportingText: 'Always donate over proxy when applicable' }
];

const protocolSelectOptions: ConfigSelectOption[] = protocolOptions.map((option) => ({
  value: option.value,
  label: option.label,
  supportingText: option.supportingText
}));

const activeSavedProfile = computed(() => savedProfiles.activeProfile);
const cpuHardwareName = computed(() => props.device.cpuName || props.device.model || 'Android CPU');
const cpuClockLabel = computed(() => props.device.cpuClockLabel || '-');
const activeThreadLabel = computed(
  () => `${props.config.threadCount}/${props.config.totalDetectedThreads}`
);
const detectedThreadCount = computed(() =>
  Math.max(
    1,
    props.config.totalDetectedThreads || props.device.cpuThreads || props.config.threadCount
  )
);
const selectedProfileLabel = computed(
  () => profilePresets.find((preset) => preset.id === props.config.profile)?.label || 'Custom'
);
const engineDescription = computed(
  () => `${cpuHardwareName.value} · ${cpuClockLabel.value} · ${activeThreadLabel.value} threads`
);

const backendStatus = computed(() => {
  const labels: Record<MinerBackendState, { label: string; icon: string; tone: string }> = {
    checking: { label: 'Checking backend', icon: 'sync', tone: 'text-app-muted' },
    ready: { label: 'Miner ready', icon: 'check_circle', tone: 'text-app-green' },
    missing: { label: 'Miner download required', icon: 'download', tone: 'text-app-yellow' },
    downloading: { label: 'Downloading miner', icon: 'downloading', tone: 'text-app-yellow' },
    'web-unavailable': {
      label: 'Android app required',
      icon: 'phone_android',
      tone: 'text-app-yellow'
    },
    error: { label: 'Backend error', icon: 'error', tone: 'text-red-300' }
  };

  return labels[props.backendState];
});

const canStartMining = computed(
  () =>
    props.backendState === 'ready' ||
    props.backendState === 'missing' ||
    props.backendState === 'error'
);

const startButtonLabel = computed(() =>
  props.backendState === 'missing'
    ? 'Save & Download'
    : props.backendState === 'error'
      ? 'Save & Start Again'
      : 'Save & Start Mining'
);

const saveButtonLabel = computed(() =>
  savedProfiles.storageError ? 'Retry save' : saveFeedbackVisible.value ? 'Saved' : 'Save changes'
);
const hasTasksetMaskError = computed(() => /taskset|tasket|bad mask/i.test(props.backendMessage));
const setupNoticeTitle = computed(() => {
  if (props.backendState === 'error' && hasTasksetMaskError.value) {
    return 'CPU affinity failed';
  }

  if (props.backendState === 'error') {
    return 'Miner needs attention';
  }

  return backendStatus.value.label;
});
const setupNoticeText = computed(() => {
  if (props.backendState === 'error' && hasTasksetMaskError.value) {
    return `${props.backendMessage}\n\nChoose All cores and retry. This device may not allow CPU core pinning.`;
  }

  return props.backendMessage;
});

const showSaveFeedback = (): void => {
  saveFeedbackVisible.value = true;
  window.clearTimeout(saveFeedbackTimer);
  saveFeedbackTimer = window.setTimeout(() => {
    saveFeedbackVisible.value = false;
  }, 1600);
};

const addSavedProfile = (): void => {
  const profile = savedProfiles.saveFromConfig(
    `Profile ${savedProfiles.profiles.length + 1}`,
    props.config
  );
  emit('applyProfile', profile);
};

const applySavedProfile = (profile: SavedMiningProfile): void => {
  savedProfiles.setActive(profile.id);
  emit('applyProfile', profile);
};

const saveCurrentSetup = (): void => {
  savedProfiles.saveActiveConfig(props.config);
  showSaveFeedback();
};

const saveAndStartMining = (): void => {
  validationVisible.value = true;
  if (Object.values(errors.value).some(Boolean)) {
    setupSection.value = errors.value.wallet ? 'setup' : 'pool';
    return;
  }
  saveCurrentSetup();
  emit('start');
};

const renameActiveProfile = (): void => {
  if (!activeSavedProfile.value) {
    return;
  }

  savedProfiles.renameProfile(activeSavedProfile.value.id, profileNameDraft.value);
};

const duplicateActiveProfile = (): void => {
  if (!activeSavedProfile.value) {
    return;
  }

  savedProfiles.duplicateProfile(activeSavedProfile.value.id);

  if (savedProfiles.activeProfile) {
    emit('applyProfile', savedProfiles.activeProfile);
  }
};

const deleteActiveProfile = (): void => {
  if (!activeSavedProfile.value) {
    return;
  }

  const confirmed = window.confirm(
    `Delete "${activeSavedProfile.value.name}"? This saved mining profile cannot be restored.`
  );
  if (!confirmed) {
    return;
  }

  savedProfiles.deleteProfile(activeSavedProfile.value.id);

  if (savedProfiles.activeProfile) {
    emit('applyProfile', savedProfiles.activeProfile);
  }
};

const handleProtocolChange = (value: string): void => {
  props.config.protocol = value as MiningProtocol;
};

const handleCoinChange = (value: string): void => {
  emit('coin', value);
};

const handlePriorityChange = (value: string): void => {
  props.config.priority = value as CpuPriority;
};

const handleAffinityChange = (value: string): void => {
  props.config.affinity = value as CpuAffinity;
};

const handleDonateOverProxyChange = (value: string): void => {
  props.config.donateOverProxy = Number(value);
};

const adjustThreads = (delta: number): void => {
  props.config.threadCount = Math.min(
    props.config.totalDetectedThreads,
    Math.max(1, props.config.threadCount + delta)
  );
  props.config.customThreadCount = props.config.threadCount;
  props.config.profile = 'custom';
};

watch(
  () => props.config.donateLevel,
  (value) => {
    props.config.donateLevel = Math.min(99, Math.max(0, Number(value) || 0));
  }
);

watch(
  () => props.config.donateOverProxy,
  (value) => {
    props.config.donateOverProxy = Math.min(2, Math.max(0, Number(value) || 0));
  }
);

watch(
  () => activeSavedProfile.value?.name,
  (name) => {
    profileNameDraft.value = name || '';
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.clearTimeout(saveFeedbackTimer);
});
</script>

<template>
  <div class="app-page phone-page config-page">
    <header class="screen-heading">
      <h1>Mining setup</h1>
      <p>Wallet, pool connection, CPU settings, and device protection.</p>
    </header>
    <div v-if="backendState !== 'ready'" class="notice">
      <MaterialIcon :name="backendStatus.icon" :size="20" />
      <div>
        <strong>{{ setupNoticeTitle }}</strong>
        <p>{{ setupNoticeText }}</p>
      </div>
    </div>
    <div class="setup-tabs" role="group" aria-label="Setup sections">
      <button
        v-for="section in setupSections"
        :key="section.id"
        :aria-pressed="setupSection === section.id"
        @click="setupSection = section.id"
      >
        {{ section.label }}
      </button>
    </div>
    <div v-if="locked" class="notice">
      <p>A run is active. Stop it from the dashboard before editing this setup.</p>
    </div>
    <fieldset :disabled="locked" class="config-fields">
      <section
        v-if="setupSection === 'setup'"
        class="config-section-grid grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch"
      >
        <section class="surface setup-identity-fields">
          <div>
            <h3 class="section-title">Mining currency</h3>
            <ConfigSelect
              :model-value="config.coin.id"
              label="Coin"
              :options="coinOptions"
              :supporting-text="`Algorithm: ${config.algorithm}`"
              @update:model-value="handleCoinChange"
            />
          </div>
          <div>
            <h3 class="section-title">Your wallet & worker</h3>
            <ConfigInput
              v-model="config.walletAddress"
              :error="validationVisible ? errors.wallet : ''"
              :label="config.coin.symbol + ' wallet address'"
              supporting-text="Use an address for the selected coin; your pool may accept a username."
            /><ConfigInput v-model="config.workerName" label="Worker name" />
          </div>
        </section>
        <SavedSetupPicker
          v-model:name="profileNameDraft"
          :profiles="savedProfiles.profiles"
          :active-id="savedProfiles.activeProfileId"
          @apply="applySavedProfile"
          @create="addSavedProfile"
          @rename="renameActiveProfile"
          @duplicate="duplicateActiveProfile"
          @delete="deleteActiveProfile"
        />
      </section>

      <section v-else-if="setupSection === 'pool'" class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="hub" :size="21" />
          <div class="min-w-0">
            <h2 class="text-[0.9375rem] font-semibold leading-5 text-app-on">Pool connection</h2>
            <p class="mt-0.5 text-[0.75rem] leading-4 text-app-muted">{{ config.protocol }}</p>
          </div>
        </div>
        <div class="pool-field-grid grid min-w-0 gap-4 md:grid-cols-2 border-t border-app-line p-4">
          <div class="grid grid-cols-[1fr_96px] gap-2">
            <ConfigInput
              v-model="config.poolUrl"
              label="Pool URL"
              inputmode="url"
              :error="validationVisible ? errors.pool : ''"
            />
            <ConfigInput
              v-model="config.poolPort"
              label="Port"
              type="number"
              inputmode="numeric"
              :error="validationVisible ? errors.port : ''"
            />
          </div>
          <ConfigInput
            v-model="config.password"
            label="Password"
            type="password"
            supporting-text="Leave blank if your pool does not require one"
            revealable
          />
          <ConfigSelect
            :model-value="config.protocol"
            label="Protocol"
            :options="protocolSelectOptions"
            @update:model-value="handleProtocolChange"
          />
        </div>
      </section>

      <section
        v-else-if="setupSection === 'performance'"
        class="config-section-grid performance-grid grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch"
      >
        <section class="surface">
          <div class="section-heading">
            <h3>CPU allocation</h3>
            <span class="supporting-label"
              >{{ config.threadCount }} / {{ detectedThreadCount }} THREADS</span
            >
          </div>
          <p class="section-copy">
            {{ engineDescription }}. A lower thread count leaves more room for Android and usually
            reduces heat.
          </p>
          <div class="thread-stepper">
            <button
              class="outline-button"
              aria-label="Decrease thread count"
              :disabled="config.threadCount <= 1"
              @click="adjustThreads(-1)"
            >
              <MaterialIcon name="remove" :size="20" />
            </button>
            <div>
              <strong>{{ config.threadCount }}</strong
              ><small>worker threads</small>
            </div>
            <button
              class="outline-button"
              aria-label="Increase thread count"
              :disabled="config.threadCount >= detectedThreadCount"
              @click="adjustThreads(1)"
            >
              <MaterialIcon name="add" :size="20" />
            </button>
          </div>
          <div class="section-heading">
            <h3>Power profile</h3>
            <span class="supporting-label">{{ selectedProfileLabel }}</span>
          </div>
          <div class="profile-options">
            <ProfileChip
              v-for="profile in profiles"
              :key="profile.id"
              :value="profile.id"
              :label="profile.label"
              :supporting-text="profile.supportingText"
              :icon="profile.icon"
              :thread-label="profile.threadLabel"
              :core-label="profile.coreLabel"
              :selected="config.profile === profile.id"
              @select="emit('profile', $event)"
            />
          </div>
        </section>
        <section class="surface">
          <h3 class="section-title">CPU scheduling</h3>
          <ConfigSelect
            :model-value="config.priority"
            label="Priority"
            :options="prioritySelectOptions"
            @update:model-value="handlePriorityChange"
          /><ConfigSelect
            :model-value="config.affinity"
            label="Core selection"
            :options="affinitySelectOptions"
            @update:model-value="handleAffinityChange"
          /><ToggleRow
            v-model="config.backgroundMining"
            label="Allow background mining"
            supporting-text="Keep the native protection service and Stop notification active when the app is hidden"
          /><ToggleRow
            v-model="settings.performance.liteSessionMode"
            label="Lite session view"
            supporting-text="Hide secondary panels during a run"
          />
        </section>
        <details class="surface">
          <summary>XMRig donation options</summary>
          <p class="section-copy">
            These values are passed to XMRig; the installed binary controls its donation behavior.
          </p>
          <ConfigInput
            v-model="config.donateLevel"
            label="Donation level"
            type="number"
            inputmode="numeric"
            suffix="%"
          /><ConfigSelect
            :model-value="String(config.donateOverProxy)"
            label="Donate over proxy"
            :options="donateOverProxySelectOptions"
            @update:model-value="handleDonateOverProxyChange"
          />
        </details>
      </section>

      <section v-else class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="health_and_safety" :size="21" />
          <div class="min-w-0">
            <h2 class="text-[0.9375rem] font-semibold leading-5 text-app-on">Device protection</h2>
            <p class="mt-0.5 text-[0.75rem] leading-4 text-app-muted">
              Temperature and pause rules
            </p>
          </div>
        </div>
        <div class="space-y-3 border-t border-app-line p-4">
          <p class="section-copy">
            The selected device sensor controls this limit. A separate battery reading of 45 °C or
            Android severe thermal throttling always stops mining. If temperature or battery
            readings are unavailable, mining cannot start.
          </p>
          <div class="rounded-lg bg-app-elevated p-3">
            <div class="mb-2 flex items-center justify-between gap-3">
              <span class="text-[0.875rem] leading-5 text-app-muted">Temperature limit</span>
              <strong class="text-[0.9375rem] text-app-on">{{ config.thermalThreshold }} °C</strong>
            </div>
            <input
              v-model.number="config.thermalThreshold"
              aria-label="Temperature limit"
              class="android-slider"
              type="range"
              min="20"
              max="85"
              step="1"
            />
            <p class="section-copy">
              Current {{ device.thermalSource === 'battery' ? 'battery' : 'device' }} sensor:
              {{ device.temperatureC === null ? 'Unavailable' : device.temperatureC + ' °C' }}. A
              battery reading is not CPU temperature.
            </p>
            <div class="mt-1 flex justify-between text-caption text-app-muted" aria-hidden="true">
              <span>20 °C</span><span>85 °C</span>
            </div>
          </div>
          <ToggleRow
            v-model="config.autoPauseScreenOff"
            label="Pause when app is hidden"
            supporting-text="Pause on app backgrounding, including screen lock"
          />
          <ToggleRow
            v-model="config.autoPauseOnBattery"
            label="Require external power for this setup"
            supporting-text="Pause when unplugged; the charging-only rule in Settings also applies"
          />
        </div>
      </section>

      <section class="setup-action-bar">
        <div class="grid">
          <button
            class="outline-button"
            type="button"
            :aria-label="saveButtonLabel"
            @click="saveCurrentSetup"
          >
            <MaterialIcon :name="saveFeedbackVisible ? 'check_circle' : 'save'" :size="21" />
            <span role="status">{{ saveButtonLabel }}</span>
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="!canStartMining"
            @click="saveAndStartMining"
          >
            <MaterialIcon name="play_arrow" :size="22" filled />
            <span>{{ startButtonLabel }}</span>
          </button>
        </div>
      </section>
    </fieldset>
  </div>
</template>
