#!/usr/bin/env node
/**
 * Two DEVELOPMENT orders, placed the way a customer places one.
 *
 *   node scripts/seed-dev-orders.mjs
 *
 * WHY THIS EXISTS
 *
 * The admin dashboard cannot be looked at — or screenshotted, or handed to
 * Ibrahim to try — with an empty orders list. Every operational screen, every
 * next-action button and all four dialogs need an order to act on.
 *
 * WHAT IT IS CAREFUL ABOUT
 *
 * It does not INSERT an order. It calls `jojo_place_order`, the same function
 * the checkout server action calls, so the rows it creates are shaped exactly
 * like a real one: the stock is really reserved, the order number really comes
 * from the sequence, and the first `order_events` row is really written. A
 * hand-built order would be a lie that the dashboard would faithfully display.
 *
 * Both orders say what they are in the customer note, so nobody looking at the
 * development dashboard mistakes them for business. It is idempotent: if an
 * order carrying the marker already exists, it does nothing.
 *
 * DEVELOPMENT PROJECT ONLY, checked before anything is written.
 */

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = "dyjhacbbedytcstxxjzl";

const MARKER = "DEVELOPMENT ORDER — placed by scripts/seed-dev-orders.mjs so the dashboard has something to work on. Not a real customer.";

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!URL_ || !KEY) fail("Supabase is not configured. Copy .env.example to .env.local.");
if (!URL_.includes(PROJECT_REF)) {
  fail(`Refusing to write orders into ${URL_}. Development project ${PROJECT_REF} only.`);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

/*
 * Already done? Then stop — this must never pile up orders on every run.
 *
 * "Done" means there is a development order that can still be AMENDED — one of
 * the four states before dispatch. That is a stricter test than "not finished",
 * and deliberately so: an amendable order carries every control the dashboard
 * has (the next action, the two things-went-wrong dialogs, and the amendment
 * sheet), so one of them is enough for the QA gate to photograph all of them.
 *
 * Build 10's QA found this the hard way. A development order was still open —
 * but it was out for delivery, which has no amendment and no cancellation, so
 * the gate correctly reported that it had nothing left to audit.
 */
const AMENDABLE_STATES = ["new", "awaiting_confirmation", "confirmed", "preparing"];

const { data: existing } = await db
  .from("orders")
  .select("order_number, state")
  .eq("customer_note", MARKER)
  .in("state", AMENDABLE_STATES)
  .limit(1);

if (existing && existing.length > 0) {
  console.log(
    `\n  A development order can still be amended (${existing[0].order_number} — ${existing[0].state}). Nothing to do.\n`,
  );
  process.exit(0);
}

/* An active zone and two products that are genuinely in stock. */
const { data: zone } = await db
  .from("delivery_zones")
  .select("slug, name")
  .eq("active", true)
  .order("sort_priority")
  .limit(1)
  .maybeSingle();

if (!zone) fail("No active delivery zone. Run `node scripts/seed-dev-zones.mjs` first.");

const { data: shelf } = await db
  .from("product_shelf")
  .select("sku, display_name, available")
  .gt("available", 3)
  .order("sku")
  .limit(3);

if (!shelf || shelf.length < 2) fail("Not enough products in stock to place a development order.");

const orders = [
  {
    label: "waiting to be confirmed",
    advanceTo: null,
    items: [
      { sku: shelf[0].sku, quantity: 2 },
      { sku: shelf[1].sku, quantity: 1 },
    ],
    name: "Development Test Customer",
    phone: "+255700000101",
    preference: "cash_on_delivery",
  },
  {
    label: "out for delivery",
    advanceTo: ["confirmed", "preparing", "out_for_delivery"],
    items: [{ sku: shelf[shelf.length - 1].sku, quantity: 1 }],
    name: "Development Test Customer Two",
    phone: "+255700000102",
    preference: "digital_on_delivery",
  },
];

console.log("");

for (const order of orders) {
  const { data, error } = await db.rpc("jojo_place_order", {
    p_items: order.items,
    p_customer_name: order.name,
    p_customer_phone_e164: order.phone,
    p_zone_slug: zone.slug,
    p_delivery_address: "Development address — not a real place",
    p_payment_preference: order.preference,
    p_customer_note: MARKER,
  });

  if (error) fail(`Could not place the development order: ${error.message}`);

  for (const state of order.advanceTo ?? []) {
    const { error: moveError } = await db.rpc("jojo_advance_order", {
      p_order_id: data.order_id,
      p_to_state: state,
    });
    if (moveError) fail(`Could not move ${data.order_number} to ${state}: ${moveError.message}`);
  }

  console.log(`  ${data.order_number}  ${order.label}`);
}

console.log(`\n  Two development orders placed in ${zone.name}. They are marked in the customer note.\n`);
