#!/usr/bin/env node
/**
 * Development delivery zones — CLEARLY MARKED, NOT PRODUCTION TRUTH.
 *
 *   node scripts/seed-dev-zones.mjs
 *
 * Checkout cannot be exercised without at least one active delivery area, and
 * the real list of areas and fees is Ibrahim's decision, not this script's. So
 * these rows exist to make the development checkout testable and every one of
 * them carries a `notes` value saying exactly that.
 *
 * They are NOT seeded by `supabase/seed.sql`, which deliberately inserts no
 * business data, and they must be replaced — through the admin Delivery Zones
 * screen, which writes real rows — before anything goes live.
 *
 * The fees below are the prototype's illustrative figures. They are a placeholder
 * for a number, not a proposal.
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

if (!URL_ || !KEY) {
  console.error("\nSupabase is not configured. Copy .env.example to .env.local.\n");
  process.exit(1);
}
if (!URL_.includes(PROJECT_REF)) {
  console.error(`\nRefusing to seed anything into ${URL_}. Development project only.\n`);
  process.exit(1);
}

const NOTES =
  "DEVELOPMENT FIXTURE — placeholder area and fee so checkout can be tested. " +
  "Awaiting Ibrahim's real delivery-zone list and fees. Not production truth.";

const zones = [
  { slug: "upanga", name: "Upanga", fee_tzs: 4000, sort_priority: 10 },
  { slug: "mikocheni", name: "Mikocheni", fee_tzs: 4000, sort_priority: 20 },
  { slug: "masaki", name: "Masaki", fee_tzs: 6000, sort_priority: 30 },
  { slug: "kariakoo", name: "Kariakoo", fee_tzs: 3000, sort_priority: 40 },
];

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const { error } = await db.from("delivery_zones").upsert(
  zones.map((zone) => ({ ...zone, free_delivery: false, active: true, notes: NOTES })),
  { onConflict: "slug" },
);

if (error) {
  console.error(`\nCould not write the development zones: ${error.message}\n`);
  process.exit(1);
}

const { data } = await db
  .from("delivery_zones")
  .select("slug, name, fee_tzs, free_delivery, active")
  .order("sort_priority");

console.log("\nDevelopment delivery zones (placeholders, awaiting Ibrahim's real list):\n");
for (const zone of data ?? []) {
  console.log(`  ${zone.slug.padEnd(12)} ${zone.name.padEnd(12)} ${zone.free_delivery ? "free" : `TSh ${zone.fee_tzs}`}`);
}
console.log("");
