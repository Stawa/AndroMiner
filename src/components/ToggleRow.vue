<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

interface ToggleRowProps {
  modelValue: boolean;
  label: string;
  supportingText?: string;
  icon?: string;
  disabled?: boolean;
}

withDefaults(defineProps<ToggleRowProps>(), {
  supportingText: '',
  icon: '',
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const handleChange = (event: Event): void => {
  emit('update:modelValue', (event.target as HTMLInputElement).checked);
};
</script>

<template>
  <label class="setting-row ripple" :class="{ 'opacity-50': disabled }">
    <MaterialIcon v-if="icon" class="setting-icon" :name="icon" :size="22" />
    <span class="min-w-0 flex-1">
      <span class="block text-[15px] font-medium leading-5 text-white">{{ label }}</span>
      <span v-if="supportingText" class="mt-1 block text-[12px] leading-[18px] text-app-muted">{{
        supportingText
      }}</span>
    </span>
    <input
      class="peer sr-only"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="md-switch" aria-hidden="true">
      <span class="md-switch-thumb" />
    </span>
  </label>
</template>
