<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
import type { MiningState } from '../types/mining';

type PendingSessionAction = 'pause' | 'resume' | 'stop' | null;

interface SessionControlsProps {
  state: MiningState;
  profileLabel: string;
  pendingAction?: PendingSessionAction;
  animationsEnabled?: boolean;
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
    <button
      class="session-action ripple"
      type="button"
      :disabled="Boolean(pendingAction)"
      :aria-busy="pendingAction === 'pause' || pendingAction === 'resume'"
      @click="emit('pause')"
    >
      <MaterialIcon
        v-if="pendingAction === 'pause' || pendingAction === 'resume'"
        :name="animationsEnabled ? 'progress_activity' : 'hourglass_empty'"
        :size="28"
        :class="{ 'animate-spin': animationsEnabled }"
      />
      <MaterialIcon v-else :name="state === 'paused' ? 'play_arrow' : 'pause'" :size="28" filled />
      <span>{{
        pendingAction === 'pause'
          ? 'Pausing'
          : pendingAction === 'resume'
            ? 'Resuming'
            : state === 'paused'
              ? 'Resume'
              : 'Pause'
      }}</span>
    </button>
    <button
      class="session-action ripple text-red-600"
      type="button"
      :disabled="Boolean(pendingAction)"
      :aria-busy="pendingAction === 'stop'"
      @click="emit('stop')"
    >
      <MaterialIcon
        v-if="pendingAction === 'stop'"
        :name="animationsEnabled ? 'progress_activity' : 'hourglass_empty'"
        :size="28"
        :class="{ 'animate-spin': animationsEnabled }"
      />
      <MaterialIcon v-else name="stop" :size="28" filled />
      <span>{{ pendingAction === 'stop' ? 'Stopping' : 'Stop' }}</span>
    </button>
    <button
      class="session-action ripple"
      type="button"
      :disabled="Boolean(pendingAction)"
      @click="emit('profile')"
    >
      <MaterialIcon name="tune" :size="28" />
      <span>{{ profileLabel }}</span>
    </button>
  </div>
</template>
