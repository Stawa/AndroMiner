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
  <button
    class="profile-chip ripple"
    :class="{ 'profile-chip-selected': selected }"
    type="button"
    @click="emit('select', value)"
  >
    <span class="flex min-w-0 items-center gap-3 text-left">
      <span
        v-if="icon"
        class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-app-card/80 text-app-muted transition-colors"
        :class="{ 'bg-app-green/15 text-app-green': selected }"
      >
        <MaterialIcon :name="icon" :size="23" :filled="selected" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[15px] font-semibold leading-5">{{ label }}</span>
        <span class="mt-0.5 block break-words text-[12px] leading-4 opacity-75">
          {{ supportingText }}
        </span>
        <span
          v-if="threadLabel || coreLabel"
          class="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-semibold leading-4"
        >
          <span v-if="threadLabel" class="rounded-full bg-app-card/80 px-2 py-0.5 text-app-on">
            {{ threadLabel }}
          </span>
          <span v-if="coreLabel" class="rounded-full bg-app-card/80 px-2 py-0.5 text-app-muted">
            {{ coreLabel }}
          </span>
        </span>
      </span>
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors"
        :class="
          selected
            ? 'border-app-green bg-app-green text-white'
            : 'border-app-line bg-app-card/70 text-transparent'
        "
      >
        <MaterialIcon v-if="selected" name="check" :size="18" />
      </span>
    </span>
  </button>
</template>
