<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import ConfigSelect from '../components/ConfigSelect.vue';
import ExpandableCard from '../components/ExpandableCard.vue';
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
}

const props = defineProps<MiningConfigViewProps>();

const emit = defineEmits<{
  profile: [value: MiningProfile];
  coin: [value: string];
  applyProfile: [profile: SavedMiningProfile];
  start: [];
}>();

const poolOpen = ref(true);
const cpuOpen = ref(true);
const thermalOpen = ref(false);
const profileNameDraft = ref('');
const savedProfiles = useProfilesStore();

const profiles = computed(() =>
  profilePresets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    supportingText: preset.id === 'custom' ? 'Configure' : `${preset.threads} threads`
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
    supportingText: coin.algorithm,
    iconText: coin.logoText,
    iconClass: coin.logoClass
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

const saveActiveProfile = (): void => {
  savedProfiles.saveActiveConfig(props.config);
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
};

watch(
  () => props.config.threadCount,
  (value) => {
    props.config.customThreadCount = Math.min(
      props.config.totalDetectedThreads,
      Math.max(1, Number(value) || 1)
    );
  }
);

watch(
  () => props.config.customThreadCount,
  (value) => {
    props.config.threadCount = Math.min(
      props.config.totalDetectedThreads,
      Math.max(1, Number(value) || 1)
    );
  }
);

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
</script>

<template>
  <div class="phone-page">
    <section class="app-card overflow-hidden p-4">
      <ConfigSelect
        :model-value="config.coin.id"
        label="Selected coin"
        :options="coinOptions"
        :supporting-text="`Current algorithm: ${config.algorithm}`"
        @update:model-value="handleCoinChange"
      />
    </section>

    <section class="app-card p-4">
      <div class="flex items-start gap-3">
        <div
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-elevated"
          :class="backendStatus.tone"
        >
          <MaterialIcon :name="backendStatus.icon" :size="22" />
        </div>
        <div class="min-w-0 flex-1 overflow-hidden">
          <p class="break-words text-[15px] font-semibold leading-5 text-white">
            {{ backendStatus.label }}
          </p>
          <p class="mt-1 break-words text-[12px] leading-[18px] text-app-muted">
            {{ backendMessage }}
          </p>
        </div>
      </div>
    </section>

    <section class="app-card overflow-hidden">
      <div class="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="text-[15px] font-semibold leading-5 text-white">Mining profiles</p>
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

      <div class="space-y-1 border-t border-app-line px-2 py-2">
        <button
          v-for="profile in savedProfiles.profiles"
          :key="profile.id"
          class="ripple flex min-h-[68px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left active:bg-white/10"
          :class="
            profile.id === savedProfiles.activeProfileId
              ? 'bg-app-green-dim text-white'
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
          <MaterialIcon
            v-if="profile.id === savedProfiles.activeProfileId"
            class="shrink-0 text-app-green"
            name="check_circle"
            :size="22"
            filled
          />
        </button>
      </div>

      <div v-if="activeSavedProfile" class="space-y-3 border-t border-app-line p-4">
        <ConfigInput
          v-model="profileNameDraft"
          label="Active profile name"
          supporting-text="Rename the selected profile"
        />
        <div class="grid grid-cols-4 gap-2">
          <button
            class="ripple flex min-h-12 flex-col items-center justify-center rounded-xl bg-app-green-dim text-[11px] font-semibold text-app-green"
            type="button"
            @click="saveActiveProfile"
          >
            <MaterialIcon name="save" :size="20" />
            Save
          </button>
          <button
            class="ripple flex min-h-12 flex-col items-center justify-center rounded-xl bg-app-elevated text-[11px] font-medium text-white"
            type="button"
            @click="renameActiveProfile"
          >
            <MaterialIcon name="edit" :size="20" />
            Rename
          </button>
          <button
            class="ripple flex min-h-12 flex-col items-center justify-center rounded-xl bg-app-elevated text-[11px] font-medium text-white"
            type="button"
            @click="duplicateActiveProfile"
          >
            <MaterialIcon name="content_copy" :size="20" />
            Copy
          </button>
          <button
            class="ripple flex min-h-12 flex-col items-center justify-center rounded-xl bg-app-elevated text-[11px] font-medium text-red-300"
            type="button"
            @click="deleteActiveProfile"
          >
            <MaterialIcon name="delete" :size="20" />
            Delete
          </button>
        </div>
      </div>
    </section>

    <section class="app-card p-4">
      <p class="mb-3 text-[15px] font-semibold leading-5 text-white">Profile</p>
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
    </section>

    <ExpandableCard
      v-model="poolOpen"
      title="Pool and wallet"
      supporting-text="Connection details for this coin"
    >
      <div class="space-y-3">
        <ConfigInput v-model="config.poolUrl" label="Pool URL" inputmode="url" />
        <ConfigInput v-model="config.poolPort" label="Port" type="number" inputmode="numeric" />
        <ConfigInput
          v-model="config.walletAddress"
          :label="`${config.coin.name} / ${config.coin.symbol} wallet`"
          supporting-text="Wallet address or username for this cryptocurrency"
        />
        <ConfigInput v-model="config.workerName" label="Worker name" />
        <ConfigInput v-model="config.password" label="Password" type="password" revealable />
        <ConfigSelect
          :model-value="config.protocol"
          label="Protocol"
          :options="protocolSelectOptions"
          @update:model-value="handleProtocolChange"
        />
      </div>
    </ExpandableCard>

    <ExpandableCard
      v-model="cpuOpen"
      title="CPU configuration"
      supporting-text="Threads, affinity, priority, and safety"
    >
      <div class="space-y-3">
        <div class="flex min-h-12 items-center justify-between gap-3">
          <span class="text-[14px] leading-5 text-app-muted">Total CPU threads</span>
          <strong class="text-[15px] font-medium text-white">{{
            config.totalDetectedThreads
          }}</strong>
        </div>
        <div class="rounded-xl bg-app-elevated p-3">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="text-[14px] leading-5 text-app-muted">Threads to use</span>
            <strong class="text-[15px] text-white">{{ config.threadCount }} threads</strong>
          </div>
          <input
            v-model.number="config.threadCount"
            class="android-slider"
            type="range"
            min="1"
            :max="config.totalDetectedThreads"
            step="1"
          />
          <div class="flex justify-between text-[11px] leading-4 text-app-muted">
            <span>1</span>
            <span>{{ config.totalDetectedThreads }}</span>
          </div>
        </div>
        <ConfigInput
          v-model="config.customThreadCount"
          label="Custom thread count"
          type="number"
          inputmode="numeric"
        />
        <div
          class="grid grid-cols-[48px_1fr_48px] items-center gap-2 rounded-xl bg-app-elevated p-2"
        >
          <button
            class="ripple grid h-12 w-12 place-items-center rounded-lg text-white"
            type="button"
            aria-label="Decrease thread count"
            @click="adjustThreads(-1)"
          >
            <MaterialIcon name="remove" :size="22" />
          </button>
          <p class="text-center text-[14px] text-app-muted">
            Thread count controls
            <strong class="mt-0.5 block text-[18px] text-white">{{ config.threadCount }}</strong>
          </p>
          <button
            class="ripple grid h-12 w-12 place-items-center rounded-lg text-white"
            type="button"
            aria-label="Increase thread count"
            @click="adjustThreads(1)"
          >
            <MaterialIcon name="add" :size="22" />
          </button>
        </div>
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
    </ExpandableCard>

    <ExpandableCard
      v-model="thermalOpen"
      title="Thermal protection"
      supporting-text="Temperature limit and auto-pause behavior"
    >
      <div class="space-y-3">
        <div class="rounded-xl bg-app-elevated p-3">
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
    </ExpandableCard>

    <section class="app-card overflow-hidden">
      <button
        class="ripple flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
        type="button"
        @click="emit('start')"
      >
        <MaterialIcon class="text-app-green" name="play_arrow" :size="24" filled />
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-semibold leading-5 text-white"
            >Save & Start Mining</span
          >
          <span class="mt-1 block text-[12px] leading-[18px] text-app-muted"
            >Launch a focused mining session</span
          >
        </span>
      </button>
    </section>
  </div>
</template>
