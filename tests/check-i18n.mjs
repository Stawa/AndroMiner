// Verifies that every locale catalog stays in step with English and with the code that uses it.
// Run with `npm run i18n:check`; exits non-zero on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const sourceDir = path.join(root, 'src');
const base = 'en';

const flatten = (node, prefix = '', out = new Map()) => {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
};

const placeholders = (message) =>
  [...new Set([...String(message).matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

const sourceFiles = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join(sourceDir, 'i18n', 'locales')) sourceFiles(full, found);
    } else if (/\.(vue|ts)$/.test(entry.name) && !full.includes(`${path.sep}stats${path.sep}`)) {
      found.push(full);
    }
  }
  return found;
};

export const checkLocales = () => {
  const problems = [];
  const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json'));
  const catalogs = new Map(
    files.map((file) => [
      path.basename(file, '.json'),
      flatten(JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8')))
    ])
  );
  const reference = catalogs.get(base);
  if (!reference) return [`Missing base catalog ${base}.json`];

  for (const [locale, catalog] of catalogs) {
    if (locale === base) continue;
    for (const key of reference.keys()) {
      if (!catalog.has(key)) problems.push(`[${locale}] missing key: ${key}`);
    }
    for (const [key, value] of catalog) {
      if (!reference.has(key)) {
        problems.push(`[${locale}] unknown key (not in ${base}): ${key}`);
        continue;
      }
      if (typeof value !== 'string' || !value.trim()) problems.push(`[${locale}] empty: ${key}`);
      else if (placeholders(value).join() !== placeholders(reference.get(key)).join()) {
        problems.push(
          `[${locale}] placeholders differ from ${base}: ${key} ` +
            `(${placeholders(value).join(', ')} vs ${placeholders(reference.get(key)).join(', ')})`
        );
      }
    }
  }
  return problems;
};

export const checkUsage = () => {
  const problems = [];
  const keys = [
    ...flatten(JSON.parse(fs.readFileSync(path.join(localeDir, `${base}.json`), 'utf8'))).keys()
  ];
  const source = sourceFiles(sourceDir)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  // Static keys passed straight to t()/$t()/te() must exist.
  const known = new Set(keys);
  for (const match of source.matchAll(/(?:\$t|\bt|\bte)\(\s*(['"])([\w.-]+)\1/g)) {
    if (match[2].includes('.') && !known.has(match[2])) {
      problems.push(`code references missing key: ${match[2]}`);
    }
  }

  // Dynamic keys such as `profile.${id}` keep every key under that prefix alive.
  const dynamicPrefixes = [...source.matchAll(/`([\w.-]+\.)\$\{/g)].map((match) => match[1]);
  for (const key of keys) {
    const used =
      source.includes(`'${key}'`) ||
      source.includes(`"${key}"`) ||
      dynamicPrefixes.some((prefix) => key.startsWith(prefix));
    if (!used) problems.push(`unused key: ${key}`);
  }
  return problems;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = [...checkLocales(), ...checkUsage()];
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} translation problem(s) found.`);
    process.exit(1);
  }
  console.log('Translations are complete and consistent.');
}
