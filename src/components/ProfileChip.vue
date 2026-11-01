<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
import type { MiningProfile } from '../types/mining';

interface ProfileChipProps {
  value: MiningProfile;
  label: string;
  supportingText: string;
  selected: boolean;
  icon?: string;
  threadLabel?: string;
  coreLabel?: string;
}

defineProps<ProfileChipProps>();

const emit = defineEmits<{
  select: [value: MiningProfile];
}>();
</script>

<template>
  <button class="profile-option pc" :aria-pressed="selected" @click="emit('select', value)">
    <span class="pc-icon" aria-hidden="true"
      ><MaterialIcon v-if="icon" :name="icon" :size="22"
    /></span>
    <span class="pc-text">
      <strong>{{ label }}</strong>
      <small>{{ supportingText }}</small>
      <span class="pc-meta">
        <span v-if="threadLabel">{{ threadLabel }}</span>
        <span v-if="coreLabel">{{ coreLabel }}</span>
      </span>
    </span>
    <span class="pc-radio" aria-hidden="true" />
  </button>
</template>
