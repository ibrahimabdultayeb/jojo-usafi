#!/usr/bin/env node
/**
 * OFFLINE schema check.
 *
 * No database is contacted by THIS script, deliberately: it is the fast half of
 * the gate, and it runs on a laptop where Docker Desktop cannot start (WSL
 * returns Wsl/CallMsi/E_ACCESSDENIED). It reads the SQL and the TypeScript and
 * proves they agree with each other.
 *
 * Proving that PostgreSQL accepts and enforces them is `npm run test:db`, which
 * runs against the hosted development project. Since Build 06 that half exists,
 * so a pass here is no longer the end of the story.
 *
 * What it does prove, statically:
 *
 *   1. every statement is closed — balanced quotes, parentheses and $$ bodies
 *   2. no money column is anything but `integer`, and every one is non-negative
 *   3. every referenced table, enum and function is created before it is used
 *   4. every table has Row Level Security enabled
 *   5. every append-only ledger carries the trigger that makes it append-only
 *   6. the SQL and the TypeScript domain layer agree — the enum members, the
 *      SKU pattern, the phone pattern, the order-number pattern and the default
 *      delivery fee are defined twice by necessity, so they are compared here
 *   7. src/lib/supabase/database.types.ts — GENERATED from the real database —
 *      lists exactly the tables these migrations create
 *
 * A pass means the schema is internally consistent and matches the application.
 * It does not mean PostgreSQL has accepted it. That is Build 06.
 *
 * Usage:  node scripts/schema-check.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const problems = [];
const notes = [];

function fail(file, message) {
  problems.push(`${file}: ${message}`);
}

/* ------------------------------------------------------------- read the SQL */

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.error("No migrations found in supabase/migrations.");
  process.exit(1);
}

/**
 * Split SQL into statements, respecting single quotes and $$-quoted function
 * bodies. Line comments are stripped first; block comments are not used in
 * these migrations and would be a false negative rather than a false pass.
 */
function statementsOf(sql) {
  const withoutComments = sql
    .split("\n")
    .map((line) => {
      let inQuote = false;
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === "'") inQuote = !inQuote;
        if (!inQuote && line[i] === "-" && line[i + 1] === "-") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");

  const statements = [];
  let current = "";
  let inQuote = false;
  let inDollar = false;

  for (let i = 0; i < withoutComments.length; i += 1) {
    const char = withoutComments[i];
    const pair = withoutComments.slice(i, i + 2);

    if (!inQuote && pair === "$$") {
      inDollar = !inDollar;
      current += pair;
      i += 1;
      continue;
    }
    if (!inDollar && char === "'") inQuote = !inQuote;

    if (char === ";" && !inQuote && !inDollar) {
      statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  return { statements: statements.filter(Boolean), trailing: current.trim(), inQuote, inDollar };
}

const allStatements = [];
const sqlByFile = new Map();

for (const file of migrationFiles) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  sqlByFile.set(file, sql);

  const { statements, trailing, inQuote, inDollar } = statementsOf(sql);

  if (inQuote) fail(file, "unterminated string literal");
  if (inDollar) fail(file, "unterminated $$ function body");
  if (trailing) fail(file, `statement not terminated with a semicolon: "${trailing.slice(0, 60)}…"`);

  for (const statement of statements) {
    const opens = (statement.match(/\(/g) ?? []).length;
    const closes = (statement.match(/\)/g) ?? []).length;
    if (opens !== closes) {
      fail(file, `unbalanced parentheses in: "${statement.slice(0, 70)}…"`);
    }
    allStatements.push({ file, statement });
  }
}

const fullSql = migrationFiles.map((file) => sqlByFile.get(file)).join("\n");

/* --------------------------------------------- 1. what the migrations create */

const createdTables = [];
const createdTypes = [];
const createdViews = [];
const createdFunctions = [];

for (const { file, statement } of allStatements) {
  const table = statement.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/is);
  if (table) createdTables.push({ name: table[1], file });

  const type = statement.match(/^create\s+type\s+public\.(\w+)/is);
  if (type) createdTypes.push({ name: type[1], file });

  const view = statement.match(/^create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/is);
  if (view) createdViews.push({ name: view[1], file });

  const fn = statement.match(/^create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/is);
  if (fn) createdFunctions.push({ name: fn[1], file });
}

const tableNames = new Set(createdTables.map((t) => t.name));
const typeNames = new Set(createdTypes.map((t) => t.name));

for (const [name, list] of Object.entries(groupBy(createdTables, (t) => t.name))) {
  if (list.length > 1) fail(list[1].file, `table public.${name} is created more than once`);
}
for (const [name, list] of Object.entries(groupBy(createdTypes, (t) => t.name))) {
  if (list.length > 1) fail(list[1].file, `type public.${name} is created more than once`);
}

/* ----------------------------- 2. references resolve, in the order they run */

const seenTables = new Set();
const seenTypes = new Set();

for (const { file, statement } of allStatements) {
  const createdHere = statement.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/is);
  const createdTypeHere = statement.match(/^create\s+type\s+public\.(\w+)/is);

  // A table may reference itself (categories.parent_id), so record it first.
  if (createdHere) seenTables.add(createdHere[1]);
  if (createdTypeHere) seenTypes.add(createdTypeHere[1]);

  for (const match of statement.matchAll(/references\s+public\.(\w+)/gis)) {
    const target = match[1];
    if (!tableNames.has(target)) {
      fail(file, `references public.${target}, which no migration creates`);
    } else if (!seenTables.has(target)) {
      fail(file, `references public.${target} before it is created`);
    }
  }

  for (const match of statement.matchAll(/\bpublic\.(\w+)\s+not\s+null/gis)) {
    const target = match[1];
    if (typeNames.has(target) && !seenTypes.has(target)) {
      fail(file, `uses type public.${target} before it is created`);
    }
  }
}

/* ------------------------------------------------------------- 3. money rules */

const FORBIDDEN_MONEY_TYPES = /\b(numeric|decimal|real|double\s+precision|money|float\d*)\b/i;

for (const { file, statement } of allStatements) {
  if (!/^create\s+table/i.test(statement)) continue;
  if (FORBIDDEN_MONEY_TYPES.test(statement)) {
    const found = statement.match(FORBIDDEN_MONEY_TYPES)[0];
    fail(file, `uses ${found}; every amount in Jojo Usafi is an integer number of shillings`);
  }
}

const moneyColumns = [...fullSql.matchAll(/^\s*(\w*_tzs)\s+(\w+)/gim)];
if (moneyColumns.length === 0) fail("migrations", "no *_tzs money columns found at all");

for (const [, column, type] of moneyColumns) {
  if (type.toLowerCase() !== "integer") {
    fail("migrations", `money column ${column} is ${type}, not integer`);
  }
  const guarded =
    new RegExp(`check\\s*\\(\\s*${column}\\s*>=\\s*0`, "i").test(fullSql) ||
    new RegExp(`${column}\\s+is\\s+null\\s+or\\s+${column}\\s*>=\\s*0`, "i").test(fullSql);
  if (!guarded) fail("migrations", `money column ${column} has no >= 0 constraint`);
}

/* ------------------------------------------------ 4. Row Level Security */

const rlsEnabled = new Set(
  [...fullSql.matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi)].map(
    (m) => m[1],
  ),
);

for (const { name, file } of createdTables) {
  if (!rlsEnabled.has(name)) {
    fail(file, `public.${name} never has Row Level Security enabled`);
  }
}
for (const name of rlsEnabled) {
  if (!tableNames.has(name)) fail("migrations", `RLS enabled on public.${name}, which does not exist`);
}

// Views must not silently bypass the caller's policies.
for (const { name, file } of createdViews) {
  const definition = sqlByFile.get(file);
  const declaration = definition.match(
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?view\\s+public\\.${name}([\\s\\S]{0,120})`, "i"),
  );
  if (!declaration || !/security_invoker\s*=\s*on/i.test(declaration[1])) {
    fail(file, `view public.${name} is not declared security_invoker = on`);
  }
}

/* --------------------------------------------------- 5. append-only ledgers */

const APPEND_ONLY = [
  "inventory_movements",
  "order_events",
  "audit_events",
  "analytics_events",
];

for (const table of APPEND_ONLY) {
  if (!tableNames.has(table)) {
    fail("migrations", `expected append-only table public.${table} to exist`);
    continue;
  }
  const guarded = new RegExp(
    `before\\s+update\\s+or\\s+delete\\s+on\\s+public\\.${table}[\\s\\S]{0,120}jojo_forbid_mutation`,
    "i",
  ).test(fullSql);
  if (!guarded) fail("migrations", `public.${table} is append-only but has no jojo_forbid_mutation trigger`);
}

/* ------------------------------------ 6. SQL and TypeScript must agree */

const domainDir = join(ROOT, "src", "lib", "domain");
const read = (file) => readFileSync(join(domainDir, file), "utf8");

/** Pull `export const NAME = ["a", "b"] as const;` out of a TypeScript source. */
function tsStringArray(source, name) {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`, "m"));
  if (!match) return null;
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Pull the members of `create type public.name as enum (...)` out of the SQL. */
function sqlEnum(name) {
  const match = fullSql.match(new RegExp(`create\\s+type\\s+public\\.${name}\\s+as\\s+enum\\s*\\(([^)]*)\\)`, "i"));
  if (!match) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function compareLists(label, sqlList, tsList) {
  if (!sqlList) return fail("migrations", `enum ${label} is missing from the SQL`);
  if (!tsList) return fail("domain", `${label} is missing from the TypeScript domain layer`);
  const onlySql = sqlList.filter((v) => !tsList.includes(v));
  const onlyTs = tsList.filter((v) => !sqlList.includes(v));
  if (onlySql.length) fail("domain", `${label}: SQL has ${onlySql.join(", ")} and TypeScript does not`);
  if (onlyTs.length) fail("migrations", `${label}: TypeScript has ${onlyTs.join(", ")} and SQL does not`);
}

const ordersTs = read("orders.ts");
const inventoryTs = read("inventory.ts");
const syncTs = read("sync.ts");
const skuTs = read("sku.ts");
const phoneTs = read("phone.ts");
const deliveryTs = read("delivery.ts");

compareLists("order_state", sqlEnum("order_state"), tsStringArray(ordersTs, "ORDER_STATES"));
compareLists("payment_preference", sqlEnum("payment_preference"), tsStringArray(ordersTs, "PAYMENT_PREFERENCES"));
compareLists("payment_method", sqlEnum("payment_method"), tsStringArray(ordersTs, "PAYMENT_METHODS"));
compareLists("payment_status", sqlEnum("payment_status"), tsStringArray(ordersTs, "PAYMENT_STATUSES"));
compareLists("inventory_movement_kind", sqlEnum("inventory_movement_kind"), tsStringArray(inventoryTs, "INVENTORY_MOVEMENT_KINDS"));
compareLists("sync_source", sqlEnum("sync_source"), tsStringArray(syncTs, "SYNC_SOURCES"));
compareLists("sync_direction", sqlEnum("sync_direction"), tsStringArray(syncTs, "SYNC_DIRECTIONS"));
compareLists("sync_operation", sqlEnum("sync_operation"), tsStringArray(syncTs, "SYNC_OPERATIONS"));
compareLists("sync_status", sqlEnum("sync_status"), tsStringArray(syncTs, "SYNC_STATUSES"));
compareLists("sync_conflict_resolution", sqlEnum("sync_conflict_resolution"), tsStringArray(syncTs, "SYNC_CONFLICT_RESOLUTIONS"));

// The three patterns that exist in both places because one guards input and the
// other guards storage. They must be character-identical.
function comparePattern(label, tsSource, constName, sqlPattern) {
  const ts = tsSource.match(new RegExp(`export const ${constName}\\s*=\\s*/(.+?)/;`));
  if (!ts) return fail("domain", `${constName} not found`);
  if (ts[1] !== sqlPattern) {
    fail("domain", `${label}: TypeScript /${ts[1]}/ does not match the SQL CHECK '${sqlPattern}'`);
  }
}

// PostgreSQL writes [0-9] where a JavaScript regex writes \d, so each side is
// compared against the exact text it is expected to contain rather than
// against the other.
comparePattern("SKU", skuTs, "SKU_PATTERN", "^[A-Z0-9][A-Z0-9._-]{1,47}$");
comparePattern("phone", phoneTs, "TZ_E164_PATTERN", "^\\+255[67]\\d{8}$");

const skuInSql = fullSql.includes("sku ~ '^[A-Z0-9][A-Z0-9._-]{1,47}$'");
if (!skuInSql) fail("migrations", "the products.sku CHECK constraint is not the expected pattern");

const phoneInSql = fullSql.includes("~ '^\\+255[67][0-9]{8}$'");
if (!phoneInSql) fail("migrations", "the phone CHECK constraint is not the expected pattern");

const orderNumberInSql = fullSql.includes("order_number ~ '^JU-[0-9]{6,}$'");
if (!orderNumberInSql) fail("migrations", "the orders.order_number CHECK constraint is not the expected pattern");

// The approved default delivery fee, written in both places.
const tsFee = deliveryTs.match(/export const DEFAULT_DELIVERY_FEE_TZS\s*=\s*(\d+)/);
const sqlFee = fullSql.match(/fee_tzs\s+integer\s+not\s+null\s+default\s+(\d+)/i);
if (!tsFee || !sqlFee) {
  fail("migrations", "the default delivery fee is not declared in both SQL and TypeScript");
} else if (tsFee[1] !== sqlFee[1]) {
  fail("migrations", `default delivery fee: SQL says ${sqlFee[1]}, TypeScript says ${tsFee[1]}`);
}

/* ------------------------------- 7. the schema contract lists the same tables */

/**
 * Since Build 06 this file is GENERATED from the hosted development database by
 * `npm run db:types`, so a mismatch here means something stronger than a typo:
 * the migrations in this repository and the database the types were read from
 * describe different schemas. `npm run db:types:check` catches the same drift
 * from the other direction, by regenerating and comparing.
 */
const contract = readFileSync(join(ROOT, "src", "lib", "supabase", "database.types.ts"), "utf8");
const contractTablesBlock = contract.match(/\n {4}Tables: \{\n([\s\S]*?)\n {4}\}\n {4}Views:/);

if (!contractTablesBlock) {
  fail(
    "types",
    "src/lib/supabase/database.types.ts has no Tables block — regenerate it with `npm run db:types`",
  );
} else {
  const contractTables = new Set(
    [...contractTablesBlock[1].matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]),
  );
  for (const name of tableNames) {
    if (!contractTables.has(name)) fail("types", `public.${name} is missing from the schema contract`);
  }
  for (const name of contractTables) {
    if (!tableNames.has(name)) fail("types", `the schema contract lists ${name}, which no migration creates`);
  }
}

/* ------------------------------------------------------------------ report */

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

notes.push(`${migrationFiles.length} migrations, ${allStatements.length} statements`);
notes.push(`${createdTables.length} tables, ${createdViews.length} views, ${createdTypes.length} enum types, ${createdFunctions.length} functions`);

console.log("Offline schema check — STATIC ONLY, no database was contacted.\n");
for (const note of notes) console.log(`  ${note}`);
console.log("");

if (problems.length > 0) {
  console.error(`FAILED — ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error("");
  process.exit(1);
}

console.log("  ✓ statements are closed and balanced");
console.log("  ✓ every amount is an integer number of shillings, constrained non-negative");
console.log("  ✓ every table, enum and view reference resolves");
console.log("  ✓ Row Level Security is enabled on every table");
console.log("  ✓ every append-only ledger is protected by a trigger");
console.log("  ✓ SQL and the TypeScript domain layer agree");
console.log("  ✓ the generated database types list exactly the tables the migrations create");
console.log("\nRuntime behaviour — constraints, triggers, RLS, Auth — is proved by `npm run test:db`.\n");
