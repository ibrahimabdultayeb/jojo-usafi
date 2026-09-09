#!/usr/bin/env node
/**
 * DEVELOPMENT-ONLY QA staff accounts.
 *
 *   node scripts/qa-staff.mjs create   — create (or refresh) the QA logins
 *   node scripts/qa-staff.mjs status   — what exists right now
 *   node scripts/qa-staff.mjs remove   — delete exactly what `create` made
 *
 * WHY THIS EXISTS
 *
 * The admin dashboard shows a Manager fewer controls than an Owner, and an
 * Order staff member fewer again. That difference cannot be judged from code:
 * somebody has to sign in as each role on a phone and look. Ibrahim's real
 * Owner account is the one account that must never be used for that — see
 * `tests/db/05-real-data-untouched.test.ts`, which proves it is byte-for-byte
 * unchanged by the test suite.
 *
 * SAFETY RULES, AND HOW THEY ARE KEPT
 *
 * 1. NO PASSWORD IS EVER STORED. `create` mints a random one, prints it once,
 *    and forgets it. Re-running `create` mints a new one. Nothing is written to
 *    a file, an environment variable or this repository.
 *
 * 2. CLEANUP IS BY EXACT IDENTITY. Every account this script creates is
 *    recorded — auth user id and admin_profile id — in `.qa-staff.local.json`,
 *    which is gitignored. `remove` deletes those exact ids and nothing else. It
 *    never searches by role, by email domain, by name or by business state.
 *
 * 3. IT FAILS CLOSED. No manifest means `remove` refuses rather than guessing.
 *    A recorded row whose role has become `owner`, or whose email no longer
 *    matches what was recorded, is left alone and reported.
 *
 * 4. DEVELOPMENT PROJECT ONLY. The Supabase URL is checked against the
 *    development project reference before anything is written.
 *
 * The accounts are obvious about what they are: the names read "QA Manager
 * (development)" and the addresses end in `.test`, a TLD reserved by RFC 2606
 * that can never receive mail.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = "dyjhacbbedytcstxxjzl";
const MANIFEST = ".qa-staff.local.json";

/** The two roles worth looking at. Owner is deliberately absent. */
const ACCOUNTS = [
  { key: "manager", email: "qa-manager@jojo-usafi.test", name: "QA Manager (development)", role: "manager" },
  { key: "order_staff", email: "qa-order-staff@jojo-usafi.test", name: "QA Order Staff (development)", role: "order_staff" },
];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!URL_ || !KEY) fail("Supabase is not configured. Copy .env.example to .env.local.");
if (!URL_.includes(PROJECT_REF)) {
  fail(`Refusing to touch ${URL_}. This script only ever runs against the development project ${PROJECT_REF}.`);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });
const command = process.argv[2] ?? "status";

/* ------------------------------------------------------------- manifest */

function readManifest() {
  if (!existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

function writeManifest(entries) {
  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        note: "Development QA staff created by scripts/qa-staff.mjs. Never committed. No passwords here.",
        projectRef: PROJECT_REF,
        createdAt: new Date().toISOString(),
        accounts: entries,
      },
      null,
      2,
    ),
    "utf8",
  );
}

/* --------------------------------------------------------------- helpers */

/** A password nobody has to remember, because it is printed once and reset on demand. */
function mintPassword() {
  return `Qa!${randomBytes(18).toString("base64url")}`;
}

/** Find an Auth user by exact email address, without listing every user twice. */
async function findAuthUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not read the Auth users: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/* ---------------------------------------------------------------- create */

async function create() {
  const password = mintPassword();
  const entries = [];

  for (const account of ACCOUNTS) {
    const existing = await findAuthUser(account.email);

    let authUserId;
    if (existing) {
      // Same account, new password. Updating by id, never by a search filter.
      const { error } = await db.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (error) fail(`Could not reset ${account.email}: ${error.message}`);
      authUserId = existing.id;
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { development_fixture: true, purpose: "admin dashboard QA" },
      });
      if (error) fail(`Could not create ${account.email}: ${error.message}`);
      authUserId = data.user.id;
    }

    // The profile is what makes them staff. Matched on auth_user_id, which is
    // unique — never on the role or the email domain.
    const { data: profile, error: profileError } = await db
      .from("admin_profiles")
      .upsert(
        {
          auth_user_id: authUserId,
          full_name: account.name,
          email: account.email,
          role: account.role,
          active: true,
        },
        { onConflict: "auth_user_id" },
      )
      .select("id, role, email")
      .single();

    if (profileError) fail(`Could not write the profile for ${account.email}: ${profileError.message}`);

    // A belt-and-braces refusal: this script must never be the thing that
    // creates or touches an Owner.
    if (profile.role === "owner") {
      fail(`Refusing to continue: ${account.email} is an Owner. This script only manages Manager and Order staff.`);
    }

    entries.push({
      key: account.key,
      email: account.email,
      role: profile.role,
      authUserId,
      adminProfileId: profile.id,
    });
  }

  writeManifest(entries);

  console.log("\n  Development QA staff ready on the DEV project.\n");
  for (const entry of entries) {
    console.log(`    ${entry.role.padEnd(12)} ${entry.email}`);
  }
  console.log(`\n  Password for both, shown once and not stored anywhere:\n\n      ${password}\n`);
  console.log("  Sign in at /admin/sign-in. Run this command again to mint a new password,");
  console.log("  or `node scripts/qa-staff.mjs remove` to delete these accounts.\n");
}

/* ---------------------------------------------------------------- status */

async function status() {
  const manifest = readManifest();
  if (!manifest) {
    console.log("\n  No QA staff manifest. Nothing has been created on this machine.\n");
    return;
  }

  console.log("\n  Recorded development QA staff:\n");
  for (const entry of manifest.accounts) {
    const { data } = await db
      .from("admin_profiles")
      .select("id, full_name, email, role, active")
      .eq("id", entry.adminProfileId)
      .maybeSingle();
    const state = data ? `${data.role}${data.active ? "" : " (switched off)"}` : "MISSING from the database";
    console.log(`    ${entry.email.padEnd(34)} ${state}`);
  }
  console.log("");
}

/* ---------------------------------------------------------------- remove */

async function remove() {
  const manifest = readManifest();
  if (!manifest) {
    fail(
      `No ${MANIFEST}, so there is no record of which accounts this script created. ` +
        "Refusing to guess: deleting staff by role or by email domain is exactly the " +
        "mistake this script exists to avoid.",
    );
  }

  let removed = 0;
  const kept = [];

  for (const entry of manifest.accounts) {
    // Read the row back by its exact recorded id and check it is still the row
    // that was recorded. If it has drifted, leave it alone and say so.
    const { data: profile } = await db
      .from("admin_profiles")
      .select("id, email, role, auth_user_id")
      .eq("id", entry.adminProfileId)
      .maybeSingle();

    if (!profile) {
      console.log(`    already gone   ${entry.email}`);
      continue;
    }

    const sameEmail = (profile.email ?? "").toLowerCase() === entry.email.toLowerCase();
    const sameAuthUser = profile.auth_user_id === entry.authUserId;

    if (profile.role === "owner" || !sameEmail || !sameAuthUser) {
      kept.push(`${entry.email} — the row at that id is no longer the account this script created`);
      continue;
    }

    const { error: profileError } = await db.from("admin_profiles").delete().eq("id", entry.adminProfileId);
    if (profileError) {
      // A staff member named in the append-only audit trail cannot be deleted:
      // the cascade would have to NULL a column the ledger refuses to change.
      // Switching them off is the correct answer, and is what the dashboard does.
      const { error: offError } = await db
        .from("admin_profiles")
        .update({ active: false })
        .eq("id", entry.adminProfileId);
      kept.push(
        offError
          ? `${entry.email} — could not delete or switch off: ${profileError.message}`
          : `${entry.email} — named in the audit trail, so switched off instead of deleted`,
      );
      continue;
    }

    const { error: authError } = await db.auth.admin.deleteUser(entry.authUserId);
    if (authError) {
      kept.push(`${entry.email} — profile deleted, but the Auth user remains: ${authError.message}`);
      continue;
    }

    console.log(`    removed        ${entry.email}`);
    removed += 1;
  }

  if (kept.length > 0) {
    console.log("\n  Left in place:");
    for (const line of kept) console.log(`    ${line}`);
  }

  if (kept.length === 0 && existsSync(MANIFEST)) unlinkSync(MANIFEST);
  console.log(`\n  ${removed} account(s) removed.\n`);
}

/* ------------------------------------------------------------------ main */

if (command === "create") await create();
else if (command === "remove") await remove();
else if (command === "status") await status();
else fail("Usage: node scripts/qa-staff.mjs create | status | remove");
