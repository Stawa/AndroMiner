<script setup lang="ts">
import { engineRows, images, shot } from './content';
import { vReveal } from './reveal';
</script>

<template>
  <section id="engines" class="engines" aria-labelledby="engines-title">
    <h2 id="engines-title" v-reveal>Three engines, two CPU architectures</h2>
    <div class="engines-grid">
      <img
        v-reveal
        :src="images.engine.src"
        :alt="images.engine.alt"
        :width="shot.width"
        :height="shot.height"
        loading="lazy"
      />
      <div class="engines-body">
        <p v-reveal class="statement">
          XMRig is the supported engine. XMRigCC and XLArig are experimental and say so in the app.
          Bundled APKs carry all three for 64-bit and 32-bit ARM phones.
        </p>
        <div
          v-reveal
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Engine comparison, scrollable"
        >
          <table>
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
                <th scope="row">{{ row.name }}</th>
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
