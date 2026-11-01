<script setup lang="ts">
import { computed } from 'vue';

interface RangeSliderProps {
  modelValue: number;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  offLabel?: string;
}

const props = withDefaults(defineProps<RangeSliderProps>(), {
  step: 1,
  unit: '',
  disabled: false,
  offLabel: ''
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const fill = computed(
  () =>
    `${Math.min(100, Math.max(0, ((props.modelValue - props.min) / (props.max - props.min)) * 100))}%`
);

const isOff = computed(() => props.offLabel !== '' && props.modelValue === props.min);
const format = (value: number): string =>
  props.offLabel !== '' && value === props.min ? props.offLabel : `${value}${props.unit}`;

const handleInput = (event: Event): void => {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value));
};
</script>

<template>
  <div class="range-slider" :class="{ 'is-disabled': disabled }">
    <div class="range-slider-head">
      <span class="range-slider-label">{{ label }}</span>
      <strong class="range-slider-value" :class="{ 'is-off': isOff }">{{
        format(modelValue)
      }}</strong>
    </div>
    <input
      class="range-slider-input"
      type="range"
      :aria-label="label"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--fill': fill }"
      @input="handleInput"
    />
    <div class="range-slider-scale" aria-hidden="true">
      <span>{{ format(min) }}</span
      ><span>{{ format(max) }}</span>
    </div>
  </div>
</template>
