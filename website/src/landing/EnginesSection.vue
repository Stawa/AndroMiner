<script setup lang="ts">
import { engineRows } from '../site/content';
import { vReveal } from '../site/reveal';
</script>

<template>
  <section id="engines" aria-labelledby="engines-title">
    <p class="eyebrow">Engines</p>
    <h2 id="engines-title" v-reveal class="mb-[clamp(28px,4vw,56px)] max-w-[20ch] text-h2">
      Three engines, two CPU architectures
    </h2>
    <div class="grid grid-cols-1 items-start gap-[clamp(28px,5vw,72px)]">
      <div>
        <p v-reveal class="text-lead">
          XMRig is the supported engine. XMRigCC and XLArig are experimental and say so in the app.
          Bundled APKs carry all three for 64-bit and 32-bit ARM phones.
        </p>
        <div
          v-reveal
          class="my-7 overflow-x-auto card"
          tabindex="0"
          role="region"
          aria-label="Engine comparison, scrollable"
        >
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Engine</th>
                <th scope="col">Status</th>
                <th scope="col">Mines</th>
                <th scope="col">Architectures</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in engineRows" :key="row.name">
                <th scope="row" class="whitespace-nowrap">{{ row.name }}</th>
                <td>{{ row.status }}</td>
                <td>{{ row.mines }}</td>
                <td>{{ row.abis }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The 32-bit build runs RandomX in light mode because the 2 GB dataset does not fit reliably
          in a 32-bit address space, so expect lower speeds there. Engines are built from upstream
          source by the project's own scripts, and downloaded engines are checked against pinned
          SHA-256 hashes before they run.
        </p>
      </div>
    </div>
  </section>
</template>
