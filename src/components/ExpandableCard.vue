<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

interface ExpandableCardProps {
  title: string;
  supportingText?: string;
  modelValue: boolean;
}

withDefaults(defineProps<ExpandableCardProps>(), {
  supportingText: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <section class="app-card overflow-hidden">
    <button
      class="ripple flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
      type="button"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-[0.9375rem] font-semibold leading-5 text-app-on">{{ title }}</span>
        <span
          v-if="supportingText"
          class="mt-1 block text-[0.75rem] leading-[1.125rem] text-app-muted"
          >{{ supportingText }}</span
        >
      </span>
      <MaterialIcon
        class="transition-transform duration-200"
        :class="{ 'rotate-180': modelValue }"
        name="expand_more"
        :size="24"
      />
    </button>
    <div v-show="modelValue" class="border-t border-app-line p-4">
      <slot />
    </div>
  </section>
</template>
