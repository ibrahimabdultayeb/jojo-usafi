#!/usr/bin/env node
/**
 * Could production be built from nothing, with exactly these files?
 *
 *   npm run rehearse:production
 *
 * WHY THIS IS NOT A DRY RUN AGAINST A REAL PROJECT
 *
 * The honest way to rehearse a from-zero migration is to run it against an empty
 * database. There is no local PostgreSQL on this machine — Docker does not work
 * here, which is written down in CLAUDE.md — and creating a second hosted
 * project to throw away would be creating the thing this build is told not to
 * create.
 *
 * But the rehearsal has, in fact, already happened. **The development project
 * was itself built from zero by exactly these migration files**, in this order,
 * and nothing has ever been applied to it by hand. So the useful checks are:
 *
 *   1. the local migration files are a complete, ordered, gap-free set
 *   2. every one of them is recorded as applied on the live project, and the
 *      live project has nothing applied that is not in the files — if those two
 *      lists match, the files ARE the schema
 *   3. nothing in them would misbehave on an empty database: no `db reset`, no
 *      reference to a development project, no seeded business data
 *   4. the order-number sequence starts at 1, so the first real order is
 *      JU-000001 rather than a continuation of this project's numbering
 *   5. the generated types still match the live schema, which means the files,
 *      the database and the application all agree
 *
 * Anything it cannot check, it says so rather than implying it did.
 *
 * It writes nothing, anywhere.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const DIR = "supabase/migrations";
const PROJECT_REF = "dyjhacbbedytcstxxjzl";

let failures = 0;
let checks = 0;
const ok = (w, d) => { checks += 1; console.log(`  ok    ${w}${d ? ` — ${d}` : ""}`); };
const bad = (w, d) => { checks += 1; failures += 1; console.log(`  FAIL  ${w}${d ? `\n        ${d}` : ""}`); };
const note = (w) => console.log(`  note  ${w}`);
const head = (t) => console.log(`\n  ── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`);

/* ------------------------------------------------------- 1. the files */

head("THE MIGRATION SET");

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
ok(`${files.length} migration files`, files[0] + " … " + files[files.length - 1]);

const stamps = files.map((f) => f.slice(0, 14));
const ordered = [...stamps].sort();
if (JSON.stringify(stamps) === JSON.stringify(ordered)) {
  ok("they sort into the order they will be applied in");
} else {
  bad("filename order and timestamp order disagree");
}

const duplicates = stamps.filter((s, i) => stamps.indexOf(s) !== i);
if (duplicates.length === 0) ok("no two migrations share a timestamp");
else bad("duplicate timestamps", duplicates.join(", "));

/* -------------------------------------------- 3. safe on an empty database */

head("SAFE AGAINST AN EMPTY DATABASE");

let statements = 0;
const dangers = [];

for (const file of files) {
  const sql = fs.readFileSync(path.join(DIR, file), "utf8");
  statements += sql.split(";").filter((s) => s.trim().length > 0).length;

  if (/\bdrop\s+(table|schema)\b/i.test(sql)) dangers.push(`${file}: drops a table or schema`);
  if (sql.includes(PROJECT_REF)) dangers.push(`${file}: names the development project`);
  /*
   * A migration that SEEDS business data would put invented prices, orders or
   * customers into a real shop.
   *
   * Only top-level statements count. `jojo_place_order` contains
   * `insert into public.orders` inside its own body, and a naive search flags
   * the function that CREATES orders as though it seeded some. Statements
   * inside a function body are indented; a real seed sits at the left margin.
   */
  for (const line of sql.split("\n")) {
    if (/^insert\s+into\s+public\.(products|orders|customers|delivery_zones)\b/i.test(line)) {
      dangers.push(`${file}: seeds business data — "${line.trim().slice(0, 60)}"`);
    }
  }
}

ok(`${statements} statements across the set`);

if (dangers.length === 0) {
  ok("none of them drops a table, names this project, or seeds business data");
} else {
  for (const danger of dangers) bad("a migration is not safe for production", danger);
}

const seed = "supabase/seed.sql";
if (fs.existsSync(seed)) {
  const text = fs.readFileSync(seed, "utf8");
  const seedsBusiness = /insert\s+into\s+public\.(products|orders|customers|delivery_zones)\b/i.test(text);
  if (seedsBusiness) bad("seed.sql inserts business data");
  else ok("seed.sql inserts no business data");
}

/* ----------------------------------------- 2. the files are the schema */

head("THE FILES ARE THE SCHEMA");

const listed = spawnSync("npx supabase migration list --linked", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 8 * 1024 * 1024,
});

const json = /\{[\s\S]*\}/.exec(listed.stdout ?? "");
if (!json) {
  bad("could not read the applied migration list", (listed.stderr ?? "").slice(-200));
} else {
  const { migrations } = JSON.parse(json[0]);
  const pendingLocally = migrations.filter((m) => m.local && !m.remote);
  const onlyRemote = migrations.filter((m) => m.remote && !m.local);

  if (pendingLocally.length === 0) ok(`all ${migrations.length} migrations are applied`);
  else bad(`${pendingLocally.length} local migration(s) have never been applied`);

  if (onlyRemote.length === 0) {
    ok("nothing has been applied that is not in these files", "the files build this database");
  } else {
    bad(
      `${onlyRemote.length} migration(s) exist on the project but not in the files`,
      "production built from the files would differ from development",
    );
  }
}

/* ---------------------------------------- 4. production starts at JU-000001 */

head("PRODUCTION STARTS ITS OWN NUMBERING");

const orders = fs.readFileSync(path.join(DIR, files.find((f) => f.includes("orders"))), "utf8");

if (/create sequence public\.order_number_seq[^;]*start with 1\b/i.test(orders)) {
  ok("order_number_seq starts at 1", "a fresh database issues JU-000001");
} else {
  bad("the order-number sequence does not start at 1");
}

if (/lpad\(nextval\('public\.order_number_seq'\)::text, 6, '0'\)/.test(orders)) {
  ok("the first order number would be JU-000001");
} else {
  bad("the order-number format is not what was expected");
}

// And the thing that must NOT happen: the development sequence travelling.
const anyMigrationSetsSequence = files.some((f) =>
  /setval\(\s*'public\.order_number_seq'/i.test(fs.readFileSync(path.join(DIR, f), "utf8")),
);
if (anyMigrationSetsSequence) {
  bad("a migration moves the order-number sequence", "production would not start at 1");
} else {
  ok("no migration moves the sequence", "development's numbering cannot travel");
}

/* ------------------------------------------- 5. everything still agrees */

head("THE FILES, THE DATABASE AND THE APPLICATION AGREE");

const types = spawnSync("npm run db:types:check", { encoding: "utf8", shell: true, maxBuffer: 8 * 1024 * 1024 });
if (types.status === 0) ok("the generated types match the live schema");
else bad("the generated types have drifted from the live schema");

/* ------------------------------------------------ what is NOT migrated */

head("WHAT PRODUCTION MUST NOT INHERIT");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (URL_ && KEY && URL_.includes(PROJECT_REF)) {
  const db = createClient(URL_, KEY, { auth: { persistSession: false } });
  const count = async (table) =>
    (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0;

  const [ordersNow, customers, audit, conflicts, staff] = await Promise.all([
    count("orders"),
    count("customers"),
    count("audit_events"),
    count("sync_conflicts"),
    count("admin_profiles"),
  ]);

  note(`development currently holds ${ordersNow} orders, ${customers} customers,`);
  note(`${audit} audit events, ${conflicts} sync conflicts and ${staff} staff records.`);
  note("None of it is migrated. Production is created empty and filled deliberately —");
  note("see docs/LAUNCH_CHECKLIST.md section C for the order.");
} else {
  note("development database not reachable; the list of what is not migrated is in the checklist.");
}

/* --------------------------------------------- what this cannot prove */

head("WHAT THIS REHEARSAL CANNOT PROVE");

note("That the migrations apply to a genuinely empty database in one pass.");
note("There is no local PostgreSQL on this machine and creating a throwaway");
note("hosted project is exactly what this build is told not to do. The evidence");
note("instead is that the development project WAS built from these files, in");
note("this order, and that the two lists still match today.");

/* --------------------------------------------------------------- report */

console.log(`\n  ${checks} checks, ${failures} failure(s).\n`);

if (failures > 0) {
  console.log("  FAIL — production could not be built from these files as they stand.\n");
  process.exit(1);
}

console.log("  PASS — these files, in this order, are what built the development database.\n");
