#!/usr/bin/env node
/**
 * Can somebody who was sent a link actually get in?
 *
 *   npm run start                                # in one terminal
 *   node scripts/verify-password-link.mjs        # in another
 *   BASE_URL=https://… node scripts/verify-password-link.mjs
 *
 * WHY THIS IS A SEPARATE CHECK
 *
 * `tests/db/15-password-links.test.ts` proves Supabase's half: that a link is
 * minted, verifies once, and yields a session whose password change really
 * works. None of that touches a browser, and the browser is where this flow was
 * broken — an invitation delivers its session in the URL **fragment**, which
 * never reaches a server, so every server-side test can pass while a real
 * person still lands on a page that does nothing.
 *
 * So this drives a real browser through the real thing:
 *
 *   1. create a throwaway account and mint a real recovery link
 *   2. open that link the way a person opens an email
 *   3. arrive at /admin/set-password and find a form, not a redirect
 *   4. choose a password and save it
 *   5. sign out, and sign in again with the password just chosen
 *
 * Step 5 is the point. Everything before it can succeed while the password
 * silently did not save.
 *
 * The account is created for this run, carries a marker saying so, and is
 * deleted by exact id at the end — including if the run fails. No real person's
 * account is read, changed or counted.
 *
 * Development project only, checked before anything is written.
 */

import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PROJECT_REF = "dyjhacbbedytcstxxjzl";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n  FAIL — ${message}\n`);
  process.exit(1);
}

if (!URL_ || !KEY) fail("Supabase is not configured. Copy .env.example to .env.local.");
if (!URL_.includes(PROJECT_REF)) {
  fail(`Refusing to create accounts in ${URL_}. Development project ${PROJECT_REF} only.`);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

/** This run's identity, so teardown deletes exactly what it made. */
const token = randomBytes(4).toString("hex");
const email = `zz-link-${token}@jojo-usafi.invalid`;
// Never printed, never stored, never reused.
const password = `zz-${randomBytes(12).toString("hex")}`;

let userId = null;
let profileId = null;
let browser = null;

const ok = (what) => console.log(`  ok    ${what}`);

async function teardown() {
  if (browser) await browser.close().catch(() => {});
  // Profile first: it holds a foreign key to the auth user.
  if (profileId) await db.from("admin_profiles").delete().eq("id", profileId);
  if (userId) {
    await db.auth.admin.deleteUser(userId).catch(() => {});
    console.log(`  ok    the throwaway account and its staff record were deleted`);
  }
}

process.on("exit", () => {
  /* teardown is awaited explicitly; this is the last-resort note */
});

try {
  console.log(`\n  Against ${BASE_URL}\n`);

  /* ------------------------------------------------- 1. a real link */

  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { fixture: "verify-password-link", note: "throwaway, deleted by this script" },
  });
  if (created.error) fail(`could not create the throwaway account: ${created.error.message}`);
  userId = created.data.user.id;
  ok(`a throwaway account exists (${email})`);

  // Make it real staff, because that is the journey being tested: somebody the
  // Owner added, following the link they were sent. Order staff, so it can
  // never collide with the last-Owner guard.
  const profile = await db
    .from("admin_profiles")
    .insert({
      auth_user_id: userId,
      full_name: `ZZ${token} Link Fixture`,
      email,
      role: "order_staff",
      active: true,
    })
    .select("id")
    .single();
  if (profile.error) fail(`could not add the throwaway staff record: ${profile.error.message}`);
  profileId = profile.data.id;
  ok("and it has been added to the shop as Order staff");

  const link = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${BASE_URL}/admin/auth/callback` },
  });
  if (link.error) fail(`could not mint a link: ${link.error.message}`);

  // The exact URL the email would have contained. Not printed: it is a
  // single-use credential for the whole minute it exists.
  const actionLink = link.data.properties.action_link;
  ok("a recovery link was minted, as the email would carry it");

  /* --------------------------------------- 2. open it like a person */

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tab = await context.newPage();

  const consoleErrors = [];
  tab.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await tab.goto(actionLink, { waitUntil: "networkidle" });

  /* ------------------------------- 3. it must be the password form */

  await tab.waitForURL(/\/admin\/set-password/, { timeout: 20_000 }).catch(() => {});

  const path = new URL(tab.url()).pathname;
  if (path !== "/admin/set-password") {
    fail(`the link landed on ${path}, not /admin/set-password`);
  }
  ok("the link lands on /admin/set-password");

  const field = tab.locator("#password");
  await field.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  if (!(await field.count())) {
    const text = (await tab.locator("body").innerText()).slice(0, 200).replace(/\s+/g, " ");
    fail(`no password form appeared. The page said: ${text}`);
  }
  ok("a password form is on screen, so the session was picked up");

  // The tokens must not still be in the address bar afterwards: they end up in
  // browser history and in every screenshot otherwise.
  if (tab.url().includes("access_token") || tab.url().includes("#")) {
    fail("the session tokens are still in the address bar");
  }
  ok("the tokens were cleared from the address bar");

  /* ----------------------------------------- 4. choose a password */

  await field.fill(password);
  await tab.locator("#again").fill(password);
  await tab.locator('button[type="submit"]').click();

  // Wait for the confirmation, not for a URL. `/admin/set-password` already
  // matches any pattern that `/admin` would, so waiting on the address bar
  // resolves instantly and reports failure on a save that worked.
  const saved = tab.locator('[role="status"]', { hasText: "Saved" });
  await saved.waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});

  if (!(await saved.count())) {
    const alert = await tab.locator('[role="alert"]').first().innerText().catch(() => "");
    fail(`the password was not saved. The page said: ${alert || "nothing"}`);
  }
  ok("the password saved");

  await tab.waitForURL((url) => new URL(url).pathname === "/admin", { timeout: 25_000 }).catch(() => {});
  if (new URL(tab.url()).pathname !== "/admin") {
    fail(`after saving, the browser stayed on ${new URL(tab.url()).pathname}`);
  }
  ok("and the browser reached the dashboard");

  /* ------------------------- 5. the password actually signs in */

  await context.clearCookies();
  await tab.goto(`${BASE_URL}/admin/sign-in`, { waitUntil: "networkidle" });
  await tab.locator("#email").fill(email);
  await tab.locator("#password").fill(password);

  // Wait for the server action AND its redirect to finish. Sampling the page
  // after `networkidle` alone catches the button still saying "Signing in…",
  // which reads as a pass and proves nothing — that false positive is why this
  // waits on the address bar changing instead.
  await Promise.all([
    tab
      .waitForURL((url) => new URL(url).pathname !== "/admin/sign-in", { timeout: 30_000 })
      .catch(() => {}),
    tab.locator('button[type="submit"]').click(),
  ]);
  await tab.waitForLoadState("networkidle");

  const body = await tab.locator("body").innerText();

  if (/do not match an account/i.test(body)) {
    fail("the new password did not sign in");
  }
  const landed = new URL(tab.url()).pathname;
  if (landed !== "/admin") {
    fail(`signing in landed on ${landed} rather than the dashboard`);
  }
  ok("signing in with the new password reaches the dashboard");

  /* ------------------- 6. and switching them off really shuts them out */

  /*
   * The same account and the same password, with one column changed.
   *
   * Before Build 11 the middleware asked only "is anybody signed in", so a
   * switched-off staff member — and in fact anybody holding any Supabase
   * account — was handed the dashboard frame. Row Level Security kept every
   * order, customer and staff row empty, so it was not a breach; it was the
   * application telling somebody they were in the back office when they were
   * not, and never showing them the sign-in screen's explanation.
   */
  const off = await db.from("admin_profiles").update({ active: false }).eq("id", profileId);
  if (off.error) fail(`could not switch the fixture off: ${off.error.message}`);

  await context.clearCookies();
  await tab.goto(`${BASE_URL}/admin/sign-in`, { waitUntil: "networkidle" });
  await tab.locator("#email").fill(email);
  await tab.locator("#password").fill(password);
  await tab.locator('button[type="submit"]').click();

  /*
   * Wait for the ANSWER, not for the address bar.
   *
   * A switched-off account signs in successfully — Supabase Auth is fine, it is
   * the staff record that is off — so the action redirects to `/admin`, and
   * middleware sends it straight back to `/admin/sign-in`. The URL therefore
   * ends exactly where it started, and anything watching for a change resolves
   * instantly against a page still showing "Signing in…". That false positive
   * is the whole reason this waits on the words instead.
   */
  await tab
    .locator("text=/switched off|No access|not a Jojo Usafi staff account/i")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {});

  /*
   * ASSERT ON WHAT IS SHOWN, NOT ON THE ADDRESS BAR.
   *
   * A sign-in that redirects to `/admin` and is bounced back by middleware
   * leaves Next's client router showing `/admin` while rendering the sign-in
   * screen's content. The address is cosmetic and lags; what matters is that
   * the dashboard is not there.
   */
  const explained = await tab.locator("body").innerText();

  if (!/switched off|No access|not a Jojo Usafi staff account/i.test(explained)) {
    const seen = explained.replace(/\s+/g, " ").slice(0, 160);
    fail(`a switched-off staff member was not told why. The page said: ${seen}`);
  }

  // The dashboard's own furniture. If any of it is on screen, the refusal above
  // was a panel drawn on top of a working back office rather than instead of one.
  if (/Needs attention|Recent activity|Recent orders|Good (morning|afternoon|evening)/i.test(explained)) {
    fail("a switched-off staff member was still shown the dashboard");
  }

  // And the direct route, with no client router in the way.
  await tab.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  if (new URL(tab.url()).pathname !== "/admin/sign-in") {
    fail(`going straight to /admin as a switched-off staff member reached ${new URL(tab.url()).pathname}`);
  }
  ok("a switched-off staff member is shut out, and told why");

  if (consoleErrors.length > 0) {
    fail(`the browser logged ${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
  }
  ok("no console errors");

  await teardown();
  console.log("\n  PASS — an emailed link really does let somebody choose a password and sign in.\n");
} catch (error) {
  await teardown();
  fail(error instanceof Error ? error.message : String(error));
}
