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
  <button class="profile-option" :aria-pressed="selected" @click="emit('select', value)">
    <MaterialIcon v-if="icon" :name="icon" :size="21" /><span
      ><strong>{{ label }}</strong
      ><small>{{ supportingText }}</small
      ><small>{{ threadLabel }} · {{ coreLabel }}</small></span
    ><MaterialIcon
      :name="selected ? 'radio_button_checked' : 'radio_button_unchecked'"
      :size="21"
    />
  </button>
</template>
