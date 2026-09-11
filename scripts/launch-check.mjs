#!/usr/bin/env node
/**
 * Is this shop ready to open?
 *
 *   npm run launch:check                    # against the development project
 *   LAUNCH_MODE=production npm run launch:check
 *
 * WHAT IT IS FOR
 *
 * Every gate in this repository answers "does the software work". None of them
 * answers "would opening this shop today embarrass anybody" — and the answer to
 * that is mostly business data, not code. A placeholder telephone number passes
 * typecheck, lint, 203 unit tests and 260 database tests, and then a customer
 * cannot reach anybody.
 *
 * So this reads the database and reports three kinds of thing:
 *
 *   BLOCKED   opening with this would harm a customer or the business
 *   WARNING   worth knowing, not fatal
 *   PASS      confirmed
 *
 * It never prints a secret, and it reads nothing but its own project. Running it
 * against development is expected to be BLOCKED on several items — that is the
 * point of the list, not a failure of the tool. `LAUNCH_MODE=production` makes
 * it strict about the things that are only wrong in production, such as
 * `APP_ENV`.
 *
 * Exit code is 1 when anything is BLOCKED, so it is usable as a gate.
 */

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const PRODUCTION_MODE = process.env.LAUNCH_MODE === "production";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error("\n  Supabase is not configured. Copy .env.example to .env.local.\n");
  process.exit(1);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const results = [];
const record = (state, what, detail) => results.push({ state, what, detail });
const pass = (what, detail) => record("PASS", what, detail);
const warn = (what, detail) => record("WARNING", what, detail);
const block = (what, detail) => record("BLOCKED", what, detail);

const head = (t) => console.log(`\n  ── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`);

/* ------------------------------------------------ the shop's own details */

const { data: settings } = await db
  .from("shop_settings")
  .select(
    "whatsapp_e164, phone_e164, contact_email, address_line, logo_media_id, reservation_warning_minutes, reservation_expiry_minutes",
  )
  .eq("id", true)
  .maybeSingle();

head("HOW CUSTOMERS REACH THE SHOP");

const contact = [
  ["WhatsApp number", settings?.whatsapp_e164],
  ["Phone number", settings?.phone_e164],
  ["Email address", settings?.contact_email],
  ["Shop address", settings?.address_line],
];

for (const [label, value] of contact) {
  if (value) pass(label, "set");
  else block(label, "not set — the storefront falls back to a placeholder nobody answers");
}

if (settings?.logo_media_id) pass("Logo", "on file");
else warn("Logo", "not set — the site shows the JOJO USAFI wordmark");

/* ------------------------------------------------------ holding stock */

head("HOW LONG AN UNCONFIRMED ORDER HOLDS STOCK");

if (settings?.reservation_expiry_minutes) {
  pass("Reservation expiry", `${settings.reservation_expiry_minutes} minutes`);
  if (
    settings.reservation_warning_minutes &&
    settings.reservation_warning_minutes > settings.reservation_expiry_minutes
  ) {
    block("Reservation warning", "is longer than the expiry, so it would never fire");
  }
} else {
  block(
    "Reservation expiry",
    "not set — nothing ever expires, so an abandoned order holds its stock for ever",
  );
}

/* -------------------------------------------------------- delivery */

head("DELIVERY");

const { data: zones } = await db
  .from("delivery_zones")
  .select("name, fee_tzs, free_delivery, active, notes")
  .eq("active", true);

const active = zones ?? [];
const placeholders = active.filter((z) => (z.notes ?? "").startsWith("DEVELOPMENT FIXTURE"));

if (active.length === 0) {
  block("Delivery areas", "none are active — nobody could check out");
} else if (placeholders.length > 0) {
  block(
    "Delivery areas",
    `${placeholders.length} of ${active.length} are development placeholders: ${placeholders.map((z) => z.name).join(", ")}`,
  );
} else {
  pass("Delivery areas", `${active.length} real areas`);
}

/* ------------------------------------------------------- the catalogue */

head("THE CATALOGUE");

const { count: products } = await db.from("products").select("*", { count: "exact", head: true });
const { count: shelf } = await db.from("product_shelf").select("*", { count: "exact", head: true });

pass("Products in the catalogue", String(products ?? 0));
if ((shelf ?? 0) === 0) block("Products a shopper can buy", "none are on the shelf");
else pass("Products a shopper can buy", String(shelf));

const { data: withoutPhoto } = await db
  .from("products")
  .select("sku, product_media ( role )");

const missingPhoto = (withoutPhoto ?? []).filter(
  (row) => !(row.product_media ?? []).some((m) => m.role === "primary"),
);

if (missingPhoto.length === 0) {
  pass("Products with a photograph", "all of them");
} else {
  warn(
    "Products with no photograph",
    `${missingPhoto.length} are held off the website until they have one`,
  );
}

// The two watchlist SKUs, by name, because both are decisions rather than bugs.
const { data: blocked } = await db
  .from("products")
  .select("sku, price_tzs, lifecycle")
  .eq("sku", "EP01-A01")
  .maybeSingle();

if (!blocked) {
  warn("EP01-A01", "not in this catalogue");
} else if (blocked.price_tzs < 1000) {
  block("EP01-A01", `still priced at TSh ${blocked.price_tzs} — a price nobody has confirmed`);
} else {
  pass("EP01-A01", `priced at TSh ${blocked.price_tzs.toLocaleString("en-TZ")}`);
}

const { data: orphanAssets } = await db
  .from("media_assets")
  .select("storage_path, product_media ( id )")
  .eq("storage_bucket", "product-media");

const orphans = (orphanAssets ?? []).filter((row) => (row.product_media ?? []).length === 0);
if (orphans.length > 0) {
  warn(
    "Photographs with no product",
    `${orphans.length}, including EP23-A02 if it is still an orphan. Nothing is attached automatically`,
  );
} else {
  pass("Photographs with no product", "none");
}

/* ---------------------------------------------------------- the ledger */

head("STOCK AND THE LEDGER");

const { count: mismatches } = await db
  .from("inventory_ledger_check")
  .select("*", { count: "exact", head: true })
  .eq("matches", false);

if ((mismatches ?? 0) === 0) pass("Stock reconciles with its ledger", "every product");
else block("Stock does not reconcile", `${mismatches} product(s) disagree with their own ledger`);

const { data: opening } = await db
  .from("inventory_movements")
  .select("id")
  .eq("kind", "opening_count")
  .limit(1);

if (PRODUCTION_MODE && (!opening || opening.length === 0)) {
  block(
    "Opening stock count",
    "no opening-count movement exists — production stock must be counted, not copied",
  );
} else if (opening && opening.length > 0) {
  pass("Opening stock count", "recorded");
} else {
  warn("Opening stock count", "none — expected in development, required before production");
}

/* ----------------------------------------------------------- the staff */

head("WHO CAN USE THE DASHBOARD");

const { data: staff } = await db.from("admin_profiles").select("full_name, role, active, email");
const owners = (staff ?? []).filter((s) => s.role === "owner" && s.active);

if (owners.length === 0) block("Owner", "the shop has no active Owner");
else pass("Owner", `${owners.length} active`);

const fixtures = (staff ?? []).filter(
  (s) => (s.email ?? "").includes("jojo-usafi.invalid") || (s.full_name ?? "").startsWith("ZZ"),
);
if (PRODUCTION_MODE && fixtures.length > 0) {
  block("Development staff fixtures", `${fixtures.length} still present in a production database`);
} else if (fixtures.length > 0) {
  warn("Development staff fixtures", `${fixtures.length} — expected in development, never in production`);
} else {
  pass("Development staff fixtures", "none");
}

/* ------------------------------------------------------------- orders */

head("ORDERS");

const { count: orders } = await db.from("orders").select("*", { count: "exact", head: true });

if (PRODUCTION_MODE && (orders ?? 0) > 0) {
  block("Orders in a fresh production database", `${orders} already exist — production starts empty`);
} else {
  pass("Orders", `${orders ?? 0}${PRODUCTION_MODE ? "" : " (development)"}`);
}

/* -------------------------------------------------------- the website */

head("THE DEPLOYMENT");

const appEnv = process.env.APP_ENV ?? "(unset)";
if (PRODUCTION_MODE) {
  if (appEnv === "production") pass("APP_ENV", "production — the shop is indexable");
  else block("APP_ENV", `${appEnv} — the real shop would be hidden from Google`);
} else if (appEnv === "production") {
  block("APP_ENV", "production, on a development environment — this would invite indexing");
} else {
  pass("APP_ENV", `${appEnv} — staging is correctly withheld from search engines`);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
if (!siteUrl) warn("NEXT_PUBLIC_SITE_URL", "unset — canonical URLs fall back to localhost");
else if (PRODUCTION_MODE && siteUrl.includes("vercel.app")) {
  warn("NEXT_PUBLIC_SITE_URL", "still a vercel.app address — a real domain has not been pointed");
} else pass("NEXT_PUBLIC_SITE_URL", siteUrl);

/* ------------------------------------------------------------ report */

const counts = {
  PASS: results.filter((r) => r.state === "PASS").length,
  WARNING: results.filter((r) => r.state === "WARNING").length,
  BLOCKED: results.filter((r) => r.state === "BLOCKED").length,
};

console.log("");
for (const { state, what, detail } of results) {
  const tag = state === "PASS" ? "ok     " : state === "WARNING" ? "warn   " : "BLOCKED";
  console.log(`  ${tag} ${what}${detail ? ` — ${detail}` : ""}`);
}

console.log(
  `\n  ${counts.PASS} pass · ${counts.WARNING} warning · ${counts.BLOCKED} blocked` +
    `${PRODUCTION_MODE ? "  (production mode)" : "  (development mode)"}\n`,
);

if (counts.BLOCKED > 0) {
  console.log(
    PRODUCTION_MODE
      ? "  NOT READY — every BLOCKED line above has to be settled before the shop opens.\n"
      : "  NOT READY TO LAUNCH — which is expected on the development project.\n" +
        "  Each BLOCKED line is business input, not a defect. See docs/LAUNCH_CHECKLIST.md.\n",
  );
  process.exit(1);
}

console.log("  READY — nothing is blocking a launch.\n");
