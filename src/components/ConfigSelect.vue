<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import CoinIcon from './CoinIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';

interface ConfigSelectOption {
  value: string;
  label: string;
  supportingText?: string;
  iconText?: string;
  iconClass?: string;
  coinSymbol?: string;
  coinName?: string;
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
const query = ref('');
const searchable = computed(() => props.options.some((option) => option.coinSymbol));
const visibleOptions = computed(() => {
  const text = query.value.trim().toLowerCase();
  return text
    ? props.options.filter((option) =>
        `${option.label} ${option.supportingText || ''}`.toLowerCase().includes(text)
      )
    : props.options;
});

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
  query.value = '';
};

const closeSheet = (): void => {
  open.value = false;
  query.value = '';
};
const panel = ref<HTMLElement | null>(null);
useDialogFocus(() => open.value, panel, closeSheet);
</script>

<template>
  <div class="config-field">
    <span class="config-label">{{ label }}</span>
    <button
      class="select-trigger flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-3 text-left text-app-on"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="`${label}: ${selectedOption?.label || 'Select'}`"
      @click="open = true"
    >
      <CoinIcon
        v-if="selectedOption?.coinSymbol"
        :symbol="selectedOption.coinSymbol"
        :name="selectedOption.coinName"
        :size="36"
      />
      <span class="min-w-0 flex-1">
        <span class="block break-words whitespace-normal text-[0.875rem] leading-6">{{
          selectedOption?.label
        }}</span>
        <span
          v-if="selectedOption?.supportingText"
          class="mt-0.5 block whitespace-normal break-words text-[0.75rem] leading-[1.0625rem] text-app-muted"
          >{{ selectedOption.supportingText }}</span
        >
      </span>
      <MaterialIcon class="shrink-0 text-app-muted" name="expand_more" :size="22" />
    </button>
    <span
      v-if="supportingText"
      class="mt-1 block text-[0.75rem] leading-[1.125rem] text-app-muted"
      >{{ supportingText }}</span
    >
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
        class="select-sheet"
        ref="panel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
      >
        <span class="select-sheet-handle" aria-hidden="true" />
        <div
          class="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-app-line px-4"
        >
          <h2 class="min-w-0 break-words text-[1.125rem] font-semibold leading-6 text-app-on">
            {{ label }}
          </h2>
          <button
            class="ripple grid h-12 w-12 shrink-0 place-items-center rounded-full text-app-muted"
            type="button"
            aria-label="Close selector"
            @click="closeSheet"
          >
            <MaterialIcon name="close" :size="22" />
          </button>
        </div>
        <label v-if="searchable" class="coin-search">
          <span class="sr-only">Search coins</span>
          <input
            v-model="query"
            type="search"
            class="config-input"
            placeholder="Find a coin or algorithm"
            autocomplete="off"
          />
        </label>
        <div class="min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          <button
            v-for="option in visibleOptions"
            :key="option.value"
            class="ripple flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-app-elevated"
            :class="{
              'bg-app-green-dim': option.value === modelValue,
              'opacity-45': option.disabled
            }"
            type="button"
            :disabled="option.disabled"
            :aria-pressed="option.value === modelValue"
            @click="selectOption(option.value)"
          >
            <CoinIcon
              v-if="option.coinSymbol"
              :symbol="option.coinSymbol"
              :name="option.coinName"
              :size="38"
            />
            <span
              v-else-if="option.iconText"
              class="grid h-10 w-10 shrink-0 place-items-center rounded-control text-[1.125rem] font-bold text-app-on"
              :class="option.iconClass"
            >
              {{ option.iconText }}
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block break-words text-[0.9375rem] font-medium leading-5"
                :class="option.value === modelValue ? 'text-app-green' : 'text-app-on'"
                >{{ option.label }}</span
              >
              <span
                v-if="option.supportingText"
                class="mt-0.5 block whitespace-normal break-words text-[0.75rem] leading-[1.125rem] text-app-muted"
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
          <p v-if="!visibleOptions.length" class="coin-search-empty" role="status">
            No matches. Try a different name or symbol.
          </p>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
