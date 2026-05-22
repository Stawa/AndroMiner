<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
import type { MiningState } from '../types/mining';

interface SessionControlsProps {
  state: MiningState;
  profileLabel: string;
}

defineProps<SessionControlsProps>();

const emit = defineEmits<{
  pause: [];
  stop: [];
  profile: [];
}>();
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <button class="session-action ripple" type="button" @click="emit('pause')">
      <MaterialIcon :name="state === 'paused' ? 'play_arrow' : 'pause'" :size="28" filled />
      <span>{{ state === 'paused' ? 'Resume' : 'Pause' }}</span>
    </button>
    <button class="session-action ripple text-red-300" type="button" @click="emit('stop')">
      <MaterialIcon name="stop" :size="28" filled />
      <span>Stop</span>
    </button>
    <button class="session-action ripple" type="button" @click="emit('profile')">
      <MaterialIcon name="tune" :size="28" />
      <span>{{ profileLabel }}</span>
    </button>
  </div>
</template>
