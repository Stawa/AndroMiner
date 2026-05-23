<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfigInput from '../components/ConfigInput.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import { useProfilesStore } from '../stores/profiles';
import type { MiningConfig, SavedMiningProfile } from '../types/mining';

interface ProfilesViewProps {
  config: MiningConfig;
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
  profiles.setActive(profile.id);
  emit('apply', profile);
};

const deleteProfile = (profile: SavedMiningProfile): void => {
  const confirmed = window.confirm(
    `Delete "${profile.name}"? This saved mining profile cannot be restored.`
  );
  if (!confirmed) {
    return;
  }

  profiles.deleteProfile(profile.id);
};
</script>

<template>
  <div class="phone-page">
    <section class="app-card p-4">
      <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Current coin</p>
      <div class="mt-3 flex items-center gap-3">
        <div
          class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[22px] font-bold text-white"
          :class="config.coin.logoClass"
        >
          {{ config.coin.logoText }}
        </div>
        <div class="min-w-0">
          <p class="truncate text-[16px] font-semibold text-white">
            {{ config.coin.name }} / {{ config.coin.symbol }}
          </p>
          <p class="text-[12px] text-app-muted">
            {{ coinProfiles.length }} saved profiles for this coin
          </p>
        </div>
      </div>
    </section>

    <section class="app-card p-4">
      <h2 class="text-[16px] font-semibold text-white">Save current setup</h2>
      <div class="mt-3 space-y-3">
        <ConfigInput v-model="newName" label="Profile name" />
        <button
          class="ripple h-14 w-full rounded-xl bg-app-green-dim text-[15px] font-semibold text-app-green"
          type="button"
          @click="saveProfile"
        >
          Save Profile
        </button>
      </div>
    </section>

    <section class="app-card overflow-hidden">
      <div class="settings-heading">
        <MaterialIcon name="tune" :size="20" />
        <span>Saved profiles</span>
      </div>
      <div
        v-if="profiles.profiles.length === 0"
        class="border-t border-app-line p-4 text-[13px] leading-5 text-app-muted"
      >
        No saved profiles yet. Save your current setup to reuse it later.
      </div>
      <div v-else class="divide-y divide-app-line">
        <article v-for="profile in profiles.profiles" :key="profile.id" class="p-4">
          <div class="flex items-start gap-3">
            <div
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
              :class="profile.config.coin.logoClass"
            >
              {{ profile.config.coin.logoText }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-semibold text-white">{{ profile.name }}</p>
              <p class="mt-0.5 text-[12px] leading-[18px] text-app-muted">
                {{ profile.config.coin.symbol }} · {{ profile.config.threadCount }} threads ·
                {{ profile.config.protocol }}
              </p>
              <p class="text-[11px] leading-4 text-app-muted">
                Updated {{ formatDate(profile.updatedAt) }}
              </p>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <button
              class="ripple min-h-12 rounded-xl bg-app-green-dim text-[13px] font-semibold text-app-green"
              type="button"
              @click="applyProfile(profile)"
            >
              Apply
            </button>
            <button
              class="ripple min-h-12 rounded-xl bg-app-elevated text-[13px] font-medium text-white"
              type="button"
              @click="profiles.duplicateProfile(profile.id)"
            >
              Copy
            </button>
            <button
              class="ripple min-h-12 rounded-xl bg-app-elevated text-[13px] font-medium text-red-300"
              type="button"
              @click="deleteProfile(profile)"
            >
              Delete
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
