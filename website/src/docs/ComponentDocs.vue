<script setup lang="ts">
import { computed } from 'vue';
import generated from './components.generated.json';
import { categories, notes, type ComponentCategory } from './componentNotes';
import { slugify } from './markdown';

interface Prop {
  name: string;
  type: string;
  required: boolean;
  description: string;
}
interface Doc {
  name: string;
  source: string;
  props: Prop[];
  propsResolved: boolean;
  defaults: Record<string, string>;
  emits: { name: string; payload: string }[];
  slots: string[];
  imports: string[];
  scopedStyle: boolean;
  rootClass: string | null;
  styleFile: string | null;
  usesI18n: boolean;
}

const props = defineProps<{ category: ComponentCategory }>();

const docs = computed(() =>
  (generated as unknown as Doc[]).filter((doc) => notes[doc.name]?.category === props.category)
);
const intro = computed(() => categories.find((c) => c.id === props.category)?.intro ?? '');

const literals = (type: string): string[] | null => {
  const parts = type.split('|').map((part) => part.trim());
  return parts.length > 1 && parts.every((part) => /^'[^']*'$/.test(part))
    ? parts.map((part) => part.slice(1, -1))
    : null;
};
const states = (doc: Doc): { prop: string; values: string[] }[] =>
  doc.props.flatMap((p) => {
    const values = literals(p.type);
    return values ? [{ prop: p.name, values }] : [];
  });

const projectImports = (doc: Doc): string[] =>
  doc.imports.filter((i) => i.startsWith('.') || i.startsWith('@capacitor') || i === 'vue-chartjs');

const usage = (doc: Doc): string => {
  const lines: string[] = [];
  for (const p of doc.props) {
    if (p.name === 'modelValue') lines.push('  v-model="value"');
    else if (p.required) lines.push(`  :${p.name}="${p.name}"`);
  }
  for (const e of doc.emits) {
    if (e.name.startsWith('update:')) continue;
    lines.push(`  @${e.name}="on${e.name[0]!.toUpperCase()}${e.name.slice(1)}"`);
  }
  const tag = lines.length ? `<${doc.name}\n${lines.join('\n')}\n/>` : `<${doc.name} />`;
  return `import ${doc.name} from '../components/${doc.name}.vue';\n\n${tag}`;
};
</script>

<template>
  <p class="lead">{{ intro }}</p>
  <article v-for="doc in docs" :key="doc.name" class="component-doc">
    <h2 :id="slugify(doc.name)">{{ doc.name }}</h2>
    <p>{{ notes[doc.name]?.purpose }}</p>
    <dl class="meta">
      <dt>Source</dt>
      <dd>
        <a :href="`https://github.com/Stawa/AndroMiner/blob/main/${doc.source}`"
          ><code>{{ doc.source }}</code></a
        >
      </dd>
      <dt>Dependencies</dt>
      <dd>
        <template v-if="projectImports(doc).length">
          <code v-for="(imp, i) in projectImports(doc)" :key="imp"
            >{{ imp }}<template v-if="i < projectImports(doc).length - 1">, </template></code
          >
        </template>
        <template v-else>Vue only</template>
        <template v-if="doc.usesI18n"> · Uses i18n</template>
      </dd>
      <dt>Styling</dt>
      <dd>
        <template v-if="doc.styleFile && doc.rootClass"
          >Root class <code>.{{ doc.rootClass }}</code> is styled in
          <code>{{ doc.styleFile }}</code></template
        >
        <template v-else-if="doc.rootClass">Tailwind utility classes on the root element</template>
        <template v-else>Inherits styling from the parent</template>
        <template v-if="doc.scopedStyle"> · has scoped styles</template>
      </dd>
    </dl>

    <h3>Props</h3>
    <div
      v-if="doc.props.length"
      class="table-wrap"
      tabindex="0"
      role="region"
      :aria-label="`${doc.name} props, scrollable`"
    >
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in doc.props" :key="p.name">
            <td>
              <code>{{ p.name }}</code
              ><span v-if="p.required" class="req"> required</span>
            </td>
            <td>
              <code>{{ p.type }}</code>
            </td>
            <td>
              <code v-if="doc.defaults[p.name] !== undefined">{{ doc.defaults[p.name] }}</code
              ><template v-else>—</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="doc.propsResolved">None.</p>
    <p v-else>
      The props use a type that is not expanded here. Read the source file above for the exact
      shape.
    </p>

    <h3>Events</h3>
    <div
      v-if="doc.emits.length"
      class="table-wrap"
      tabindex="0"
      role="region"
      :aria-label="`${doc.name} events, scrollable`"
    >
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in doc.emits" :key="e.name">
            <td>
              <code>{{ e.name }}</code>
            </td>
            <td>
              <code v-if="e.payload">{{ e.payload }}</code
              ><template v-else>none</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>None.</p>

    <template v-if="doc.slots.length">
      <h3>Slots</h3>
      <p>
        <code v-for="(slot, i) in doc.slots" :key="slot"
          >{{ slot }}<template v-if="i < doc.slots.length - 1">, </template></code
        >
      </p>
    </template>

    <template v-if="states(doc).length">
      <h3>Variants and states</h3>
      <ul>
        <li v-for="s in states(doc)" :key="s.prop">
          <code>{{ s.prop }}</code
          >:
          <template v-for="(v, i) in s.values" :key="v"
            ><code>{{ v }}</code
            ><template v-if="i < s.values.length - 1">, </template></template
          >
        </li>
      </ul>
    </template>

    <template v-if="notes[doc.name]?.notes?.length">
      <h3>Implementation notes</h3>
      <ul>
        <li v-for="note in notes[doc.name]!.notes" :key="note">{{ note }}</li>
      </ul>
    </template>

    <h3>Usage</h3>
    <div class="code-block" data-lang="vue">
      <button type="button" class="copy-code">Copy</button>
      <pre><code class="hljs">{{ usage(doc) }}</code></pre>
    </div>
  </article>
</template>
