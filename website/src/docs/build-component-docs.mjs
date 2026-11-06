// Reads every src/components/*.vue and writes src/docs/components.generated.json:
// props, emits, defaults, imports and style location, straight from the source.
// Run: npm run docs:components
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const dir = join(root, 'src', 'components');
const styleFiles = readdirSync(join(root, 'src', 'styles')).filter((f) => f.endsWith('.css'));
const styles = styleFiles.map((f) => [f, readFileSync(join(root, 'src', 'styles', f), 'utf8')]);

const members = (typeNode, sf) =>
  typeNode.members.filter(ts.isPropertySignature).map((m) => {
    const doc = ts.getJSDocCommentsAndTags(m)[0];
    return {
      name: m.name.getText(sf),
      type: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : 'unknown',
      required: !m.questionToken,
      description: doc && typeof doc.comment === 'string' ? doc.comment : ''
    };
  });

const analyse = (code) => {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const aliases = new Map();
  sf.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n)) aliases.set(n.name.text, n);
    if (ts.isTypeAliasDeclaration(n) && ts.isTypeLiteralNode(n.type))
      aliases.set(n.name.text, n.type);
  });
  const resolve = (node) => {
    if (ts.isTypeLiteralNode(node)) return members(node, sf);
    if (ts.isTypeReferenceNode(node)) {
      const found = aliases.get(node.typeName.getText(sf));
      if (found) return members(found, sf);
      // Pick<...>, imported types and the like are listed as one opaque entry, not guessed.
      return null;
    }
    return null;
  };
  let props = [];
  let emits = [];
  let defaults = {};
  let model = [];
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(sf);
      if (
        name === 'withDefaults' &&
        n.arguments[1] &&
        ts.isObjectLiteralExpression(n.arguments[1])
      ) {
        for (const p of n.arguments[1].properties) {
          if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
            defaults[p.name.getText(sf)] = ts.isPropertyAssignment(p)
              ? p.initializer.getText(sf)
              : p.name.getText(sf);
        }
      }
      if (name === 'defineProps' && n.typeArguments?.[0]) props = resolve(n.typeArguments[0]) ?? [];
      if (
        name === 'defineEmits' &&
        n.typeArguments?.[0] &&
        ts.isTypeLiteralNode(n.typeArguments[0])
      ) {
        emits = n.typeArguments[0].members.filter(ts.isPropertySignature).map((m) => ({
          name: m.name.getText(sf).replace(/^['"]|['"]$/g, ''),
          payload: m.type
            ? m.type
                .getText(sf)
                .replace(/^\[|\]$/g, '')
                .trim()
            : ''
        }));
      }
      if (name === 'defineModel') model.push(n.getText(sf));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { props, emits, defaults, model };
};

const out = [];
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith('.vue'))
  .sort()) {
  const source = readFileSync(join(dir, file), 'utf8');
  const { descriptor } = parse(source);
  const script = descriptor.scriptSetup?.content ?? descriptor.script?.content ?? '';
  const info = analyse(script);
  const imports = [...script.matchAll(/^import\s.+?from\s+'([^']+)';/gms)].map((m) => m[1]);
  const rootClass =
    /<template>\s*<[a-zA-Z-]+[^>]*?class="([^"]+)"/s.exec(source)?.[1].split(/\s+/)[0] ?? null;
  const styleFile = rootClass ? styles.find(([, css]) => css.includes(`.${rootClass}`))?.[0] : null;
  out.push({
    name: file.replace(/\.vue$/, ''),
    source: `src/components/${file}`,
    props: info.props,
    // An opaque props type (e.g. Pick<>) leaves the list empty; the page then points at the source.
    propsResolved: info.props.length > 0 || !/defineProps</.test(script),
    defaults: info.defaults,
    emits: info.emits,
    slots: [
      ...new Set([...source.matchAll(/<slot(?:\s+name="([^"]+)")?/g)].map((m) => m[1] ?? 'default'))
    ],
    imports,
    scopedStyle: Boolean(descriptor.styles.some((s) => s.scoped)),
    rootClass,
    styleFile: styleFile ? `src/styles/${styleFile}` : null,
    usesI18n: imports.includes('../i18n')
  });
}
writeFileSync(
  join(root, 'website', 'src', 'docs', 'components.generated.json'),
  JSON.stringify(out, null, 2) + '\n'
);
stdout.write(`Wrote ${out.length} components.
`);
