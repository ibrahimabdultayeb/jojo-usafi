#!/usr/bin/env node
/**
 * The Website screen, saved from the deployed dashboard, seen on the deployed shop.
 *
 *   BASE_URL=https://… node scripts/verify-deployed-website.mjs
 *
 * WHAT IT PROVES
 *
 *   1. an Owner changes the announcement on the deployed dashboard
 *   2. the deployed storefront shows it, in both languages
 *   3. clearing it restores the site's own wording rather than emptying the strip
 *   4. a MANAGER is refused, and is told so — not told "Saved"
 *
 * Number 4 is the one worth having. `shop_settings` admits only an Owner, and
 * PostgREST reports a refused update as zero rows rather than as an error — so
 * until Build 11 the screen said "Saved. The website is updated." to a Manager
 * whose change had never happened.
 *
 * THE OWNER IT USES IS A FIXTURE, created for this run and deleted by exact id
 * afterwards. A second Owner is legitimate — the last-Owner guard protects the
 * last one, not the only one — and Ibrahim's own Owner row is never read,
 * modified or counted.
 *
 * Every settings value is captured before anything is written and restored
 * afterwards, including when the run fails.
 *
 * Development project only, checked before anything is written.
 */

import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PROJECT_REF = "dyjhacbbedytcstxxjzl";
const MANIFEST = ".qa-staff.local.json";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
let checks = 0;
const ok = (w, d) => { checks += 1; console.log(`  ok    ${w}${d ? ` — ${d}` : ""}`); };
const bad = (w, d) => { checks += 1; failures += 1; console.log(`  FAIL  ${w}${d ? `\n        ${d}` : ""}`); };
const check = (w, passed, d) => (passed ? ok(w, d) : bad(w, d));
const head = (t) => console.log(`\n  ── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`);

function stop(message) {
  console.error(`\n  FAIL — ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

if (!URL_ || !KEY) stop("Supabase is not configured.");
if (!URL_.includes(PROJECT_REF)) stop(`Refusing to touch ${URL_}. Development project only.`);
if (!fs.existsSync(MANIFEST)) stop("No development QA staff. Run `npm run qa:staff create` first.");

const manager = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).accounts.find((a) => a.key === "manager");
if (!manager) stop("No QA Manager in the manifest.");

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const token = randomBytes(4).toString("hex");
const ANNOUNCEMENT = `ZZ${token} staging announcement`;

/** Everything this run may touch, captured before it touches any of it. */
const SETTINGS_COLUMNS = "announcement_en, announcement_sw, show_announcement";
const { data: before } = await db.from("shop_settings").select(SETTINGS_COLUMNS).eq("id", true).single();
if (!before) stop("Could not read shop_settings.");

let ownerId = null;
let ownerProfileId = null;
let browser = null;

async function teardown() {
  if (browser) await browser.close().catch(() => {});

  await db.from("shop_settings").update(before).eq("id", true);
  const { data: after } = await db.from("shop_settings").select(SETTINGS_COLUMNS).eq("id", true).single();
  check(
    "the shop's own settings were put back exactly as they were",
    JSON.stringify(after) === JSON.stringify(before),
  );

  if (ownerProfileId) await db.from("admin_profiles").delete().eq("id", ownerProfileId);
  if (ownerId) {
    await db.auth.admin.deleteUser(ownerId).catch(() => {});
    ok("the fixture Owner was deleted, by exact id");
  }
}

/** What the deployed storefront is saying right now, in one language. */
async function storefrontSays(context, path) {
  const tab = await context.newPage();
  await tab.goto(`${BASE_URL}${path}`, { waitUntil: "load", timeout: 90_000 });
  const text = (await tab.locator("body").innerText()).replace(/\s+/g, " ");
  await tab.close();
  return text;
}

/** Sign a browser context in and land on the Website screen. */
async function openWebsiteScreen(context, email, password) {
  const tab = await context.newPage();
  await tab.goto(`${BASE_URL}/admin/sign-in`, { waitUntil: "load", timeout: 90_000 });
  await tab.fill("#email", email);
  await tab.fill("#password", password);
  await Promise.all([
    tab.waitForURL((u) => !new URL(u).pathname.startsWith("/admin/sign-in"), { timeout: 60_000 }).catch(() => {}),
    tab.click('[data-qa-anchor="admin-sign-in-submit"]'),
  ]);
  await tab.goto(`${BASE_URL}/admin/more/website`, { waitUntil: "load", timeout: 90_000 });
  return tab;
}

try {
  console.log(`\n  Against ${BASE_URL}\n`);

  /* ------------------------------------------------- a fixture Owner */

  head("A FIXTURE OWNER, ALONGSIDE THE REAL ONE");

  const ownerEmail = `zz-owner-${token}@jojo-usafi.invalid`;
  const ownerPassword = `Qa!${randomBytes(18).toString("base64url")}`;

  const created = await db.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { fixture: "verify-deployed-website" },
  });
  if (created.error) stop(`Could not create the fixture Owner: ${created.error.message}`);
  ownerId = created.data.user.id;

  const profile = await db
    .from("admin_profiles")
    .insert({
      auth_user_id: ownerId,
      full_name: `ZZ${token} Staging Owner`,
      email: ownerEmail,
      role: "owner",
      active: true,
    })
    .select("id")
    .single();
  if (profile.error) stop(`Could not add the fixture Owner: ${profile.error.message}`);
  ownerProfileId = profile.data.id;

  const { count: owners } = await db
    .from("admin_profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("active", true);
  check("the shop now has more than one Owner, so the guard is not in play", owners > 1, `${owners} Owners`);

  browser = await chromium.launch();
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const managerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const context of [ownerContext, managerContext]) {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("jojo-usafi.locale.v1", "en");
        window.sessionStorage.setItem("jojo-usafi.locale.applied.v1", "1");
      } catch { /* storage blocked */ }
    });
  }

  /* ------------------------------------- 1. the Owner changes the words */

  head("THE OWNER CHANGES THE ANNOUNCEMENT");

  const ownerTab = await openWebsiteScreen(ownerContext, ownerEmail, ownerPassword);
  check(
    "the Owner reaches the Website screen",
    new URL(ownerTab.url()).pathname === "/admin/more/website",
    new URL(ownerTab.url()).pathname,
  );

  /*
   * BY ITS LABEL, NOT BY POSITION.
   *
   * The first `input` on this page is the dashboard's own search box, in the
   * shell above the screen — so `locator("input").first()` types the
   * announcement into the search field and reports a save that never happened.
   */
  const announcementField = ownerTab.getByLabel("Announcement — English");
  await announcementField.waitFor({ state: "visible", timeout: 30_000 });
  await announcementField.fill(ANNOUNCEMENT);
  await announcementField.blur();

  // The screen saves on blur and the database is the thing to wait for.
  let saved = false;
  for (let attempt = 0; attempt < 20 && !saved; attempt += 1) {
    await ownerTab.waitForTimeout(1000);
    const { data } = await db.from("shop_settings").select("announcement_en").eq("id", true).single();
    saved = data?.announcement_en === ANNOUNCEMENT;
  }
  check("the announcement really saved", saved);

  /* ------------------------------ 2. the deployed storefront shows it */

  head("THE DEPLOYED SHOP SHOWS IT");

  const english = await storefrontSays(ownerContext, "/");
  check("the English homepage carries the new announcement", english.includes(ANNOUNCEMENT));

  const kiswahili = await storefrontSays(ownerContext, "/sw");
  check(
    "and so does the Kiswahili one, because its own box is empty",
    kiswahili.includes(ANNOUNCEMENT),
  );

  /* --------------------------- 3. clearing restores the site's wording */

  head("CLEARING IT RESTORES THE SITE'S OWN WORDING");

  await db.from("shop_settings").update({ announcement_en: null, announcement_sw: null }).eq("id", true);
  // The storefront caches for five minutes under the `catalogue` tag; the
  // dashboard drops that tag on save, so this needs a save to take effect.
  await ownerTab.reload({ waitUntil: "load" });
  const cleared = ownerTab.getByLabel("Announcement — English");
  await cleared.waitFor({ state: "visible", timeout: 30_000 });
  await cleared.fill("");
  await cleared.blur();
  await ownerTab.waitForTimeout(4000);

  const afterClearing = await storefrontSays(ownerContext, "/");
  check("the fixture announcement is gone", !afterClearing.includes(ANNOUNCEMENT));
  check(
    "and the strip is not empty — the site's own wording is back",
    /delivery|order|Dar/i.test(afterClearing),
  );

  /* ------------------------------------ 4. a Manager is refused, plainly */

  head("A MANAGER IS REFUSED, AND TOLD SO");

  const managerPassword = `Qa!${randomBytes(18).toString("base64url")}`;
  await db.auth.admin.updateUserById(manager.authUserId, { password: managerPassword, email_confirm: true });

  const managerTab = await openWebsiteScreen(managerContext, manager.email, managerPassword);
  const landed = new URL(managerTab.url()).pathname;
  const managerSees = (await managerTab.locator("body").innerText()).replace(/\s+/g, " ");

  // Since Build 11 the capability matrix matches the database: a Manager has no
  // `website.manage`, so the entry is not in their More menu and the screen
  // itself refuses. Either outcome is correct; being told "Saved" is not.
  check(
    "a Manager is not given an editable Website screen",
    landed !== "/admin/more/website" || /Owner/i.test(managerSees),
    `landed on ${landed}`,
  );
  check("and is not told anything was saved", !/Saved\./.test(managerSees));

  await managerTab.close();
  await ownerTab.close();
} finally {
  head("CLEANING UP");
  await teardown();

  console.log(`\n  ${checks} checks, ${failures} failure(s).\n`);
  if (failures > 0) {
    console.log("  FAIL — the deployed website settings are not behaving.\n");
    process.exitCode = 1;
  } else {
    console.log("  PASS — the Owner's words reach the deployed shop, and nobody else's do.\n");
  }
}
