/**
 * Verifies every language ships the same set of copy keys, that no string was
 * left untranslated by accident, and that placeholders match across languages.
 *
 *   node scripts/i18n-check.mjs
 *
 * TypeScript already forces the Kiswahili dictionary to satisfy the English
 * shape. This adds the checks the type system cannot make: identical arrays
 * lengths, matching `{placeholders}`, and copy that is still English on the
 * Kiswahili side.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "src", "lib", "i18n", "dictionaries");

/**
 * The dictionaries are plain object literals, so they can be read without a
 * TypeScript build step: strip the imports, types and `export`, then evaluate.
 */
async function loadDictionary(file, name) {
  const source = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = source
    .replace(/^import[\s\S]*?;$/gm, "")
    .replace(/export const \w+(?:\s*:\s*Dictionary)?\s*=/, "return")
    .replace(/^export type[\s\S]*?;$/gm, "");
  try {
    return new Function(body)();
  } catch (error) {
    throw new Error(`could not read the ${name} dictionary: ${error.message}`);
  }
}

function flatten(value, prefix = "", out = new Map()) {
  if (Array.isArray(value)) {
    out.set(prefix, value);
    value.forEach((item, i) => {
      if (typeof item === "string") out.set(`${prefix}[${i}]`, item);
      else flatten(item, `${prefix}[${i}]`, out);
    });
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, value);
  return out;
}

function placeholders(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/**
 * Copy that is legitimately identical in both languages: proper nouns, the
 * language self-labels, placeholder formats and phrases Kiswahili already owns.
 */
const SHARED_ON_PURPOSE = new Set([
  "header.cart",
  "footer.company",
  "checkout.fullNamePlaceholder",
  "checkout.phonePlaceholder",
  "contact.whatsappTitle",
  "track.orderNumberPlaceholder",
  "track.phonePlaceholder",
  "language.continueEnglish",
  "language.continueSwahili",
  "product.photoAlt",
]);

const problems = [];

const en = await loadDictionary("en.ts", "English");
const sw = await loadDictionary("sw.ts", "Kiswahili");

const flatEn = flatten(en);
const flatSw = flatten(sw);

for (const key of flatEn.keys()) {
  if (!flatSw.has(key)) problems.push(`missing in sw: ${key}`);
}
for (const key of flatSw.keys()) {
  if (!flatEn.has(key)) problems.push(`extra in sw (not in en): ${key}`);
}

for (const [key, value] of flatEn) {
  const other = flatSw.get(key);
  if (other === undefined) continue;

  if (Array.isArray(value)) {
    if (!Array.isArray(other) || other.length !== value.length) {
      problems.push(`array length differs: ${key} (en ${value.length}, sw ${other?.length})`);
    }
    continue;
  }

  if (typeof value !== "string") continue;

  if (typeof other !== "string") {
    problems.push(`type differs: ${key}`);
    continue;
  }

  if (!other.trim()) problems.push(`empty translation: ${key}`);

  const a = placeholders(value).join(",");
  const b = placeholders(other).join(",");
  if (a !== b) problems.push(`placeholders differ: ${key} (en {${a}}, sw {${b}})`);

  if (value === other && !SHARED_ON_PURPOSE.has(key) && /[a-z]{4}/i.test(value)) {
    problems.push(`untranslated (identical to English): ${key} — "${value}"`);
  }
}

const keyCount = [...flatEn.keys()].filter((k) => !k.includes("[")).length;

if (problems.length) {
  console.error("i18n check failed:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\n${problems.length} problem(s) across ${keyCount} keys.`);
  process.exit(1);
}

console.log(`i18n check passed — ${keyCount} keys, en + sw in sync.`);
