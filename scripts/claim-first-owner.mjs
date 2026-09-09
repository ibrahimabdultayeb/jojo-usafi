#!/usr/bin/env node
/**
 * Claim the Jojo Usafi Owner seat, once, without ever handling a password.
 *
 *   node scripts/claim-first-owner.mjs "Ibrahim Abdul Tayeb"
 *   node scripts/claim-first-owner.mjs "Ibrahim Abdul Tayeb" --dry-run
 *
 * WHY THIS EXISTS
 *
 * `public.jojo_claim_first_owner` gives the Owner seat to `auth.uid()` — the
 * account that is signed in when it is called. EXECUTE is granted to the
 * `authenticated` role and to nobody else: not `anon`, not `service_role`, not
 * PUBLIC. So the claim CANNOT be made on somebody's behalf with a privileged
 * key; it has to happen inside that person's own session.
 *
 * Normally the person signs in at `/admin/sign-in` and presses the button on
 * `/admin/setup`. This script is the same thing for the case where the operator
 * running it must not be told the password — it signs the account in the
 * passwordless way Supabase already supports:
 *
 *   1. mint a single-use magic-link token for the account (service role)
 *   2. exchange that token for a real session      (anon key — a normal sign-in)
 *   3. call the RPC with that session              (anon key, RLS in force)
 *   4. sign out
 *
 * Step 3 is exactly what the web form does. Row Level Security is never
 * bypassed, no password is read, typed, stored or printed, and the service-role
 * key is used only to issue the link — which is what "email me a sign-in link"
 * does every day.
 *
 * NO ACCOUNT IS HARD-CODED. The target is discovered: the one confirmed login
 * that is not a test fixture. If that is ambiguous the script refuses and lists
 * what it found, rather than guessing which human owns the shop.
 *
 * IT CANNOT BE USED TWICE. The database refuses once the seat is taken, and
 * this script checks first so the refusal reads as a sentence rather than an
 * exception.
 */

import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------- environment */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded, or absent — the check below gives the useful message.
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  fail(
    "Supabase is not configured.\n" +
      "  Copy .env.example to .env.local and fill in the development project's values.",
  );
}

/** Test fixtures live on a reserved TLD and are never a real person. */
const FIXTURE_DOMAIN = "@jojo-usafi.test";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fullName = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();

if (!fullName) {
  fail(
    'A full name is required.\n\n  node scripts/claim-first-owner.mjs "Ibrahim Abdul Tayeb"\n\n' +
      "  It is the name that appears beside everything the Owner does in the\n" +
      "  shop's records, so it is asked for rather than invented from an email.",
  );
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(URL, SERVICE_KEY, options);

/* ------------------------------------------------- is the seat already taken? */

const anonProbe = createClient(URL, ANON_KEY, options);
const { data: alreadyOwned, error: probeError } = await anonProbe.rpc("jojo_owner_exists");

if (probeError) fail(`Could not reach Supabase: ${probeError.message}`);

if (alreadyOwned === true) {
  const { data: owners } = await service
    .from("admin_profiles")
    .select("full_name, email")
    .eq("role", "owner")
    .eq("active", true);

  const who = (owners ?? []).map((o) => `${o.full_name} <${o.email}>`).join(", ") || "someone";
  fail(
    `Jojo Usafi already has an Owner: ${who}.\n\n` +
      "  The first-Owner bootstrap is a one-time event and this is not it.\n" +
      "  Further staff are added by the Owner from inside the dashboard.",
  );
}

/* --------------------------------------------------- find the real account */

const candidates = [];
for (let page = 1; page <= 20; page += 1) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`Could not list logins: ${error.message}`);
  for (const user of data.users) {
    if (!user.email) continue;
    if (user.email.endsWith(FIXTURE_DOMAIN)) continue;
    if (!user.email_confirmed_at) continue;
    candidates.push(user);
  }
  if (data.users.length < 200) break;
}

if (candidates.length === 0) {
  fail(
    "No confirmed login was found to make the Owner.\n\n" +
      "  Create the admin account through Supabase Auth first, and confirm the\n" +
      "  email address, then run this again.",
  );
}

if (candidates.length > 1) {
  fail(
    `Found ${candidates.length} confirmed logins, so which one owns the shop is a guess:\n\n` +
      candidates.map((u) => `    ${u.email}`).join("\n") +
      "\n\n  Refusing to choose. Sign in as the right account at /admin/sign-in and\n" +
      "  use /admin/setup instead, which claims the seat for whoever is signed in.",
  );
}

const target = candidates[0];

console.log("\nJojo Usafi — first-Owner bootstrap\n");
console.log(`  project   ${URL.replace(/^https:\/\//, "").replace(/\.supabase\.co.*$/, "")}`);
console.log(`  account   ${target.email}`);
console.log(`  name      ${fullName}`);
console.log(`  seat      vacant\n`);

if (dryRun) {
  console.log("  --dry-run: nothing was changed.\n");
  process.exit(0);
}

/* ------------------------- sign in as that account, the passwordless way */

const { data: link, error: linkError } = await service.auth.admin.generateLink({
  type: "magiclink",
  email: target.email,
});

if (linkError) fail(`Could not create a sign-in link: ${linkError.message}`);

const tokenHash = link?.properties?.hashed_token;
if (!tokenHash) fail("Supabase returned a sign-in link with no token.");

// From here on the anon key does the work, exactly as a browser would.
const asUser = createClient(URL, ANON_KEY, options);

const { data: verified, error: verifyError } = await asUser.auth.verifyOtp({
  type: "magiclink",
  token_hash: tokenHash,
});

if (verifyError) fail(`Could not sign in as ${target.email}: ${verifyError.message}`);
if (verified?.user?.id !== target.id) {
  fail("The session that came back belongs to a different account. Nothing was changed.");
}

console.log("  signed in as the account itself (no password involved)");

/* ------------------------------------------------------------- the claim */

const { data: profile, error: claimError } = await asUser.rpc("jojo_claim_first_owner", {
  p_full_name: fullName,
});

if (claimError) {
  await asUser.auth.signOut();
  fail(`The database refused the claim: ${claimError.message}`);
}

await asUser.auth.signOut();

console.log("  claimed\n");
console.log("  Owner account");
console.log(`    name    ${profile.full_name}`);
console.log(`    email   ${profile.email}`);
console.log(`    role    ${profile.role}`);
console.log(`    active  ${profile.active}`);
console.log(`    linked  ${profile.auth_user_id === target.id ? "yes" : "NO — investigate"}\n`);
console.log("  The seat is taken. /admin/setup now disables itself, and every");
console.log("  further staff account is added by the Owner from the dashboard.\n");
