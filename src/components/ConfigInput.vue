<script setup lang="ts">
import { ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';

interface ConfigInputProps {
  modelValue: string | number;
  label: string;
  type?: 'text' | 'number' | 'password';
  inputmode?: 'text' | 'numeric' | 'decimal' | 'url';
  supportingText?: string;
  suffix?: string;
  revealable?: boolean;
}

withDefaults(defineProps<ConfigInputProps>(), {
  type: 'text',
  inputmode: 'text',
  supportingText: '',
  suffix: '',
  revealable: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const handleInput = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.type === 'number' ? Number(target.value) : target.value);
};

const visible = ref(false);
</script>

<template>
  <label class="config-field">
    <span class="config-label">{{ label }}</span>
    <span class="relative block">
      <input
        class="config-input"
        :class="{ 'pr-16': suffix || revealable }"
        :value="modelValue"
        :type="revealable && visible ? 'text' : type"
        :inputmode="inputmode"
        autocomplete="off"
        @input="handleInput"
      />
      <span
        v-if="suffix"
        class="absolute inset-y-0 right-4 flex items-center text-[13px] text-app-muted"
        >{{ suffix }}</span
      >
      <button
        v-if="revealable"
        class="ripple absolute right-1 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-app-muted"
        type="button"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        @click="visible = !visible"
      >
        <MaterialIcon :name="visible ? 'visibility_off' : 'visibility'" :size="21" />
      </button>
    </span>
    <span v-if="supportingText" class="mt-1 block text-[12px] leading-[18px] text-app-muted">{{
      supportingText
    }}</span>
  </label>
</template>
