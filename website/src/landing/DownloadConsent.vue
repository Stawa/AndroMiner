<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { links } from '../site/content';

const props = defineProps<{ open: boolean; title: string; url: string }>();
const emit = defineEmits<{ close: []; accept: [] }>();

const risk = ref(false);
const terms = ref(false);
const dialog = ref<HTMLElement | null>(null);
const first = ref<HTMLInputElement | null>(null);
let opener: HTMLElement | null = null;

watch(
  () => props.open,
  async (open) => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) {
      opener = document.activeElement as HTMLElement | null;
      risk.value = terms.value = false;
      await nextTick();
      first.value?.focus();
    } else opener?.focus();
  }
);
onBeforeUnmount(() => (document.documentElement.style.overflow = ''));

const onKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('close');
  else if (event.key === 'Tab') {
    // Keep focus inside the dialog.
    const items = [
      ...(dialog.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input') ??
        [])
    ];
    const a = items[0];
    const z = items[items.length - 1];
    if (!a || !z) return;
    const wrap = event.shiftKey ? document.activeElement === a : document.activeElement === z;
    if (!wrap) return;
    event.preventDefault();
    (event.shiftKey ? z : a).focus();
  }
};

const check = 'mt-0.5 size-5 shrink-0 cursor-pointer accent-accent';
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
    @click.self="emit('close')"
    @keydown="onKey"
  >
    <div
      ref="dialog"
      class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-ground p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-7"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <p class="eyebrow">Before you download</p>
      <h2 id="consent-title" class="mb-3 text-2xl font-extrabold tracking-tight">
        Mining can break your phone
      </h2>
      <p class="mb-4 text-[.9375rem] text-muted">
        Mining keeps the processor at full load. Sustained heat can damage the battery, screen or
        mainboard, and charging while hot can swell or ruin a battery. Use a spare phone you can
        afford to lose.
      </p>

      <div class="grid gap-3.5">
        <label class="flex cursor-pointer items-start gap-3 text-[.9375rem]">
          <input ref="first" v-model="risk" type="checkbox" :class="check" />
          <span>
            I understand the risks. The AndroMiner developers are
            <strong>not responsible</strong> if my phone, battery or data is damaged or lost.
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-3 text-[.9375rem]">
          <input v-model="terms" type="checkbox" :class="check" />
          <span>
            I have read and accept the
            <a class="text-accent-text underline" :href="links.terms" target="_blank" rel="noopener"
              >Terms of use</a
            >
            and
            <a
              class="text-accent-text underline"
              :href="links.privacy"
              target="_blank"
              rel="noopener"
              >Privacy policy</a
            >.
          </span>
        </label>
      </div>

      <div class="mt-6 grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          class="btn w-full disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!(risk && terms)"
          @click="emit('accept')"
        >
          Accept and download {{ title }}
        </button>
        <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
      </div>
      <p class="mt-3 mb-0 truncate font-mono text-xs text-muted">{{ url }}</p>
    </div>
  </div>
</template>
