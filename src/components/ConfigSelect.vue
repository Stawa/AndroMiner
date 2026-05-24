<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';

interface ConfigSelectOption {
  value: string;
  label: string;
  supportingText?: string;
  iconText?: string;
  iconClass?: string;
  disabled?: boolean;
}

interface ConfigSelectProps {
  modelValue: string;
  label: string;
  options: ConfigSelectOption[];
  supportingText?: string;
}

const props = withDefaults(defineProps<ConfigSelectProps>(), {
  supportingText: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) || props.options[0]
);

const selectOption = (value: string): void => {
  const option = props.options.find((item) => item.value === value);

  if (option?.disabled) {
    return;
  }

  emit('update:modelValue', value);
  open.value = false;
};

const closeSheet = (): void => {
  open.value = false;
};
</script>

<template>
  <div class="config-field">
    <span class="config-label">{{ label }}</span>
    <button
      class="ripple flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-app-elevated px-4 text-left text-white active:bg-white/10"
      type="button"
      :aria-expanded="open"
      @click="open = true"
    >
      <span
        v-if="selectedOption?.iconText"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white"
        :class="selectedOption.iconClass"
      >
        {{ selectedOption.iconText }}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[16px] leading-6">{{ selectedOption?.label }}</span>
        <span
          v-if="selectedOption?.supportingText"
          class="mt-0.5 block truncate text-[12px] leading-4 text-app-muted"
          >{{ selectedOption.supportingText }}</span
        >
      </span>
      <MaterialIcon class="shrink-0 text-app-muted" name="expand_more" :size="22" />
    </button>
    <span v-if="supportingText" class="mt-1 block text-[12px] leading-[18px] text-app-muted">{{
      supportingText
    }}</span>
  </div>

  <Teleport to="body">
    <Transition name="fade">
      <button
        v-if="open"
        class="fixed inset-0 z-50 h-full w-full bg-black/65"
        type="button"
        :aria-label="`Close ${label} selector`"
        @click="closeSheet"
      />
    </Transition>
    <Transition name="dialog">
      <section
        v-if="open"
        class="fixed left-1/2 top-1/2 z-50 flex max-h-[78vh] w-[calc(100vw-2rem)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] border border-app-line bg-app-card shadow-xl shadow-black/30"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
      >
        <div class="flex min-h-14 items-center justify-between gap-3 border-b border-app-line px-4">
          <h2 class="truncate text-[18px] font-semibold leading-6 text-white">{{ label }}</h2>
          <button
            class="ripple grid h-12 w-12 shrink-0 place-items-center rounded-full text-app-muted"
            type="button"
            aria-label="Close selector"
            @click="closeSheet"
          >
            <MaterialIcon name="close" :size="22" />
          </button>
        </div>

        <div class="overflow-y-auto px-2 py-2">
          <button
            v-for="option in options"
            :key="option.value"
            class="ripple flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left active:bg-white/10"
            :class="{ 'opacity-45': option.disabled }"
            type="button"
            :disabled="option.disabled"
            @click="selectOption(option.value)"
          >
            <span
              v-if="option.iconText"
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
              :class="option.iconClass"
            >
              {{ option.iconText }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-medium leading-5 text-white">{{
                option.label
              }}</span>
              <span
                v-if="option.supportingText"
                class="mt-0.5 block truncate text-[12px] leading-[18px] text-app-muted"
                >{{ option.supportingText }}</span
              >
            </span>
            <MaterialIcon
              v-if="option.value === modelValue"
              class="shrink-0 text-app-green"
              name="check_circle"
              :size="22"
              filled
            />
          </button>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
