#!/usr/bin/env node
/**
 * Does a price saved in the dashboard reach the shop immediately?
 *
 *   npm run start                                   # in one terminal
 *   node scripts/verify-cache-invalidation.mjs      # in another
 *
 * WHY THIS IS A SEPARATE CHECK
 *
 * The storefront reads `product_shelf` through `unstable_cache` with a five
 * minute revalidate and the tag `catalogue`. `saveProductAction` calls
 * `revalidateTag("catalogue")` after a successful write. Both halves are one
 * line each and both look obviously correct — which is exactly the kind of
 * wiring that is silently broken, because nothing fails when it is: the price
 * simply arrives up to five minutes late, and only in production, and only when
 * somebody happens to look.
 *
 * So this proves it end to end and in the real order:
 *
 *   1. read the product page as a shopper, note the price
 *   2. sign in as the development QA Manager and change the price in the editor
 *   3. read the product page again, immediately — it must show the new price
 *   4. put the old price back, and check the shop again
 *
 * It uses the development QA Manager created by `scripts/qa-staff.mjs`, resets
 * that account's password to a fresh random one by its exact recorded id, and
 * stores nothing. Ibrahim's Owner account is never touched.
 *
 * Development project only, checked before anything is written.
 */

import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PROJECT_REF = "dyjhacbbedytcstxxjzl";
const MANIFEST = ".qa-staff.local.json";

function fail(message) {
  console.error(`\n  FAIL — ${message}\n`);
  process.exit(1);
}

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("Supabase is not configured. Copy .env.example to .env.local.");
if (!url.includes(PROJECT_REF)) fail(`Refusing to touch ${url}. Development project only.`);
if (!fs.existsSync(MANIFEST)) fail("No development QA staff. Run `npm run qa:staff create` first.");

const manager = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).accounts.find((a) => a.key === "manager");
if (!manager) fail("No QA Manager in the manifest.");

const db = createClient(url, key, { auth: { persistSession: false } });

/* A product that is on the public shelf, so a shopper can actually see it. */
const { data: shelf } = await db
  .from("product_shelf")
  .select("sku, slug, price_tzs, offer_price_tzs")
  .is("offer_price_tzs", null)
  .order("sku")
  .limit(1)
  .maybeSingle();

if (!shelf) fail("No product on the public shelf to test with.");

const originalPrice = shelf.price_tzs;
const testPrice = originalPrice + 137; // an amount nothing else would produce

console.log(`\n  Product:  ${shelf.sku}`);
console.log(`  Price:    TSh ${originalPrice.toLocaleString("en-TZ")} -> TSh ${testPrice.toLocaleString("en-TZ")} -> back\n`);

const password = `Qa!${randomBytes(18).toString("base64url")}`;
const { error: resetError } = await db.auth.admin.updateUserById(manager.authUserId, {
  password,
  email_confirm: true,
});
if (resetError) fail(`Could not prepare the QA Manager: ${resetError.message}`);

const browser = await chromium.launch();
const shopper = await browser.newContext();
const staff = await browser.newContext();

/** What the shop is charging, as a signed-out shopper sees it right now. */
async function shopPrice() {
  const tab = await shopper.newPage();
  await tab.goto(`${BASE_URL}/product/${shelf.slug}`, { waitUntil: "load", timeout: 90_000 });
  const text = await tab.evaluate(() => document.body.innerText);
  await tab.close();
  const found = [...text.matchAll(/TSh\s*([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  return found;
}

async function setPrice(value) {
  const tab = await staff.newPage();
  await tab.goto(`${BASE_URL}/admin/products/${shelf.sku}`, { waitUntil: "load", timeout: 90_000 });

  if (tab.url().includes("/admin/sign-in")) {
    await tab.fill("#email", manager.email);
    await tab.fill("#password", password);
    await Promise.all([
      tab.waitForURL((u) => !u.pathname.startsWith("/admin/sign-in"), { timeout: 60_000 }),
      tab.click('[data-qa-anchor="admin-sign-in-submit"]'),
    ]);
    await tab.goto(`${BASE_URL}/admin/products/${shelf.sku}`, { waitUntil: "load", timeout: 90_000 });
  }

  const field = tab.locator('input[inputmode="numeric"]').first();
  await field.fill(String(value));
  await field.blur();
  // The editor saves on blur and shows "Saved" when the database agreed.
  await tab.getByText("Saved", { exact: true }).waitFor({ timeout: 30_000 });
  await tab.close();
}

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const before = await shopPrice();
check("the shop starts on the old price", before.includes(originalPrice), `saw ${before.join(", ")}`);

await setPrice(testPrice);
const after = await shopPrice();
check("the new price is on the shop immediately", after.includes(testPrice), `saw ${after.join(", ")}`);
check("the old price is gone", !after.includes(originalPrice));

await setPrice(originalPrice);
const restored = await shopPrice();
check("the old price is back", restored.includes(originalPrice), `saw ${restored.join(", ")}`);

await browser.close();

const { data: final } = await db.from("products").select("price_tzs").eq("sku", shelf.sku).single();
check("the database is back where it started", final.price_tzs === originalPrice, `price_tzs = ${final.price_tzs}`);

if (failures > 0) {
  console.error(`\n  ${failures} check(s) failed. A saved price is not reaching the shop.\n`);
  process.exit(1);
}
console.log("\n  PASS — a price saved in the dashboard reaches the shop immediately.\n");
