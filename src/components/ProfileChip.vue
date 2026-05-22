<script setup lang="ts">
import type { MiningProfile } from '../types/mining';

interface ProfileChipProps {
  value: MiningProfile;
  label: string;
  supportingText: string;
  selected: boolean;
}

defineProps<ProfileChipProps>();

const emit = defineEmits<{
  select: [value: MiningProfile];
}>();
</script>

<template>
  <button
    class="profile-chip ripple"
    :class="{ 'profile-chip-selected': selected }"
    type="button"
    @click="emit('select', value)"
  >
    <span class="block truncate text-[14px] font-medium leading-5">{{ label }}</span>
    <span class="mt-1 block truncate text-[11px] leading-4 opacity-75">{{ supportingText }}</span>
  </button>
</template>
