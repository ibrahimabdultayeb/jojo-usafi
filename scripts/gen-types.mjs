#!/usr/bin/env node
/**
 * Generate `src/lib/supabase/database.types.ts` from the REAL hosted schema.
 *
 * This is the one file in the repository that is written by a machine reading a
 * database rather than by a person reading a migration. That is the point: from
 * Build 06 onward the TypeScript shape of every table is evidence, not a claim.
 *
 *   node scripts/gen-types.mjs            regenerate the file
 *   node scripts/gen-types.mjs --check    fail if the committed file has drifted
 *
 * `--check` is how a migration that was applied but never re-generated gets
 * caught. It needs the linked development project, so it belongs to the database
 * gate (`npm run test:db`), not to the offline one.
 *
 * The project is pinned rather than taken from whatever happens to be linked:
 * generating types from the wrong database would be a silent, believable lie.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TARGET = join(ROOT, "src", "lib", "supabase", "database.types.ts");

/** The Jojo Usafi development project. Free tier, ap-south-1, no billing. */
const PROJECT_REF = "dyjhacbbedytcstxxjzl";

const HEADER = `/**
 * ============================================================================
 * GENERATED FROM THE REAL DATABASE — DO NOT EDIT BY HAND
 * ============================================================================
 *
 * Produced by \`npm run db:types\`, which runs
 *
 *     supabase gen types typescript --project-id ${PROJECT_REF} --schema public
 *
 * against the hosted Jojo Usafi development project. Every type below was read
 * out of PostgreSQL's own catalogue after the migrations in supabase/migrations
 * were applied to it, so a column here exists, is spelled this way and is
 * nullable exactly this much.
 *
 * Hand edits are lost on the next generation, and \`npm run db:types:check\`
 * fails the database gate if this file and the database have drifted apart.
 *
 * The friendly aliases the application imports — \`ProductRow\`, \`OrderRow\`,
 * \`AdminRoleValue\` and the rest — are derived from this file in \`./types.ts\`,
 * so they cannot describe a column that is not really there.
 * ============================================================================
 */

`;

const checkOnly = process.argv.includes("--check");

// One command string rather than an argv array, because `shell: true` is needed
// for `npx` to resolve on Windows and Node warns about combining the two. Every
// part of this command is a constant declared above; nothing here is user input.
const result = spawnSync(
  `npx supabase gen types typescript --project-id ${PROJECT_REF} --schema public`,
  { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error("supabase gen types failed:\n");
  console.error(result.stderr || result.stdout || "(no output)");
  process.exit(1);
}

const body = result.stdout;

if (!body.includes("export type Database") || !body.includes("admin_profiles")) {
  console.error("supabase gen types produced output that does not look like the schema.");
  console.error(body.slice(0, 500));
  process.exit(1);
}

// Normalise the line endings so a Windows checkout and a Linux CI agree on
// whether the file has changed. .gitattributes already does this for Git; this
// makes the --check comparison agree with it.
const next = (HEADER + body).replace(/\r\n/g, "\n");

if (checkOnly) {
  let committed;
  try {
    committed = readFileSync(TARGET, "utf8").replace(/\r\n/g, "\n");
  } catch {
    console.error(`${TARGET} does not exist. Run: npm run db:types`);
    process.exit(1);
  }

  if (committed !== next) {
    console.error(
      "The generated database types have drifted from the database.\n\n" +
        "  The hosted development schema and src/lib/supabase/database.types.ts\n" +
        "  no longer agree. Usually this means a migration was applied without\n" +
        "  regenerating the types.\n\n" +
        "  Fix:  npm run db:types\n",
    );
    process.exit(1);
  }

  console.log(`Database types match the live schema of ${PROJECT_REF}.`);
  process.exit(0);
}

writeFileSync(TARGET, next, "utf8");

const tablesBlock = next.match(/\n {4}Tables: \{\n([\s\S]*?)\n {4}\}\n {4}Views:/);
const tables = tablesBlock ? [...tablesBlock[1].matchAll(/^ {6}(\w+): \{$/gm)].length : 0;
const views = [...next.matchAll(/\n {4}Views: \{\n([\s\S]*?)\n {4}\}\n {4}Functions:/g)]
  .flatMap((m) => [...m[1].matchAll(/^ {6}(\w+): \{$/gm)]).length;

console.log(`Wrote src/lib/supabase/database.types.ts from project ${PROJECT_REF}.`);
console.log(`  ${next.split("\n").length} lines, ${tables} tables, ${views} views.`);
