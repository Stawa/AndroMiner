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
  <div class="session-controls grid gap-2" role="group" :aria-label="$t('controls.group')">
    <button
      class="session-action ripple"
      type="button"
      :disabled="
        Boolean(pendingAction) ||
        state === 'starting' ||
        state === 'pausing' ||
        state === 'stopping'
      "
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
          ? $t('controls.pausing')
          : pendingAction === 'resume'
            ? $t('controls.resuming')
            : state === 'paused'
              ? $t('controls.resume')
              : $t('controls.pause')
      }}</span>
    </button>
    <button
      class="session-action stop-button"
      type="button"
      :disabled="Boolean(pendingAction) || state === 'pausing' || state === 'stopping'"
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
      <span>{{ pendingAction === 'stop' ? $t('controls.stopping') : $t('controls.stop') }}</span>
    </button>
    <button
      class="session-action ripple"
      type="button"
      :disabled="
        Boolean(pendingAction) ||
        state === 'starting' ||
        state === 'pausing' ||
        state === 'stopping'
      "
      @click="emit('profile')"
    >
      <MaterialIcon name="tune" :size="28" />
      <span>{{ profileLabel }}</span>
    </button>
  </div>
</template>
