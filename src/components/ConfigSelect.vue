<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';

interface ConfigSelectOption {
  value: string;
  label: string;
  supportingText?: string;
  iconText?: string;
  iconClass?: string;
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
  emit('update:modelValue', value);
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
        class="fixed inset-0 z-50 h-full w-full bg-black/60"
        type="button"
        :aria-label="`Close ${label} selector`"
        @click="open = false"
      />
    </Transition>
    <Transition name="sheet">
      <section
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[78vh] max-w-[420px] overflow-hidden rounded-t-[28px] border border-app-line bg-app-card pb-[env(safe-area-inset-bottom)]"
        role="dialog"
        :aria-label="label"
      >
        <div class="px-4 pt-3">
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
          <div class="mb-3 flex min-h-12 items-center justify-between gap-3">
            <h2 class="text-[18px] font-semibold leading-6 text-white">{{ label }}</h2>
            <button
              class="ripple grid h-12 w-12 shrink-0 place-items-center rounded-full text-app-muted"
              type="button"
              aria-label="Close selector"
              @click="open = false"
            >
              <MaterialIcon name="close" :size="22" />
            </button>
          </div>
        </div>

        <div class="max-h-[calc(78vh-5rem)] overflow-y-auto px-2 pb-3">
          <button
            v-for="option in options"
            :key="option.value"
            class="ripple flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left active:bg-white/10"
            type="button"
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
