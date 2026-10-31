<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import { useProfilesStore } from '../stores/profiles';
import { formatDate, t } from '../i18n';
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
  t('profiles.defaultName', {
    symbol: props.config.coin.symbol,
    profile: t(`profile.${props.config.profile}`)
  })
);

const coinProfiles = computed(() => profiles.profilesByCoin(props.config.coin.id));

const formatUpdated = (value: string): string =>
  formatDate(value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const saveProfile = (): void => {
  const trimmed = newName.value.trim();
  if (!trimmed) {
    return;
  }

  emit('saveCurrent', trimmed);
  newName.value = t('profiles.customName', {
    symbol: props.config.coin.symbol,
    n: profiles.profiles.length + 1
  });
};

const applyProfile = (profile: SavedMiningProfile): void => {
  if (props.locked) return;
  profiles.setActive(profile.id);
  emit('apply', profile);
};

const deleteProfile = (profile: SavedMiningProfile): void => {
  if (props.locked) return;
  const confirmed = window.confirm(t('config.deleteConfirm', { name: profile.name }));
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
      <h1>{{ $t('profiles.title') }}</h1>
      <p>
        {{
          $t('profiles.summary', {
            count: coinProfiles.length,
            symbol: config.coin.symbol,
            total: profiles.profiles.length
          })
        }}
      </p>
    </header>
    <div v-if="locked" class="notice">
      <p>{{ $t('profiles.locked') }}</p>
    </div>
    <section class="surface profile-save">
      <h3 class="section-title">{{ $t('profiles.saveTitle') }}</h3>
      <p class="section-copy">{{ $t('profiles.saveCopy') }}</p>
      <ConfigInput v-model="newName" :label="$t('profiles.name')" /><button
        class="primary-button full-width"
        :disabled="!newName.trim()"
        @click="saveProfile"
      >
        <MaterialIcon name="add" :size="20" />{{ $t('profiles.save') }}
      </button>
    </section>
    <section class="surface">
      <div class="section-heading">
        <h3>{{ $t('profiles.yours') }}</h3>
        <span class="supporting-label">{{ profiles.profiles.length }}</span>
      </div>
      <div v-if="!profiles.profiles.length" class="empty-state">
        <MaterialIcon name="bookmark_border" :size="28" /><strong>{{
          $t('profiles.emptyTitle')
        }}</strong>
        <p>{{ $t('profiles.emptyBody') }}</p>
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
                {{ profile.config.coin.symbol }} ·
                {{
                  $t('unit.threads', { n: profile.config.threadCount }, profile.config.threadCount)
                }}
                · {{ $t(`affinity.${profile.config.affinity}`) }}
              </p>
              <small class="text-app-muted">{{ formatUpdated(profile.updatedAt) }}</small>
            </div>
            <span v-if="profile.id === profiles.activeProfileId" class="supporting-label">{{
              $t('profiles.active')
            }}</span>
          </div>
          <div class="action-row">
            <button class="outline-button" :disabled="locked" @click="applyProfile(profile)">
              {{ $t('profiles.use') }}</button
            ><button
              class="outline-button"
              :aria-label="$t('profiles.duplicate', { name: profile.name })"
              :disabled="locked"
              @click="duplicateProfile(profile)"
            >
              <MaterialIcon name="content_copy" :size="18" /></button
            ><button
              class="outline-button danger-text"
              :aria-label="$t('profiles.delete', { name: profile.name })"
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
