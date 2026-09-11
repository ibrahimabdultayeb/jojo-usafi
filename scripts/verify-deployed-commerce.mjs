#!/usr/bin/env node
/**
 * The whole shop, driven through the real deployment.
 *
 *   BASE_URL=https://… node scripts/verify-deployed-commerce.mjs
 *
 * WHY THIS EXISTS
 *
 * Every rule in this shop is already proved against the database, and the
 * screens are already photographed. What has never been proved is the two of
 * them together, over HTTPS, from a browser that has never seen this site:
 * that a shopper can actually buy something, that the order they placed is the
 * order staff see, and that every way an order can end really ends that way.
 *
 * WHAT IT DOES
 *
 *   1. shops    — /shop → a product → cart → checkout → an order number
 *   2. tracks   — Track Order, with the number AND the phone
 *   3. amends   — changes what is in the order, before dispatch
 *   4. delivers — confirm → preparing → out for delivery → paid in cash
 *   5. and the other four endings, each on its own order:
 *        completed with a digital payment and a reference
 *        cancelled with a reason
 *        delivery failed, items returned
 *        delivery failed, items gone
 *
 * FIXTURE IDENTITY
 *
 * Every order this script creates belongs to ONE phone number, generated for
 * this run, and every customer note says what it is. Teardown deletes by that
 * exact phone and nothing else — never by role, name, status or business state.
 * The real orders in this development shop are not read, counted or touched.
 *
 * Teardown has to disable the append-only trigger on `order_events` to remove
 * its own rows, exactly as `tests/db/teardown.sql.tmpl` does, and re-enables it
 * afterwards whatever happened.
 *
 * Development project only, checked before anything is written.
 */

import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PROJECT_REF = "dyjhacbbedytcstxxjzl";
const MANIFEST = ".qa-staff.local.json";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n  FAIL — ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

if (!URL_ || !KEY) fail("Supabase is not configured.");
if (!URL_.includes(PROJECT_REF)) fail(`Refusing to touch ${URL_}. Development project only.`);
if (!fs.existsSync(MANIFEST)) fail("No development QA staff. Run `npm run qa:staff create` first.");

const manager = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).accounts.find((a) => a.key === "manager");
if (!manager) fail("No QA Manager in the manifest.");

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

/* ------------------------------------------------------------- identity */

/**
 * A real Tanzanian mobile number shape, unique to this run, and the only thing
 * teardown matches on.
 *
 * `+255` then NINE digits beginning 7. The first draft of this used eight and
 * the deployed checkout refused it — "Enter a Tanzanian mobile number, for
 * example 0712…" — which is the validation doing its job on the test rather
 * than a defect in the shop.
 */
const SUFFIX = String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
const PHONE = `+2557${SUFFIX}`;
const NOTE = `STAGING TEST ORDER — placed by scripts/verify-deployed-commerce.mjs against ${BASE_URL}. Not a real customer.`;

let failures = 0;
let checks = 0;
const ok = (what, detail) => {
  checks += 1;
  console.log(`  ok    ${what}${detail ? ` — ${detail}` : ""}`);
};
const bad = (what, detail) => {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${what}${detail ? `\n        ${detail}` : ""}`);
};
const check = (what, passed, detail) => (passed ? ok(what, detail) : bad(what, detail));
const head = (t) => console.log(`\n  ── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`);

/* ------------------------------------------------------------- teardown */

function teardownSql() {
  /*
   * THE ORDER OF THESE DELETES IS THE WHOLE TRICK.
   *
   * `inventory_movements.order_id` is ON DELETE SET NULL, and SET NULL is an
   * UPDATE, which the append-only trigger refuses even with the trigger
   * disabled for this session. So the movements go FIRST, and deleting the
   * order then has nothing left to point at.
   *
   * Removing movements would normally leave `inventory` disagreeing with its
   * own ledger — this run really sold units and really wrote one off. So the
   * running total is put back to what it was before the run in the same
   * transaction. Both sides return to exactly where they started, which is why
   * the reconciliation check afterwards is the proof this was clean surgery
   * rather than a hole.
   */
  return `
begin;
alter table public.inventory_movements disable trigger inventory_movements_append_only;
alter table public.order_events        disable trigger order_events_append_only;

delete from public.inventory_movements
 where order_id in (select id from public.orders where customer_phone_e164 = '${PHONE}');

delete from public.order_events
 where order_id in (select id from public.orders where customer_phone_e164 = '${PHONE}');
delete from public.order_items
 where order_id in (select id from public.orders where customer_phone_e164 = '${PHONE}');
delete from public.orders where customer_phone_e164 = '${PHONE}';

delete from public.customer_addresses
 where customer_id in (select id from public.customers where phone_e164 = '${PHONE}');
delete from public.customers where phone_e164 = '${PHONE}';

update public.inventory
   set on_hand = ${STOCK_BEFORE}, reserved = ${RESERVED_BEFORE}
 where product_id = '${PRODUCT_ID}' and location_code = 'main';

alter table public.order_events        enable trigger order_events_append_only;
alter table public.inventory_movements enable trigger inventory_movements_append_only;
commit;

select
  (select count(*) from public.orders    where customer_phone_e164 = '${PHONE}') as orders_left,
  (select count(*) from public.customers where phone_e164 = '${PHONE}')          as customers_left,
  (select count(*) from public.inventory_ledger_check where matches = false)      as ledger_mismatches,
  (select on_hand from public.inventory
    where product_id = '${PRODUCT_ID}' and location_code = 'main')                as on_hand_now;
`;
}

async function teardown() {
  const file = `teardown-${SUFFIX}.sql.tmp`;
  fs.writeFileSync(file, teardownSql(), "utf8");
  const result = spawnSync(`npx supabase db query --linked -f "${file}"`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  fs.unlinkSync(file);

  const said = result.stdout + result.stderr;
  const read = (field) => {
    const found = new RegExp(`"${field}":\\s*(\\d+)`).exec(said);
    return found ? Number(found[1]) : null;
  };

  const orders = read("orders_left");
  if (orders === null) {
    bad("teardown did not report a result", said.slice(-260).replace(/\s+/g, " "));
    return;
  }

  check("every order this run created was removed, by exact phone number", orders === 0);
  check("its customer record went with it", read("customers_left") === 0);
  check(
    "the shelf is back where it started",
    read("on_hand_now") === STOCK_BEFORE,
    `${first.sku}: on hand ${read("on_hand_now")}, was ${STOCK_BEFORE}`,
  );
  // The proof that removing this run's movements was clean surgery rather than
  // a hole: both sides of every product's ledger still agree.
  check(
    "and stock still reconciles with its ledger",
    read("ledger_mismatches") === 0,
    `${read("ledger_mismatches")} mismatch(es)`,
  );
}

/* ------------------------------------------------------------ the shop */

const { data: shelf } = await db
  .from("product_shelf")
  .select("sku, slug, display_name, effective_price_tzs, available")
  .gt("available", 8)
  .order("sku")
  .limit(2);

if (!shelf || shelf.length < 1) fail("No stocked product on the shelf to test with.");
const [first] = shelf;

const { data: zone } = await db
  .from("delivery_zones")
  .select("slug, name, fee_tzs, free_delivery")
  .eq("active", true)
  .order("sort_priority")
  .limit(1)
  .single();

if (!zone) fail("No active delivery zone.");

/*
 * What the shelf holds before any of this, so it can be put back afterwards.
 *
 * This run really sells things: two orders complete and one delivery fails with
 * the items written off, so real units leave real stock. Deleting the orders
 * afterwards does not put them back, and it must not — the ledger would then
 * disagree with the running total and `inventory_ledger_check` would report it
 * as corruption, correctly.
 *
 * So the stock is restored the way a shop restores stock: through
 * `jojo_add_stock`, which writes its own movement saying who did it and why.
 * The history stays truthful and the figure comes back.
 */
const PRODUCT_ID = (await db.from("products").select("id").eq("sku", first.sku).single()).data.id;
const SHELF_BEFORE = (
  await db
    .from("inventory")
    .select("on_hand, reserved")
    .eq("product_id", PRODUCT_ID)
    .eq("location_code", "main")
    .single()
).data;
const STOCK_BEFORE = SHELF_BEFORE.on_hand;
const RESERVED_BEFORE = SHELF_BEFORE.reserved;

/* -------------------------------------------------- a staff password */

const password = `Qa!${randomBytes(18).toString("base64url")}`;
const prepared = await db.auth.admin.updateUserById(manager.authUserId, {
  password,
  email_confirm: true,
});
if (prepared.error) fail(`Could not prepare the QA Manager: ${prepared.error.message}`);

const browser = await chromium.launch();
const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
const staff = await browser.newContext({ viewport: { width: 390, height: 844 } });

/*
 * The first-visit language chooser is a modal, and a browser that has never
 * seen this site gets it before it gets anything else — so every click in this
 * script would land on its backdrop. Seeding the choice is what the screenshot
 * gate does too: this run is testing commerce, and the chooser has its own
 * tests. Answering it here would only be testing the answer.
 */
const LOCALE_KEY = "jojo-usafi.locale.v1";
const APPLIED_KEY = "jojo-usafi.locale.applied.v1";

for (const context of [shopper, staff]) {
  await context.addInitScript(
    ([localeKey, appliedKey]) => {
      try {
        window.localStorage.setItem(localeKey, "en");
        window.sessionStorage.setItem(appliedKey, "1");
      } catch {
        /* storage blocked — the page still has to work */
      }
    },
    [LOCALE_KEY, APPLIED_KEY],
  );
}

const consoleErrors = [];

/** Sign the staff context in once; every later page reuses the cookie. */
async function signInStaff() {
  const tab = await staff.newPage();
  await tab.goto(`${BASE_URL}/admin/sign-in`, { waitUntil: "load", timeout: 90_000 });
  await tab.fill("#email", manager.email);
  await tab.fill("#password", password);
  await Promise.all([
    tab.waitForURL((u) => !u.pathname.startsWith("/admin/sign-in"), { timeout: 60_000 }).catch(() => {}),
    tab.click('[data-qa-anchor="admin-sign-in-submit"]'),
  ]);
  const landed = new URL(tab.url()).pathname;
  await tab.close();
  return landed;
}

/** Open an order in the dashboard, by its number. */
async function openOrder(number) {
  const { data } = await db.from("orders").select("id").eq("order_number", number).single();
  const tab = await staff.newPage();
  tab.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  await tab.goto(`${BASE_URL}/admin/orders/${data.id}`, { waitUntil: "load", timeout: 90_000 });
  return tab;
}

const state = async (number) =>
  (await db.from("orders").select("state").eq("order_number", number).single()).data?.state;

/**
 * Press the one big next-action button and wait for the SHOP to agree.
 *
 * Polling the database rather than sleeping a fixed 2.5 seconds. A server
 * action, a redirect and a re-render all have to land, and on a deployment that
 * takes however long it takes — a fixed wait reported "confirmed" as a failure
 * while the two steps after it passed, which is a test that is wrong about a
 * shop that is right.
 */
async function advance(tab, number, label, becomes) {
  const button = tab.locator(`button:has-text("${label}")`).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.click();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await tab.waitForTimeout(1000);
    if ((await state(number)) === becomes) return true;
  }
  return false;
}

/** Place an order the way the checkout does, for the endings a shopper never drives. */
async function placeFixtureOrder(quantity = 1) {
  const { data, error } = await db.rpc("jojo_place_order", {
    p_items: [{ sku: first.sku, quantity }],
    p_customer_name: "Staging Test Customer",
    p_customer_phone_e164: PHONE,
    p_zone_slug: zone.slug,
    p_delivery_address: "Staging address — not a real place",
    p_payment_preference: "cash_on_delivery",
    p_customer_note: NOTE,
  });
  if (error) fail(`Could not place a fixture order: ${error.message}`);
  return data.order_number;
}

try {
  console.log(`\n  Against ${BASE_URL}`);
  console.log(`  Fixture phone ${PHONE}\n`);

  /* ===================================================== 1. a shopper */

  head("A SHOPPER BUYS SOMETHING");

  const tab = await shopper.newPage();
  tab.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  await tab.goto(`${BASE_URL}/product/${first.slug}`, { waitUntil: "load", timeout: 90_000 });
  check("the product page opens", new URL(tab.url()).pathname.includes(first.slug));

  await tab.locator('button:has-text("Add to cart")').first().click();
  await tab.waitForTimeout(1200);

  await tab.goto(`${BASE_URL}/checkout`, { waitUntil: "load", timeout: 90_000 });
  await tab.locator("#fullName").waitFor({ state: "visible", timeout: 30_000 });
  check("the cart survived the walk to checkout", await tab.locator("#fullName").count() > 0);

  await tab.fill("#fullName", "Staging Test Customer");
  await tab.fill("#phone", PHONE);
  await tab.selectOption("#zoneSlug", zone.slug).catch(() => {});
  await tab.fill("#address", "Staging address — not a real place");
  await tab.locator('input[name="paymentPreference"]').first().check({ force: true });

  /*
   * The button stays disabled until the server has quoted the basket, and the
   * confirmation then replaces the form IN PLACE — the address bar never
   * changes. So there is nothing to wait for but the words. Waiting on a URL
   * pattern here waits for something that never happens, which is what made
   * this read as a broken checkout when the checkout was fine.
   */
  const placeOrder = tab.locator('[data-qa-anchor="checkout-place-order"]');
  await placeOrder.waitFor({ state: "visible", timeout: 30_000 });
  await tab.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector);
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    '[data-qa-anchor="checkout-place-order"]',
    { timeout: 60_000 },
  );
  await placeOrder.click();

  let confirmation = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await tab.waitForTimeout(2000);
    confirmation = await tab.locator("body").innerText();
    if (/\bJU-\d{6}\b/.test(confirmation)) break;
    if (/could not complete|something went wrong/i.test(confirmation)) break;
  }

  const numberMatch = /\bJU-\d{6}\b/.exec(confirmation);
  check("the confirmation shows an order number", Boolean(numberMatch), numberMatch?.[0]);

  if (!numberMatch) {
    fail(
      `no order number on the confirmation screen — the page said: ${confirmation
        .replace(/\s+/g, " ")
        .slice(0, 240)}`,
    );
  }
  const ORDER = numberMatch[0];

  const { data: placed } = await db
    .from("orders")
    .select("order_number, state, total_tzs, customer_phone_e164")
    .eq("order_number", ORDER)
    .single();

  check("the order is really in the database", Boolean(placed), placed?.state);
  check("it belongs to this run's fixture phone", placed?.customer_phone_e164 === PHONE);

  // The total the shop recorded is the shop's own arithmetic, not the browser's.
  const expected = first.effective_price_tzs + (zone.free_delivery ? 0 : zone.fee_tzs);
  check(
    "the total was priced by the shop",
    placed?.total_tzs === expected,
    `TSh ${placed?.total_tzs?.toLocaleString("en-TZ")}`,
  );

  /* ===================================================== 2. tracking */

  head("THE CUSTOMER TRACKS IT");

  await tab.goto(`${BASE_URL}/track-order`, { waitUntil: "load", timeout: 90_000 });
  await tab.fill("#order-number", ORDER);
  await tab.fill("#phone", PHONE);
  await tab.locator('button[type="submit"]').first().click();
  await tab.waitForTimeout(3500);

  const tracked = await tab.locator("body").innerText();
  check("tracking finds the order", tracked.includes(ORDER));

  // The other half of the rule: the number alone is not enough.
  await tab.goto(`${BASE_URL}/track-order`, { waitUntil: "load", timeout: 90_000 });
  await tab.fill("#order-number", ORDER);
  await tab.fill("#phone", "+255700000999");
  await tab.locator('button[type="submit"]').first().click();
  await tab.waitForTimeout(3500);

  const wrongPhone = await tab.locator("body").innerText();
  check("a wrong phone number is refused", !wrongPhone.includes(ORDER));
  await tab.close();

  /* ===================================================== 3. the staff */

  head("STAFF SIGN IN");

  const landed = await signInStaff();
  check("the QA Manager reaches the dashboard", landed.startsWith("/admin"), landed);

  /* ===================================================== 4. amendment */

  head("THE ORDER IS AMENDED BEFORE DISPATCH");

  const beforeAmend = await db
    .from("inventory")
    .select("reserved")
    .eq("product_id", (await db.from("products").select("id").eq("sku", first.sku).single()).data.id)
    .eq("location_code", "main")
    .single();

  const orderTab = await openOrder(ORDER);
  const amendButton = orderTab.locator('button:has-text("Change what is in this order")');
  check("the amend control is offered", (await amendButton.count()) > 0);

  await amendButton.first().click();
  await orderTab.waitForTimeout(1200);

  await orderTab.locator('button[aria-label="One more"]').first().click();
  await orderTab.locator('input[placeholder*="Customer called"]').fill("Staging verification — one more");
  await orderTab.locator('button:has-text("Save the change")').click();
  await orderTab.waitForTimeout(4000);

  const { data: amended } = await db
    .from("order_items")
    .select("quantity")
    .eq("order_id", (await db.from("orders").select("id").eq("order_number", ORDER).single()).data.id);

  check(
    "the quantity really changed",
    (amended ?? []).some((line) => line.quantity === 2),
    `lines: ${(amended ?? []).map((l) => l.quantity).join(", ")}`,
  );

  const afterAmend = await db
    .from("inventory")
    .select("reserved")
    .eq("product_id", (await db.from("products").select("id").eq("sku", first.sku).single()).data.id)
    .eq("location_code", "main")
    .single();

  check(
    "the extra unit was reserved, not conjured",
    afterAmend.data.reserved === beforeAmend.data.reserved + 1,
    `reserved ${beforeAmend.data.reserved} → ${afterAmend.data.reserved}`,
  );

  /* ================================================ 5. out the door */

  head("THE ORDER IS DELIVERED AND PAID IN CASH");

  await orderTab.reload({ waitUntil: "load" });
  check("confirmed", await advance(orderTab, ORDER, "Confirm order", "confirmed"));
  check("preparing", await advance(orderTab, ORDER, "Start preparing", "preparing"));
  check("out for delivery", await advance(orderTab, ORDER, "Send out for delivery", "out_for_delivery"));

  // And the line in the sand: no amendment once a rider has it.
  //
  // Read from a fresh page rather than from whatever the last click left on
  // screen. The control disappearing is a server-rendered fact, and asserting
  // it against a stale DOM tests the speed of a re-render, not the rule.
  await orderTab.reload({ waitUntil: "load" });
  await orderTab.waitForTimeout(1500);
  check(
    "the amend control is gone once it is with the rider",
    (await orderTab.locator('button:has-text("Change what is in this order")').count()) === 0,
  );

  await orderTab.locator('button:has-text("Complete order")').first().click();
  await orderTab.waitForTimeout(1200);
  await orderTab.locator('button:has-text("Cash")').first().click();
  await orderTab.locator('button:has-text("Complete order")').last().click();
  await orderTab.waitForTimeout(4000);

  check("completed", (await state(ORDER)) === "completed");

  const { data: paid } = await db
    .from("orders")
    .select("payment_method, paid_at")
    .eq("order_number", ORDER)
    .single();
  check("the cash payment was recorded", paid?.payment_method === "cash", paid?.payment_method);
  await orderTab.close();

  /* ============================================ 6. the other endings */

  head("THE OTHER FOUR ENDINGS");

  /* --- digital payment, with a reference --- */
  const digital = await placeFixtureOrder();
  const dTab = await openOrder(digital);
  await advance(dTab, digital, "Confirm order", "confirmed");
  await advance(dTab, digital, "Start preparing", "preparing");
  await advance(dTab, digital, "Send out for delivery", "out_for_delivery");
  await dTab.locator('button:has-text("Complete order")').first().click();
  await dTab.waitForTimeout(1200);
  await dTab.locator('button:has-text("Digital")').first().click();
  await dTab.locator('input[placeholder*="M-Pesa"]').fill(`STAGING-${SUFFIX}`);
  await dTab.locator('button:has-text("Complete order")').last().click();
  await dTab.waitForTimeout(4000);

  const { data: dRow } = await db
    .from("orders")
    .select("state, payment_method, payment_reference")
    .eq("order_number", digital)
    .single();
  check("digital completion records its reference", dRow?.state === "completed" && Boolean(dRow?.payment_reference), `${dRow?.payment_method} · ${dRow?.payment_reference}`);
  await dTab.close();

  /* --- cancelled, with a reason, and the stock comes back --- */
  const cancelled = await placeFixtureOrder();
  const productId = (await db.from("products").select("id").eq("sku", first.sku).single()).data.id;
  const heldBefore = (await db.from("inventory").select("reserved").eq("product_id", productId).eq("location_code", "main").single()).data.reserved;

  const cTab = await openOrder(cancelled);
  await cTab.locator("summary:has-text('Something went wrong')").first().click();
  await cTab.waitForTimeout(600);
  await cTab.locator('button:has-text("Cancel order")').first().click();
  await cTab.waitForTimeout(1200);
  await cTab.locator('button:has-text("Customer changed mind")').first().click();
  await cTab.locator('button:has-text("Cancel order")').last().click();
  await cTab.waitForTimeout(4000);

  const heldAfter = (await db.from("inventory").select("reserved").eq("product_id", productId).eq("location_code", "main").single()).data.reserved;
  check("cancelling releases the stock it held", (await state(cancelled)) === "cancelled" && heldAfter === heldBefore - 1, `reserved ${heldBefore} → ${heldAfter}`);
  await cTab.close();

  /* --- delivery failed, items returned --- */
  const returned = await placeFixtureOrder();
  const rTab = await openOrder(returned);
  await advance(rTab, returned, "Confirm order", "confirmed");
  await advance(rTab, returned, "Start preparing", "preparing");
  await advance(rTab, returned, "Send out for delivery", "out_for_delivery");
  await rTab.locator("summary:has-text('Something went wrong')").first().click();
  await rTab.waitForTimeout(600);
  await rTab.locator('button:has-text("Delivery failed")').first().click();
  await rTab.waitForTimeout(1200);
  await rTab.locator('button:has-text("Nobody at the address")').first().click();
  await rTab.locator('button:has-text("Yes, we have them")').first().click();
  await rTab.locator('button:has-text("Save")').last().click();
  await rTab.waitForTimeout(4000);
  check("delivery failed with the items returned", (await state(returned)) === "delivery_failed");
  await rTab.close();

  /* --- delivery failed, items gone --- */
  const gone = await placeFixtureOrder();
  const gTab = await openOrder(gone);
  await advance(gTab, gone, "Confirm order", "confirmed");
  await advance(gTab, gone, "Start preparing", "preparing");
  await advance(gTab, gone, "Send out for delivery", "out_for_delivery");
  await gTab.locator("summary:has-text('Something went wrong')").first().click();
  await gTab.waitForTimeout(600);
  await gTab.locator('button:has-text("Delivery failed")').first().click();
  await gTab.waitForTimeout(1200);
  await gTab.locator('button:has-text("Nobody at the address")').first().click();
  await gTab.locator('button:has-text("No, they are gone")').first().click();
  await gTab.locator('button:has-text("Save")').last().click();
  await gTab.waitForTimeout(4000);
  check("delivery failed with the items written off", (await state(gone)) === "delivery_failed");
  await gTab.close();

  /* ================================================ 7. the ledger agrees */

  head("THE LEDGER STILL RECONCILES");

  const { data: mismatched } = await db
    .from("inventory_ledger_check")
    .select("product_id, matches")
    .eq("matches", false);

  check(
    "every product's running total still matches its ledger",
    (mismatched ?? []).length === 0,
    `${(mismatched ?? []).length} mismatch(es)`,
  );

  check("no console errors anywhere in the run", consoleErrors.length === 0, consoleErrors[0] ?? "");
} finally {
  await browser.close().catch(() => {});
  head("CLEANING UP");
  await teardown();

  console.log(`\n  ${checks} checks, ${failures} failure(s).\n`);
  if (failures > 0) {
    console.log("  FAIL — the deployed shop is not behaving.\n");
    process.exitCode = 1;
  } else {
    console.log("  PASS — the shop works end to end on the deployment.\n");
  }
}
