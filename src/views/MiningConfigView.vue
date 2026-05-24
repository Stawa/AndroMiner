<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import ConfigSelect from '../components/ConfigSelect.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import ProfileChip from '../components/ProfileChip.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { profilePresets, type MinerBackendState } from '../composables/useMiningController';
import { cryptocurrencies } from '../data/miningCatalog';
import { useProfilesStore } from '../stores/profiles';
import type {
  CpuAffinity,
  CpuPriority,
  MiningConfig,
  MiningProfile,
  MiningProtocol,
  SavedMiningProfile
} from '../types/mining';

interface MiningConfigViewProps {
  config: MiningConfig;
  backendState: MinerBackendState;
  backendMessage: string;
}

interface ConfigSelectOption {
  value: string;
  label: string;
  supportingText?: string;
  iconText?: string;
  iconClass?: string;
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
const savedProfiles = useProfilesStore();
let saveFeedbackTimer = 0;

const setupSections: Array<{ id: SetupSection; label: string; icon: string }> = [
  { id: 'setup', label: 'Setup', icon: 'folder_managed' },
  { id: 'pool', label: 'Pool', icon: 'hub' },
  { id: 'performance', label: 'CPU', icon: 'memory' },
  { id: 'safety', label: 'Safety', icon: 'health_and_safety' }
];

const profiles = computed(() =>
  profilePresets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    supportingText:
      preset.id === 'custom'
        ? `${props.config.customThreadCount} threads`
        : `${preset.threads} threads`
  }))
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
    iconText: coin.logoText,
    iconClass: coin.logoClass,
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
      ? 'Prefer cooler efficiency cores'
      : option.value === 'big'
        ? 'Prefer performance cores'
        : option.value === 'custom'
          ? 'Reserved for native miner backend'
          : 'Let Android and miner decide'
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

const profileSummary = (profile: SavedMiningProfile): string =>
  `${profile.config.coin.symbol} · ${profile.config.threadCount} threads · ${profile.config.poolUrl}:${profile.config.poolPort}`;

const backendStatus = computed(() => {
  const labels: Record<MinerBackendState, { label: string; icon: string; tone: string }> = {
    checking: { label: 'Checking backend', icon: 'sync', tone: 'text-app-muted' },
    ready: { label: 'Native miner ready', icon: 'check_circle', tone: 'text-app-green' },
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
  () => props.backendState === 'ready' || props.backendState === 'missing'
);

const startButtonLabel = computed(() =>
  props.backendState === 'missing' ? 'Save & Download' : 'Save & Start Mining'
);

const saveButtonLabel = computed(() => (saveFeedbackVisible.value ? 'Saved' : 'Save Changes'));

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
  <div class="phone-page">
    <section class="app-card overflow-hidden">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div
            class="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-[24px] font-bold text-white shadow-sm"
            :class="config.coin.logoClass"
          >
            {{ config.coin.logoText }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Mining setup</p>
            <h2 class="mt-1 truncate text-[22px] font-semibold leading-7 text-white">
              {{ config.coin.symbol }} · {{ config.algorithm }}
            </h2>
            <p class="truncate text-[13px] leading-5 text-app-muted">
              {{ activeSavedProfile?.name || 'Unsaved setup' }}
            </p>
          </div>
          <div
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-elevated"
            :class="backendStatus.tone"
          >
            <MaterialIcon :name="backendStatus.icon" :size="22" />
          </div>
        </div>

        <p
          v-if="backendState !== 'ready'"
          class="mt-4 rounded-lg border border-app-line bg-app-elevated/70 p-3 text-[12px] leading-[18px] text-app-muted"
        >
          {{ backendMessage }}
        </p>

        <div class="mt-4 grid grid-cols-4 gap-1 rounded-full bg-app-elevated p-1">
          <button
            v-for="section in setupSections"
            :key="section.id"
            class="ripple flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium leading-4 transition-colors"
            :class="
              setupSection === section.id
                ? 'bg-app-card text-app-green shadow-[0_1px_2px_rgb(15_23_42/0.08)]'
                : 'text-app-muted'
            "
            type="button"
            @click="setupSection = section.id"
          >
            <MaterialIcon :name="section.icon" :size="18" :filled="setupSection === section.id" />
            <span class="truncate">{{ section.label }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="setupSection === 'setup'" class="space-y-3">
      <section class="app-card p-4">
        <ConfigSelect
          :model-value="config.coin.id"
          label="Coin"
          :options="coinOptions"
          :supporting-text="`Algorithm: ${config.algorithm}`"
          @update:model-value="handleCoinChange"
        />
      </section>

      <section class="app-card overflow-hidden">
        <div class="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="text-[15px] font-semibold leading-5 text-white">Saved setups</p>
            <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
              {{ activeSavedProfile?.name || 'Choose or create a setup' }}
            </p>
          </div>
          <button
            class="ripple grid h-12 w-12 shrink-0 place-items-center rounded-full bg-app-green-dim text-app-green"
            type="button"
            aria-label="Add profile"
            @click="addSavedProfile"
          >
            <MaterialIcon name="add" :size="24" />
          </button>
        </div>

        <div
          v-if="savedProfiles.profiles.length === 0"
          class="border-t border-app-line px-4 py-6 text-[13px] leading-5 text-app-muted"
        >
          No saved setups yet. Create one from your current mining settings.
        </div>

        <div v-else class="divide-y divide-app-line border-t border-app-line">
          <button
            v-for="profile in savedProfiles.profiles"
            :key="profile.id"
            class="ripple flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left active:bg-app-elevated"
            :class="
              profile.id === savedProfiles.activeProfileId
                ? 'bg-app-green-dim/80 text-white'
                : 'bg-transparent text-app-muted'
            "
            type="button"
            @click="applySavedProfile(profile)"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
              :class="profile.config.coin.logoClass"
            >
              {{ profile.config.coin.logoText }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-semibold leading-5 text-white">{{
                profile.name
              }}</span>
              <span class="mt-0.5 block truncate text-[12px] leading-[18px] text-app-muted">{{
                profileSummary(profile)
              }}</span>
            </span>
            <span
              v-if="profile.id === savedProfiles.activeProfileId"
              class="shrink-0 rounded-full bg-app-card px-2 py-1 text-[11px] font-semibold text-app-green"
            >
              Active
            </span>
          </button>
        </div>

        <div
          v-if="activeSavedProfile"
          class="space-y-3 border-t border-app-line bg-app-elevated/35 p-4"
        >
          <ConfigInput
            v-model="profileNameDraft"
            label="Selected setup name"
            supporting-text="Rename this setup. Use the bottom bar to save mining changes."
          />
          <div class="grid grid-cols-[1fr_48px_48px] gap-2">
            <button
              class="ripple flex min-h-12 items-center justify-center gap-2 rounded-lg bg-app-green-dim px-3 text-[13px] font-semibold text-app-green"
              type="button"
              @click="renameActiveProfile"
            >
              <MaterialIcon name="edit" :size="20" />
              Rename
            </button>
            <button
              class="ripple grid min-h-12 place-items-center rounded-lg bg-app-card text-white"
              type="button"
              aria-label="Copy selected setup"
              @click="duplicateActiveProfile"
            >
              <MaterialIcon name="content_copy" :size="20" />
            </button>
            <button
              class="ripple grid min-h-12 place-items-center rounded-lg bg-app-card text-red-300"
              type="button"
              aria-label="Delete selected setup"
              @click="deleteActiveProfile"
            >
              <MaterialIcon name="delete" :size="20" />
            </button>
          </div>
        </div>
      </section>
    </section>

    <section v-else-if="setupSection === 'pool'" class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center gap-3 px-4">
        <MaterialIcon class="text-app-green" name="hub" :size="21" />
        <div class="min-w-0">
          <h2 class="text-[15px] font-semibold leading-5 text-white">Pool and wallet</h2>
          <p class="mt-0.5 text-[12px] leading-4 text-app-muted">{{ config.protocol }}</p>
        </div>
      </div>
      <div class="space-y-3 border-t border-app-line p-4">
        <div class="grid grid-cols-[1fr_96px] gap-2">
          <ConfigInput v-model="config.poolUrl" label="Pool URL" inputmode="url" />
          <ConfigInput v-model="config.poolPort" label="Port" type="number" inputmode="numeric" />
        </div>
        <ConfigInput
          v-model="config.walletAddress"
          :label="`${config.coin.name} / ${config.coin.symbol} wallet`"
          supporting-text="Wallet address or username for this cryptocurrency"
        />
        <ConfigInput v-model="config.workerName" label="Worker name" />
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

    <section v-else-if="setupSection === 'performance'" class="space-y-3">
      <section class="app-card p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[15px] font-semibold leading-5 text-white">Mining intensity</p>
            <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
              {{ config.threadCount }} of {{ config.totalDetectedThreads }} CPU threads
            </p>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-elevated px-3 py-1 text-[12px] font-semibold text-white"
          >
            {{ config.threadCount }}/{{ config.totalDetectedThreads }}
          </span>
        </div>
        <div class="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <ProfileChip
            v-for="profile in profiles"
            :key="profile.id"
            :value="profile.id"
            :label="profile.label"
            :supporting-text="profile.supportingText"
            :selected="config.profile === profile.id"
            @select="emit('profile', $event)"
          />
        </div>
        <div
          class="mt-4 grid grid-cols-[52px_1fr_52px] items-center gap-2 rounded-lg bg-app-elevated p-2"
        >
          <button
            class="ripple grid h-12 w-12 place-items-center rounded-full bg-app-card text-white"
            type="button"
            aria-label="Decrease thread count"
            @click="adjustThreads(-1)"
          >
            <MaterialIcon name="remove" :size="22" />
          </button>
          <p class="min-w-0 text-center text-[13px] leading-5 text-app-muted">
            Threads
            <strong class="block text-[20px] leading-6 text-white">{{ config.threadCount }}</strong>
          </p>
          <button
            class="ripple grid h-12 w-12 place-items-center rounded-full bg-app-card text-white"
            type="button"
            aria-label="Increase thread count"
            @click="adjustThreads(1)"
          >
            <MaterialIcon name="add" :size="22" />
          </button>
        </div>
      </section>

      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="memory" :size="21" />
          <div class="min-w-0">
            <h2 class="text-[15px] font-semibold leading-5 text-white">CPU and miner</h2>
            <p class="mt-0.5 text-[12px] leading-4 text-app-muted">
              Scheduling and runtime options
            </p>
          </div>
        </div>
        <div class="space-y-3 border-t border-app-line p-4">
          <ConfigSelect
            :model-value="config.priority"
            label="CPU priority"
            :options="prioritySelectOptions"
            @update:model-value="handlePriorityChange"
          />
          <ConfigSelect
            :model-value="config.affinity"
            label="Affinity"
            :options="affinitySelectOptions"
            @update:model-value="handleAffinityChange"
          />
          <ConfigInput
            v-model="config.donateLevel"
            label="XMRig donate level"
            type="number"
            inputmode="numeric"
            suffix="%"
            supporting-text="Developer donation percentage passed to XMRig"
          />
          <ConfigSelect
            :model-value="String(config.donateOverProxy)"
            label="Donate over proxy"
            :options="donateOverProxySelectOptions"
            @update:model-value="handleDonateOverProxyChange"
          />
          <ToggleRow
            v-model="config.hugePagesEnabled"
            label="Huge pages"
            supporting-text="Use if supported by the native miner backend"
            :disabled="!config.hugePagesSupported"
          />
          <ToggleRow
            v-model="config.backgroundMining"
            label="Background mining"
            supporting-text="Keep mining service active in background"
          />
        </div>
      </section>
    </section>

    <section v-else class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center gap-3 px-4">
        <MaterialIcon class="text-app-green" name="health_and_safety" :size="21" />
        <div class="min-w-0">
          <h2 class="text-[15px] font-semibold leading-5 text-white">Thermal protection</h2>
          <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Temperature and pause rules</p>
        </div>
      </div>
      <div class="space-y-3 border-t border-app-line p-4">
        <div class="rounded-lg bg-app-elevated p-3">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="text-[14px] leading-5 text-app-muted">Temperature limit</span>
            <strong class="text-[15px] text-white">{{ config.thermalThreshold }} °C</strong>
          </div>
          <input
            v-model.number="config.thermalThreshold"
            class="android-slider"
            type="range"
            min="55"
            max="85"
            step="1"
          />
        </div>
        <ToggleRow
          v-model="config.autoPauseScreenOff"
          label="Auto-pause on screen off"
          supporting-text="Pause mining when the display turns off"
        />
        <ToggleRow
          v-model="config.autoPauseOnBattery"
          label="Auto-pause on battery"
          supporting-text="Pause if unplugged and battery safety is active"
        />
      </div>
    </section>

    <section
      class="bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 rounded-xl border border-app-line/80 bg-app-card/95 p-1.5 shadow-[0_8px_18px_rgb(0_0_0/0.14)] backdrop-blur"
    >
      <div class="grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-1.5">
        <button
          class="ripple flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-lg bg-app-elevated px-3 text-[13px] font-semibold text-app-on active:bg-app-line/40"
          type="button"
          @click="saveCurrentSetup"
        >
          <MaterialIcon :name="saveFeedbackVisible ? 'check_circle' : 'save'" :size="21" />
          <span class="truncate">{{ saveButtonLabel }}</span>
        </button>
        <button
          class="ripple flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-lg bg-app-green px-3 text-[13px] font-semibold text-white shadow-[0_6px_14px_rgb(25_128_88/0.2)] disabled:opacity-45"
          type="button"
          :disabled="!canStartMining"
          @click="saveAndStartMining"
        >
          <MaterialIcon name="play_arrow" :size="22" filled />
          <span class="truncate">{{ startButtonLabel }}</span>
        </button>
      </div>
    </section>
  </div>
</template>
