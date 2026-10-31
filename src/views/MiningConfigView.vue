<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import PoolConnectionTest from '../components/PoolConnectionTest.vue';
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
import { t } from '../i18n';
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
const errorText = (key: string): string => (key ? t(key) : '');
const savedProfiles = useProfilesStore();
const settings = useSettingsStore();
let saveFeedbackTimer = 0;

const setupSections: Array<{ id: SetupSection; label: string; icon: string }> = [
  { id: 'setup', label: 'config.sec.setup', icon: 'folder_managed' },
  { id: 'pool', label: 'config.sec.pool', icon: 'hub' },
  { id: 'performance', label: 'config.sec.performance', icon: 'memory' },
  { id: 'safety', label: 'config.sec.safety', icon: 'health_and_safety' }
];

const formatThreadCount = (threads: number): string => t('unit.threads', { n: threads }, threads);

const profileCoreShortLabel = (affinity: CpuAffinity): string => {
  const keys: Record<CpuAffinity, string> = {
    auto: 'affinity.shortAuto',
    little: 'affinity.shortLittle',
    big: 'affinity.shortBig',
    custom: 'affinity.shortCustom'
  };

  return t(keys[affinity]);
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
      label: t(`profile.${preset.id}`),
      supportingText: t(`profile.short.${preset.id}`),
      icon: profileIcons[preset.id],
      threadLabel: formatThreadCount(threadCount),
      coreLabel: profileCoreShortLabel(affinity)
    };
  })
);

const priorityValues: CpuPriority[] = ['low', 'normal', 'high'];
const affinityValues: CpuAffinity[] = ['auto', 'little', 'big', 'custom'];
const priorityHints: Record<CpuPriority, string> = {
  low: 'priority.hintLow',
  normal: 'priority.hintNormal',
  high: 'priority.hintHigh'
};
const affinityHints: Record<CpuAffinity, string> = {
  auto: 'affinity.hintAuto',
  little: 'affinity.hintLittle',
  big: 'affinity.hintBig',
  custom: 'affinity.hintCustom'
};

// Protocol names are wire-format identifiers and stay untranslated; only their descriptions are localized.
const protocolOptions: Array<{ value: MiningProtocol; label: string }> = [
  { value: 'stratum', label: 'Stratum' },
  { value: 'stratum+tcp', label: 'Stratum TCP' },
  { value: 'stratum+ssl', label: 'Stratum SSL' },
  { value: 'stratum+tls', label: 'Stratum TLS' },
  { value: 'daemon', label: 'Daemon RPC' },
  { value: 'daemon+ssl', label: 'Daemon RPC SSL' },
  { value: 'self-select', label: 'Self-select' },
  { value: 'xmrig-proxy', label: 'XMRig proxy' },
  { value: 'ssl', label: 'SSL' },
  { value: 'tls', label: 'TLS' },
  { value: 'tcp', label: 'TCP' },
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'solo', label: 'Solo' },
  { value: 'nicehash', label: 'NiceHash' }
];

const coinOptions = computed<ConfigSelectOption[]>(() =>
  cryptocurrencies.map((coin) => ({
    value: coin.id,
    label: `${coin.name} / ${coin.symbol}`,
    supportingText:
      coin.supportStatus === 'bundled'
        ? `${coin.algorithm} / ${coin.xmrigAlgo}`
        : `${coin.algorithm} · ${coin.supportNote || t('config.customMiner')}`,
    coinSymbol: coin.symbol,
    coinName: coin.name,
    disabled: coin.supportStatus !== 'bundled'
  }))
);

const prioritySelectOptions = computed<ConfigSelectOption[]>(() =>
  priorityValues.map((value) => ({
    value,
    label: t(`priority.${value}`),
    supportingText: t(priorityHints[value])
  }))
);
const affinitySelectOptions = computed<ConfigSelectOption[]>(() =>
  affinityValues.map((value) => ({
    value,
    label: t(`affinity.${value}`),
    supportingText: t(affinityHints[value])
  }))
);
const donateOverProxySelectOptions = computed<ConfigSelectOption[]>(() => [
  { value: '0', label: t('donate.off'), supportingText: t('donate.hintOff') },
  { value: '1', label: t('donate.auto'), supportingText: t('donate.hintAuto') },
  { value: '2', label: t('donate.always'), supportingText: t('donate.hintAlways') }
]);
const protocolSelectOptions = computed<ConfigSelectOption[]>(() =>
  protocolOptions.map((option) => ({
    value: option.value,
    label: option.label,
    supportingText: t(`protocol.${option.value}`)
  }))
);
const activeSavedProfile = computed(() => savedProfiles.activeProfile);
const cpuHardwareName = computed(
  () => props.device.cpuName || props.device.model || t('device.androidCpu')
);
const cpuClockLabel = computed(() => props.device.cpuClockLabel || '-');
const detectedThreadCount = computed(() =>
  Math.max(
    1,
    props.config.totalDetectedThreads || props.device.cpuThreads || props.config.threadCount
  )
);
const selectedProfileLabel = computed(() => t(`profile.${props.config.profile}`));
const engineDescription = computed(
  () =>
    `${cpuHardwareName.value} · ${cpuClockLabel.value} · ${formatThreadCount(props.config.threadCount)}`
);

const backendStatus = computed(() => {
  const labels: Record<MinerBackendState, { label: string; icon: string; tone: string }> = {
    checking: { label: t('config.checking'), icon: 'sync', tone: 'text-app-muted' },
    ready: { label: t('config.minerReady'), icon: 'check_circle', tone: 'text-app-green' },
    missing: { label: t('backend.missing'), icon: 'download', tone: 'text-app-yellow' },
    downloading: { label: t('backend.downloading'), icon: 'downloading', tone: 'text-app-yellow' },
    'web-unavailable': {
      label: t('backend.webUnavailable'),
      icon: 'phone_android',
      tone: 'text-app-yellow'
    },
    error: { label: t('config.backendError'), icon: 'error', tone: 'text-red-300' }
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
    ? t('config.saveDownload')
    : props.backendState === 'error'
      ? t('config.saveAgain')
      : t('config.saveStart')
);

const saveButtonLabel = computed(() =>
  savedProfiles.storageError
    ? t('config.retrySave')
    : saveFeedbackVisible.value
      ? t('config.saved')
      : t('config.saveChanges')
);
const hasTasksetMaskError = computed(() => /taskset|tasket|bad mask/i.test(props.backendMessage));
const setupNoticeTitle = computed(() => {
  if (props.backendState === 'error' && hasTasksetMaskError.value) {
    return t('config.affinityFailed');
  }

  if (props.backendState === 'error') {
    return t('config.needsAttention');
  }

  return backendStatus.value.label;
});
const setupNoticeText = computed(() => {
  if (props.backendState === 'error' && hasTasksetMaskError.value) {
    return t('config.affinityHint', { message: props.backendMessage });
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
    t('config.profileDefault', { n: savedProfiles.profiles.length + 1 }),
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
    t('config.deleteConfirm', { name: activeSavedProfile.value.name })
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
      <h1>{{ $t('config.title') }}</h1>
      <p>{{ $t('config.subtitle') }}</p>
    </header>
    <div v-if="backendState !== 'ready'" class="notice">
      <MaterialIcon :name="backendStatus.icon" :size="20" />
      <div>
        <strong>{{ setupNoticeTitle }}</strong>
        <p>{{ setupNoticeText }}</p>
      </div>
    </div>
    <div class="setup-tabs" role="group" :aria-label="$t('config.sections')">
      <button
        v-for="section in setupSections"
        :key="section.id"
        :aria-pressed="setupSection === section.id"
        @click="setupSection = section.id"
      >
        {{ $t(section.label) }}
      </button>
    </div>
    <div v-if="locked" class="notice">
      <p>{{ $t('config.locked') }}</p>
    </div>
    <fieldset :disabled="locked" class="config-fields">
      <section
        v-if="setupSection === 'setup'"
        class="config-section-grid grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch"
      >
        <section class="surface setup-identity-fields">
          <div>
            <h3 class="section-title">{{ $t('config.currency') }}</h3>
            <ConfigSelect
              :model-value="config.coin.id"
              :label="$t('config.coin')"
              :options="coinOptions"
              :supporting-text="$t('config.algorithmLine', { algorithm: config.algorithm })"
              @update:model-value="handleCoinChange"
            />
          </div>
          <div>
            <h3 class="section-title">{{ $t('config.walletWorker') }}</h3>
            <ConfigInput
              v-model="config.walletAddress"
              :error="validationVisible ? errorText(errors.wallet) : ''"
              :label="$t('config.walletLabel', { symbol: config.coin.symbol })"
              :supporting-text="$t('config.walletHint')"
            /><ConfigInput v-model="config.workerName" :label="$t('config.workerName')" />
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
            <h2 class="text-[0.9375rem] font-semibold leading-5 text-app-on">
              {{ $t('config.poolConnection') }}
            </h2>
            <p class="mt-0.5 text-[0.75rem] leading-4 text-app-muted">{{ config.protocol }}</p>
          </div>
        </div>
        <div class="pool-field-grid grid min-w-0 gap-4 md:grid-cols-2 border-t border-app-line p-4">
          <div class="grid grid-cols-[1fr_96px] gap-2">
            <ConfigInput
              v-model="config.poolUrl"
              :label="$t('config.poolUrl')"
              inputmode="url"
              :error="validationVisible ? errorText(errors.pool) : ''"
            />
            <ConfigInput
              v-model="config.poolPort"
              :label="$t('config.port')"
              type="number"
              inputmode="numeric"
              :error="validationVisible ? errorText(errors.port) : ''"
            />
          </div>
          <ConfigInput
            v-model="config.password"
            :label="$t('config.password')"
            type="password"
            :supporting-text="$t('config.passwordHint')"
            revealable
          />
          <ConfigSelect
            :model-value="config.protocol"
            :label="$t('config.protocol')"
            :options="protocolSelectOptions"
            @update:model-value="handleProtocolChange"
          />
          <PoolConnectionTest :config="config" />
        </div>
      </section>

      <section
        v-else-if="setupSection === 'performance'"
        class="config-section-grid performance-grid grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch"
      >
        <section class="surface">
          <div class="section-heading">
            <h3>{{ $t('config.cpuAllocation') }}</h3>
            <span class="supporting-label">{{
              $t('config.threadsBadge', { count: config.threadCount, total: detectedThreadCount })
            }}</span>
          </div>
          <p class="section-copy">
            {{ $t('config.cpuCopy', { engine: engineDescription }) }}
          </p>
          <div class="thread-stepper">
            <button
              class="outline-button"
              :aria-label="$t('config.decreaseThreads')"
              :disabled="config.threadCount <= 1"
              @click="adjustThreads(-1)"
            >
              <MaterialIcon name="remove" :size="20" />
            </button>
            <div>
              <strong>{{ config.threadCount }}</strong
              ><small>{{ $t('config.workerThreads') }}</small>
            </div>
            <button
              class="outline-button"
              :aria-label="$t('config.increaseThreads')"
              :disabled="config.threadCount >= detectedThreadCount"
              @click="adjustThreads(1)"
            >
              <MaterialIcon name="add" :size="20" />
            </button>
          </div>
          <div class="section-heading">
            <h3>{{ $t('config.powerProfile') }}</h3>
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
          <h3 class="section-title">{{ $t('config.scheduling') }}</h3>
          <ConfigSelect
            :model-value="config.priority"
            :label="$t('config.priority')"
            :options="prioritySelectOptions"
            @update:model-value="handlePriorityChange"
          /><ConfigSelect
            :model-value="config.affinity"
            :label="$t('config.coreSelection')"
            :options="affinitySelectOptions"
            @update:model-value="handleAffinityChange"
          /><ToggleRow
            v-model="config.backgroundMining"
            :label="$t('config.background')"
            :supporting-text="$t('config.backgroundHint')"
          /><ToggleRow
            v-model="settings.performance.liteSessionMode"
            :label="$t('settings.lite')"
            :supporting-text="$t('config.liteHint')"
          />
        </section>
        <details class="surface">
          <summary>{{ $t('config.donation') }}</summary>
          <p class="section-copy">{{ $t('config.donationCopy') }}</p>
          <ConfigInput
            v-model="config.donateLevel"
            :label="$t('config.donationLevel')"
            type="number"
            inputmode="numeric"
            suffix="%"
          /><ConfigSelect
            :model-value="String(config.donateOverProxy)"
            :label="$t('config.donateOverProxy')"
            :options="donateOverProxySelectOptions"
            @update:model-value="handleDonateOverProxyChange"
          />
        </details>
      </section>

      <section v-else class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="health_and_safety" :size="21" />
          <div class="min-w-0">
            <h2 class="text-[0.9375rem] font-semibold leading-5 text-app-on">
              {{ $t('config.protection') }}
            </h2>
            <p class="mt-0.5 text-[0.75rem] leading-4 text-app-muted">
              {{ $t('config.protectionSub') }}
            </p>
          </div>
        </div>
        <div class="space-y-3 border-t border-app-line p-4">
          <p class="section-copy">{{ $t('config.protectionCopy') }}</p>
          <p class="section-copy">{{ $t('config.limitsInSettings') }}</p>
          <ConfigInput
            v-model.number="config.maxDurationMinutes"
            :label="$t('config.maxDuration')"
            type="number"
            :min="0"
            :max="1440"
            :error="errorText(errors.duration)"
            inputmode="numeric"
          />
          <p class="section-copy">{{ $t('config.durationCopy') }}</p>
          <ToggleRow
            v-model="config.autoPauseScreenOff"
            :label="$t('config.pauseHidden')"
            :supporting-text="$t('config.pauseHiddenHint')"
          />
          <ToggleRow
            v-model="config.autoPauseOnBattery"
            :label="$t('config.requirePower')"
            :supporting-text="$t('config.requirePowerHint')"
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
