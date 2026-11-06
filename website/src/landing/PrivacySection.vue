<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { links } from '../site/content';
import { vReveal } from '../site/reveal';
import { loadTotals, type PublicTotals } from './useBenchmarks';

const totals = ref<PublicTotals | null>(null);
onMounted(async () => {
  totals.value = await loadTotals();
});

const number = new Intl.NumberFormat();
const totalsText = computed(() => {
  const found = totals.value;
  if (!found) return '';
  const parts: string[] = [];
  if (found.downloads !== null) parts.push(`${number.format(found.downloads)} APK downloads`);
  if (found.monthlyActive !== null)
    parts.push(`${number.format(found.monthlyActive)} installations active this month`);
  return parts.length
    ? `Public totals right now: ${parts.join(' and ')}. Installation figures are a lower bound, because only people who leave statistics on are counted.`
    : '';
});
</script>

<template>
  <section
    id="privacy"
    class="bg-accent py-[clamp(48px,8vw,112px)] text-on-accent"
    aria-labelledby="privacy-title"
  >
    <h2 id="privacy-title" v-reveal class="mb-[clamp(28px,4vw,56px)] max-w-[24ch] text-h2">
      What leaves your phone, and what never does
    </h2>
    <div class="grid grid-cols-1 gap-[clamp(28px,5vw,72px)] md:grid-cols-2">
      <div v-reveal>
        <h3 class="mb-2 text-h3">Optional usage statistics</h3>
        <p>
          On by default in the Android app, off with one switch in Settings. About one small request
          a day: a random installation ID, app version, Android version, APK type, an optional
          country you pick yourself and optional mining totals. Each field has its own switch, and
          Delete my data removes the record from the service.
        </p>
        <p>
          The public <a class="font-extrabold underline" href="/stats">statistics page</a> shows
          totals only. A country or version is named only when at least ten installations share it.
        </p>
      </div>
      <div v-reveal="1">
        <h3 class="mb-2 text-h3">Never sent</h3>
        <p>
          Wallet addresses, pool addresses and credentials, worker names, individual sessions, live
          hashrate, temperatures, serial numbers, advertising IDs, GPS or any precise location. No
          analytics or advertising SDK is included, and requests carry no cookies and no referrer.
        </p>
        <p>
          The one speed figure that can leave is a benchmark result you choose to share. It never
          happens by itself, ignores the statistics switch, and carries no installation ID. Read the
          <a class="font-extrabold underline" :href="links.privacy">full privacy policy</a>.
        </p>
      </div>
    </div>
    <p v-if="totalsText" class="mt-6 text-[.9375rem]">{{ totalsText }}</p>
  </section>
</template>
