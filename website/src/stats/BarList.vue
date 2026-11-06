<script setup lang="ts">
export interface BarRow {
  label: string;
  count: number;
  share: number;
}

defineProps<{
  rows: BarRow[];
  /** Rows folded away for privacy or missing data; printed muted, without a bar. */
  notes?: { label: string; count: number }[];
}>();

const number = new Intl.NumberFormat();
const percent = (share: number): string => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
</script>

<template>
  <ul class="m-0 grid list-none gap-3.5 p-0">
    <li
      v-for="row in rows"
      :key="row.label"
      class="grid grid-cols-[1fr_auto_3.25rem] items-baseline gap-x-3 gap-y-1.5 text-sm"
    >
      <span class="min-w-0 [overflow-wrap:anywhere]">{{ row.label }}</span>
      <span class="text-right font-semibold tabular-nums">{{ number.format(row.count) }}</span>
      <span class="text-right text-muted tabular-nums">{{ percent(row.share) }}</span>
      <span
        class="col-span-full h-1.5 overflow-hidden rounded-[3px] bg-surface-2"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-[3px] bg-accent"
          :style="{ width: `${Math.max(1, row.share * 100)}%` }"
        />
      </span>
    </li>
    <li
      v-for="note in notes"
      :key="note.label"
      class="grid grid-cols-[1fr_auto] items-baseline gap-x-3 text-sm text-muted"
    >
      <span class="min-w-0 [overflow-wrap:anywhere]">{{ note.label }}</span>
      <span class="text-right font-semibold tabular-nums">{{ number.format(note.count) }}</span>
    </li>
  </ul>
</template>
