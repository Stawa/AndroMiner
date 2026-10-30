<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import { useProfilesStore } from '../stores/profiles';
import type { MiningConfig, SavedMiningProfile } from '../types/mining';

interface ProfilesViewProps {
  config: MiningConfig;
  locked?: boolean;
}

const props = defineProps<ProfilesViewProps>();

const emit = defineEmits<{
  apply: [profile: SavedMiningProfile];
  saveCurrent: [name: string];
}>();

const profiles = useProfilesStore();
const newName = ref(
  `${props.config.coin.symbol} ${props.config.profile === 'battery_saver' ? 'Battery Saver' : props.config.profile}`
);

const coinProfiles = computed(() => profiles.profilesByCoin(props.config.coin.id));

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));

const saveProfile = (): void => {
  const trimmed = newName.value.trim();
  if (!trimmed) {
    return;
  }

  emit('saveCurrent', trimmed);
  newName.value = `${props.config.coin.symbol} Custom ${profiles.profiles.length + 1}`;
};

const applyProfile = (profile: SavedMiningProfile): void => {
  if (props.locked) return;
  profiles.setActive(profile.id);
  emit('apply', profile);
};

const deleteProfile = (profile: SavedMiningProfile): void => {
  if (props.locked) return;
  const confirmed = window.confirm(
    `Delete "${profile.name}"? This saved mining profile cannot be restored.`
  );
  if (!confirmed) {
    return;
  }

  const wasActive = profile.id === profiles.activeProfileId;
  profiles.deleteProfile(profile.id);
  if (wasActive && profiles.activeProfile) emit('apply', profiles.activeProfile);
};

const duplicateProfile = (profile: SavedMiningProfile): void => {
  if (props.locked) return;
  profiles.duplicateProfile(profile.id);
  if (profiles.activeProfile) emit('apply', profiles.activeProfile);
};
</script>

<template>
  <div class="app-page phone-page redesign-page profiles-page">
    <header class="screen-heading">
      <h1>Mining profiles</h1>
      <p>
        {{ coinProfiles.length }} {{ config.coin.symbol }} setups ·
        {{ profiles.profiles.length }} saved in total.
      </p>
    </header>
    <div v-if="locked" class="notice">
      <p>Stop the active run to apply a different setup. You can still save a copy.</p>
    </div>
    <section class="surface profile-save">
      <h3 class="section-title">Save this configuration</h3>
      <p class="section-copy">
        Keep your wallet, pool, and CPU settings together for your next run.
      </p>
      <ConfigInput v-model="newName" label="Setup name" /><button
        class="primary-button full-width"
        :disabled="!newName.trim()"
        @click="saveProfile"
      >
        <MaterialIcon name="add" :size="20" />Save setup
      </button>
    </section>
    <section class="surface">
      <div class="section-heading">
        <h3>Your saved setups</h3>
        <span class="supporting-label">{{ profiles.profiles.length }}</span>
      </div>
      <div v-if="!profiles.profiles.length" class="empty-state">
        <MaterialIcon name="bookmark_border" :size="28" /><strong
          >A good setup is worth keeping</strong
        >
        <p>Save the current configuration to reuse it later.</p>
      </div>
      <div class="profile-library grid min-w-0 grid-cols-1 gap-3.5 md:grid-cols-2">
        <article v-for="profile in profiles.profiles" :key="profile.id" class="profile-row min-w-0">
          <div class="setup-identity">
            <CoinIcon
              :symbol="profile.config.coin.symbol"
              :name="profile.config.coin.name"
              :size="36"
            />
            <div class="min-w-0 flex-1">
              <strong class="block [overflow-wrap:anywhere]">{{ profile.name }}</strong>
              <p>
                {{ profile.config.coin.symbol }} · {{ profile.config.threadCount }} threads ·
                {{ profile.config.affinity }}
              </p>
              <small class="text-app-muted">{{ formatDate(profile.updatedAt) }}</small>
            </div>
            <span v-if="profile.id === profiles.activeProfileId" class="supporting-label"
              >ACTIVE</span
            >
          </div>
          <div class="action-row">
            <button class="outline-button" :disabled="locked" @click="applyProfile(profile)">
              Use setup</button
            ><button
              class="outline-button"
              :aria-label="'Duplicate ' + profile.name"
              :disabled="locked"
              @click="duplicateProfile(profile)"
            >
              <MaterialIcon name="content_copy" :size="18" /></button
            ><button
              class="outline-button danger-text"
              :aria-label="'Delete ' + profile.name"
              :disabled="locked"
              @click="deleteProfile(profile)"
            >
              <MaterialIcon name="delete" :size="18" />
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
