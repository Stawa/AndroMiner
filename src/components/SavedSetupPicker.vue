<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
import CoinIcon from './CoinIcon.vue';
import ConfigInput from './ConfigInput.vue';
import type { SavedMiningProfile } from '../types/mining';

defineProps<{
  profiles: SavedMiningProfile[];
  activeId: string | null;
  name: string;
}>();
const emit = defineEmits<{
  apply: [profile: SavedMiningProfile];
  create: [];
  rename: [];
  duplicate: [];
  delete: [];
  'update:name': [name: string];
}>();
</script>

<template>
  <section class="surface saved-setups" aria-labelledby="saved-setups-title">
    <div class="saved-setups-heading">
      <div>
        <h3 id="saved-setups-title">
          Saved setups <span>{{ profiles.length }}</span>
        </h3>
        <p>Switch between your saved wallet, pool, and CPU settings.</p>
      </div>
      <button class="outline-button" @click="emit('create')">
        <MaterialIcon name="add" :size="18" />New setup
      </button>
    </div>
    <div
      v-if="profiles.length"
      class="saved-setup-list grid gap-2.5 md:grid-cols-2"
      role="group"
      aria-label="Saved setups"
    >
      <button
        v-for="profile in profiles"
        :key="profile.id"
        class="saved-setup-option"
        :aria-pressed="profile.id === activeId"
        @click="emit('apply', profile)"
      >
        <CoinIcon
          :symbol="profile.config.coin.symbol"
          :name="profile.config.coin.name"
          :size="36"
        />
        <span class="saved-setup-copy">
          <strong>{{ profile.name }}</strong>
          <span>{{ profile.config.coin.symbol }} · {{ profile.config.threadCount }} threads</span>
          <small>{{ profile.config.poolUrl }}:{{ profile.config.poolPort }}</small>
        </span>
        <MaterialIcon
          :name="profile.id === activeId ? 'check_circle' : 'radio_button_unchecked'"
          :size="21"
        />
      </button>
    </div>
    <p v-else class="section-copy">Save your current configuration to reuse it next time.</p>
    <details v-if="profiles.some((profile) => profile.id === activeId)" class="saved-setup-manage">
      <summary>Manage selected setup</summary>
      <div class="saved-setup-editor">
        <ConfigInput
          :model-value="name"
          label="Setup name"
          @update:model-value="emit('update:name', String($event))"
        />
        <button class="outline-button" :disabled="!name.trim()" @click="emit('rename')">
          Rename
        </button>
        <button class="outline-button" aria-label="Copy selected setup" @click="emit('duplicate')">
          <MaterialIcon name="content_copy" :size="18" />Copy
        </button>
        <button
          class="outline-button danger-text"
          aria-label="Delete selected setup"
          @click="emit('delete')"
        >
          <MaterialIcon name="delete" :size="18" />Delete
        </button>
      </div>
    </details>
  </section>
</template>
