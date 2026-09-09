#!/usr/bin/env node
/**
 * Import the real Jojo Usafi catalogue into Supabase.
 *
 *   node scripts/import-catalogue.mjs --dry-run     plan only, writes nothing
 *   node scripts/import-catalogue.mjs               apply the plan
 *   node scripts/import-catalogue.mjs --skip-images apply, but upload nothing
 *
 * WHAT IT READS
 *
 * `src/lib/catalogue/generated/catalogue.json`, which `build-catalogue.mjs`
 * produces deterministically from `imports/jojo-usafi-product-master.csv` and
 * the approved photography. This script re-runs that build in `--check` mode
 * first and refuses to continue if the committed artifact has drifted from the
 * sources, so "the CSV" and "the artifact" cannot disagree.
 *
 * Parsing the CSV a second time here was the obvious alternative and is the
 * wrong one: SKU-to-photograph matching would then exist in two places, and the
 * one rule this catalogue cannot afford to get wrong is which photograph
 * belongs to which SKU.
 *
 * WHAT IT WILL NOT DO
 *
 * It never deletes a product, a brand, a category or a family. A row that
 * disappears from the master is a row somebody stopped exporting, not a product
 * that stopped existing — and `products` is referenced by `order_items`. Rows
 * only ever arrive or change.
 *
 * It never invents. A SKU with no approved photograph is imported and left
 * invisible; an approved photograph with no master row is reported and no
 * product is created for it; an implausible price blocks its product and is
 * copied across unchanged rather than corrected.
 *
 * IDEMPOTENT. Every write is an upsert on a natural key, and rows that already
 * match are left alone — so a second run reports "unchanged" and touches
 * nothing, including Storage.
 */

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CATALOGUE = join(ROOT, "src", "lib", "catalogue", "generated", "catalogue.json");
const REPORT_JSON = join(ROOT, "src", "lib", "catalogue", "generated", "import-report.json");
const REPORT_MD = join(ROOT, "docs", "CATALOGUE_IMPORT_REPORT.md");
const ASSET_DIR = join(ROOT, "public", "products");

/** The Jojo Usafi development project. Free tier, ap-south-1, no billing. */
const PROJECT_REF = "dyjhacbbedytcstxxjzl";

/** Build 06 created this bucket with its policies. Reusing it beats a second one. */
const BUCKET = "product-media";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_IMAGES = process.argv.includes("--skip-images");

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/* --------------------------------------------------------------- 0. safety */

try {
  process.loadEnvFile(".env.local");
} catch {
  /* already loaded, or absent */
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !SERVICE_KEY) {
  fail("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
}
if (!URL_.includes(PROJECT_REF)) {
  fail(
    `Refusing to import into ${URL_}.\n` +
      `  This importer only ever writes to the development project ${PROJECT_REF}.`,
  );
}

// The artifact must still match the sources it claims to come from.
const check = spawnSync("node scripts/build-catalogue.mjs --check", {
  cwd: ROOT,
  encoding: "utf8",
  shell: true,
});
if (check.status !== 0) {
  fail(
    "The committed catalogue no longer matches imports/.\n\n" +
      "  Run `npm run catalogue:build`, review the change, then import.\n\n" +
      (check.stdout || check.stderr || ""),
  );
}

const db = createClient(URL_, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ------------------------------------------------------------- 1. the plan */

const catalogue = JSON.parse(readFileSync(CATALOGUE, "utf8"));
const RUN_ID = randomUUID();
const STARTED_AT = new Date().toISOString();

const warnings = [];
const errors = [];

const upper = (value) =>
  String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

/** Blocking flags, copied from the catalogue builder so both agree on "public". */
const BLOCKING = new Set([
  "MISSING_APPROVED_IMAGE",
  "PRICE_MISSING",
  "PRICE_IMPLAUSIBLE",
  "BRAND_UNRESOLVED",
  "CATEGORY_UNRESOLVED",
  "WEBSITE_STATUS_NOT_SHOW",
  "PRODUCT_STATUS_NOT_ACTIVE",
]);

/* ---- suppliers, brands, categories ---- */

const suppliers = catalogue.suppliers.map((s) => ({
  code: upper(s.name),
  name: s.name,
  country: s.country || null,
  active: true,
}));

const brands = catalogue.brands.map((b) => ({
  code: upper(b.name),
  slug: b.slug,
  name: b.name,
  tagline: b.tagline || null,
  mark: b.mark || null,
  tone: b.tone || null,
  active: true,
}));

const categories = catalogue.categories.map((c) => ({
  code: upper(c.name),
  slug: c.slug,
  name: c.name,
  blurb: c.blurb || null,
  icon_path: c.icon || null,
  tone: c.tone || null,
  active: true,
}));

/* ---- families ---- */

const familyGroups = new Map();
for (const product of catalogue.products) {
  if (!familyGroups.has(product.familyId)) familyGroups.set(product.familyId, []);
  familyGroups.get(product.familyId).push(product);
}

const brandBySourceId = new Map(catalogue.brands.map((b) => [b.id, b]));
const categoryBySourceId = new Map(catalogue.categories.map((c) => [c.id, c]));
const supplierBySourceId = new Map(catalogue.suppliers.map((s) => [s.id, s]));

const families = [];
for (const [code, members] of familyGroups) {
  const first = members[0];
  const brand = brandBySourceId.get(first.brandId);
  const category = categoryBySourceId.get(first.categoryId);

  if (!brand || !category) {
    errors.push(`family ${code}: brand or category could not be resolved`);
    continue;
  }

  // Every SKU in a FAMILY CODE should carry the same descriptive name. Where
  // they do not, the most common one wins and the disagreement is reported
  // rather than silently picked.
  const names = new Map();
  for (const member of members) names.set(member.family, (names.get(member.family) ?? 0) + 1);
  const [name] = [...names.entries()].sort((a, b) => b[1] - a[1])[0];
  if (names.size > 1) {
    warnings.push(`family ${code} has ${names.size} different names; using "${name}"`);
  }

  families.push({
    code,
    slug: `${brand.slug}-${code.toLowerCase()}`,
    brand_code: upper(brand.name),
    category_code: upper(category.name),
    supplier_code: suppliers[0]?.code ?? null,
    name,
    lifecycle: "active",
  });
}

/* ---- products ---- */

const products = [];
for (const p of catalogue.products) {
  const brand = brandBySourceId.get(p.brandId);
  const category = categoryBySourceId.get(p.categoryId);
  const supplier = supplierBySourceId.get(p.supplierId);

  if (!brand || !category) {
    errors.push(`${p.sku}: brand or category could not be resolved — not imported`);
    continue;
  }
  if (!/^[A-Z0-9][A-Z0-9._-]{1,47}$/.test(p.sku)) {
    errors.push(`${p.sku}: SKU does not match the schema pattern — not imported`);
    continue;
  }
  if (!Number.isInteger(p.price) || p.price < 0) {
    errors.push(`${p.sku}: price ${p.price} is not a whole number of shillings — not imported`);
    continue;
  }

  const blocked = p.flags.filter((f) => BLOCKING.has(f));

  products.push({
    sku: p.sku,
    slug: p.slug,
    family_code: p.familyId,
    brand_code: upper(brand.name),
    category_code: upper(category.name),
    supplier_code: supplier ? upper(supplier.name) : null,
    ean: p.ean,
    itf14: p.itf14,
    display_name: p.family,
    variant_label: p.variant || null,
    pack_size_label: p.packSize || null,
    pack_type: p.packType || null,
    size_rank: p.sizeRank > 0 ? p.sizeRank : null,
    price_tzs: p.price,
    offer_price_tzs: p.offerPrice,
    lifecycle: "active",
    // The one rule that must never be relaxed by a re-import: a product that is
    // blocked for any reason is not visible, whatever the master says.
    storefront_visible: blocked.length === 0,
    low_stock_threshold: p.lowStockThreshold,
    best_seller: Boolean(p.bestSeller),
    featured: Boolean(p.featured),
    _blocked: blocked,
    _image: p.image,
    _stock: p.stockQty,
  });
}

const duplicateSkus = products
  .map((p) => p.sku)
  .filter((sku, index, all) => all.indexOf(sku) !== index);
if (duplicateSkus.length > 0) {
  fail(`Duplicate SKUs in the source: ${[...new Set(duplicateSkus)].join(", ")}`);
}

const publishable = products.filter((p) => p._blocked.length === 0);
const withImage = products.filter((p) => p._image);
const orphanImages = catalogue.products.length
  ? JSON.parse(readFileSync(join(ROOT, "src", "lib", "catalogue", "generated", "report.json"), "utf8"))
      .matching.imagesWithoutMasterRow
  : [];

/* ---- option axes: only where the data actually varies ---- */

const sizeValues = new Map();
const familyAxisFamilies = [];
for (const [code, members] of familyGroups) {
  const sizes = new Set(members.map((m) => m.packSize).filter(Boolean));
  if (sizes.size > 1) familyAxisFamilies.push(code);
  for (const member of members) {
    if (!member.packSize) continue;
    const valueCode = member.packSize.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (valueCode) {
      sizeValues.set(valueCode, { code: valueCode, label: member.packSize, numeric_rank: member.sizeRank || null });
    }
  }
}

/* -------------------------------------------------------- 2. print the plan */

console.log("\nJojo Usafi — catalogue import\n");
console.log(`  project        ${PROJECT_REF}`);
console.log(`  source         imports/jojo-usafi-product-master.csv (via the built artifact)`);
console.log(`  run            ${RUN_ID}`);
console.log(`  mode           ${DRY_RUN ? "DRY RUN — nothing will be written" : "APPLY"}\n`);
console.log(`  master rows    ${catalogue.products.length}`);
console.log(`  importable     ${products.length}`);
console.log(`  publishable    ${publishable.length}`);
console.log(`  blocked        ${products.length - publishable.length}`);
console.log(`  with image     ${withImage.length}`);
console.log(`  orphan images  ${orphanImages.length}${orphanImages.length ? ` (${orphanImages.map((o) => o.sku).join(", ")}) — not imported` : ""}`);
console.log(`  suppliers      ${suppliers.length}`);
console.log(`  brands         ${brands.length}`);
console.log(`  categories     ${categories.length}`);
console.log(`  families       ${families.length}  (${familyAxisFamilies.length} vary by size)`);
console.log(`  size values    ${sizeValues.size}`);
if (warnings.length) console.log(`  warnings       ${warnings.length}`);
if (errors.length) console.log(`  errors         ${errors.length}`);
console.log("");

for (const error of errors) console.log(`  ERROR   ${error}`);
for (const warning of warnings.slice(0, 10)) console.log(`  warn    ${warning}`);
if (errors.length) fail("Refusing to import while any row is in error.");

/* ------------------------------------------------------------- 3. the write */

const stats = {
  suppliers: {}, brands: {}, categories: {}, families: {}, products: {},
  media: {}, inventory: {}, movements: {}, images: {},
};

/**
 * Insert what is missing, update what differs, leave what already matches.
 * Returning the three counts is what makes a second run provably a no-op.
 */
async function sync(table, rows, key, label) {
  const keys = rows.map((r) => r[key]);
  const existingRows = [];
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await db.from(table).select("*").in(key, keys.slice(i, i + 200));
    if (error) fail(`reading ${table}: ${error.message}`);
    existingRows.push(...(data ?? []));
  }
  const existing = new Map(existingRows.map((r) => [r[key], r]));

  const toInsert = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const row of rows) {
    const current = existing.get(row[key]);
    if (!current) {
      toInsert.push(row);
      continue;
    }
    const differs = Object.keys(row).some(
      (column) => JSON.stringify(current[column] ?? null) !== JSON.stringify(row[column] ?? null),
    );
    if (differs) toUpdate.push({ ...current, ...row });
    else unchanged += 1;
  }

  stats[label] = { insert: toInsert.length, update: toUpdate.length, unchanged };

  if (DRY_RUN) return existing;

  for (const batch of [toInsert, toUpdate]) {
    for (let i = 0; i < batch.length; i += 200) {
      const slice = batch.slice(i, i + 200);
      if (slice.length === 0) continue;
      const { error } = await db.from(table).upsert(slice, { onConflict: key });
      if (error) fail(`writing ${table}: ${error.message}${error.details ? ` — ${error.details}` : ""}`);
    }
  }

  const { data: after, error: afterError } = await db.from(table).select("*").in(key, keys);
  if (afterError) fail(`re-reading ${table}: ${afterError.message}`);
  return new Map((after ?? []).map((r) => [r[key], r]));
}

const supplierRows = await sync("suppliers", suppliers, "code", "suppliers");
const brandRows = await sync("brands", brands, "code", "brands");
const categoryRows = await sync("categories", categories, "code", "categories");

const supplierIdByCode = new Map([...supplierRows].map(([code, row]) => [code, row.id]));
const brandIdByCode = new Map([...brandRows].map(([code, row]) => [code, row.id]));
const categoryIdByCode = new Map([...categoryRows].map(([code, row]) => [code, row.id]));

const familyRows = families.map((f) => ({
  code: f.code,
  slug: f.slug,
  brand_id: brandIdByCode.get(f.brand_code) ?? null,
  category_id: categoryIdByCode.get(f.category_code) ?? null,
  supplier_id: f.supplier_code ? (supplierIdByCode.get(f.supplier_code) ?? null) : null,
  name: f.name,
  lifecycle: f.lifecycle,
}));

const familyByCode = await sync("product_families", familyRows, "code", "families");
const familyIdByCode = new Map([...familyByCode].map(([code, row]) => [code, row.id]));

const productRows = products.map((p) => ({
  sku: p.sku,
  slug: p.slug,
  family_id: familyIdByCode.get(p.family_code) ?? null,
  brand_id: brandIdByCode.get(p.brand_code) ?? null,
  category_id: categoryIdByCode.get(p.category_code) ?? null,
  supplier_id: p.supplier_code ? (supplierIdByCode.get(p.supplier_code) ?? null) : null,
  ean: p.ean,
  itf14: p.itf14,
  display_name: p.display_name,
  variant_label: p.variant_label,
  pack_size_label: p.pack_size_label,
  pack_type: p.pack_type,
  size_rank: p.size_rank,
  price_tzs: p.price_tzs,
  offer_price_tzs: p.offer_price_tzs,
  lifecycle: p.lifecycle,
  storefront_visible: p.storefront_visible,
  low_stock_threshold: p.low_stock_threshold,
  best_seller: p.best_seller,
  featured: p.featured,
}));

const productBySku = await sync("products", productRows, "sku", "products");
const productIdBySku = new Map([...productBySku].map(([sku, row]) => [sku, row.id]));

await importVariants();
await importImages();
await importInventory();
// writeAudit() runs after `summary` is built, further down: it records that
// summary, so it cannot run before it exists.

/* -------------------------------------------------------------- 3b. variants
 *
 * The relational model is family → axes → SKU, and the axes a family declares
 * are the axes its data actually varies by. Nothing here assumes "size and
 * scent": it reads the distinct pack sizes within each FAMILY CODE and declares
 * the size axis only for the families that genuinely have more than one. A
 * family with a single SKU declares no axis, which the schema allows and which
 * is the truth about that product.
 *
 * Scent is deliberately NOT modelled. The Product Master carries one
 * descriptive name per row and no separate scent column, so a scent axis would
 * have to be guessed out of product names — which is the fuzzy identity
 * matching this catalogue refuses to do anywhere else.
 */
async function importVariants() {
  const { data: axis, error: axisError } = await db
    .from("product_option_axes")
    .select("id")
    .eq("code", "size")
    .single();
  if (axisError) fail(`reading the size axis: ${axisError.message}`);
  const axisId = axis.id;

  const valueRows = [...sizeValues.values()].map((v) => ({
    axis_id: axisId,
    code: v.code,
    label: v.label,
    numeric_rank: v.numeric_rank,
  }));

  const { data: existingValues, error: valuesError } = await db
    .from("product_option_values")
    .select("id, code")
    .eq("axis_id", axisId);
  if (valuesError) fail(`reading option values: ${valuesError.message}`);

  const known = new Set((existingValues ?? []).map((v) => v.code));
  stats.optionValues = {
    insert: valueRows.filter((v) => !known.has(v.code)).length,
    unchanged: valueRows.filter((v) => known.has(v.code)).length,
  };
  stats.familyAxes = { insert: familyAxisFamilies.length };
  stats.optionAssignments = { insert: products.filter((p) => p.pack_size_label).length };

  if (DRY_RUN) return;

  const { error: writeValues } = await db
    .from("product_option_values")
    .upsert(valueRows, { onConflict: "axis_id,code" });
  if (writeValues) fail(`writing option values: ${writeValues.message}`);

  const { data: valuesBack, error: backError } = await db
    .from("product_option_values")
    .select("id, code")
    .eq("axis_id", axisId);
  if (backError) fail(`re-reading option values: ${backError.message}`);
  const valueIdByCode = new Map((valuesBack ?? []).map((v) => [v.code, v.id]));

  const familyAxisRows = familyAxisFamilies
    .map((code) => familyIdByCode.get(code))
    .filter(Boolean)
    .map((familyId) => ({ family_id: familyId, axis_id: axisId, position: 0 }));

  if (familyAxisRows.length > 0) {
    const { error } = await db
      .from("product_family_axes")
      .upsert(familyAxisRows, { onConflict: "family_id,axis_id" });
    if (error) fail(`writing family axes: ${error.message}`);
  }

  const assignments = products
    .filter((p) => p.pack_size_label)
    .map((p) => ({
      product_id: productIdBySku.get(p.sku),
      axis_id: axisId,
      value_id: valueIdByCode.get(
        p.pack_size_label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      ),
    }))
    .filter((a) => a.product_id && a.value_id);

  for (let i = 0; i < assignments.length; i += 200) {
    const { error } = await db
      .from("product_option_assignments")
      .upsert(assignments.slice(i, i + 200), { onConflict: "product_id,axis_id" });
    if (error) fail(`writing option assignments: ${error.message}`);
  }
}

/* --------------------------------------------------------------- 4. images */

async function importImages() {
  const wanted = products.filter((p) => p._image);
  const uploaded = [];
  let reused = 0;

  const mediaRows = [];
  for (const product of wanted) {
    const file = join(ASSET_DIR, `${product.sku}.webp`);
    if (!existsSync(file)) {
      errors.push(`${product.sku}: ${file} is missing — run npm run catalogue:build`);
      continue;
    }
    const bytes = readFileSync(file);
    const checksum = createHash("sha256").update(bytes).digest("hex");

    mediaRows.push({
      storage_bucket: BUCKET,
      // Deterministic and SKU-first, matching the convention recorded on
      // media_assets.storage_path in migration 20260909130200.
      storage_path: `${product.sku}/${product.sku.toLowerCase()}-primary-1.webp`,
      mime_type: "image/webp",
      width: product._image.width,
      height: product._image.height,
      byte_size: bytes.length,
      checksum,
      source_filename: product._image.source,
      alt_text: `${product.display_name} ${product.pack_size_label ?? ""}`.trim(),
      _sku: product.sku,
      _bytes: bytes,
    });
  }

  if (errors.length) fail(`Image preparation failed:\n  ${errors.join("\n  ")}`);

  // Upload only what the bucket does not already hold with the same checksum.
  const existingMedia = new Map();
  for (let i = 0; i < mediaRows.length; i += 200) {
    const paths = mediaRows.slice(i, i + 200).map((m) => m.storage_path);
    const { data, error } = await db
      .from("media_assets")
      .select("storage_path, checksum")
      .eq("storage_bucket", BUCKET)
      .in("storage_path", paths);
    if (error) fail(`reading media_assets: ${error.message}`);
    for (const row of data ?? []) existingMedia.set(row.storage_path, row.checksum);
  }

  const needsUpload = mediaRows.filter((m) => existingMedia.get(m.storage_path) !== m.checksum);
  reused = mediaRows.length - needsUpload.length;
  stats.images = { total: mediaRows.length, upload: needsUpload.length, reused };

  if (!DRY_RUN && !SKIP_IMAGES) {
    for (const media of needsUpload) {
      const { error } = await db.storage
        .from(BUCKET)
        .upload(media.storage_path, media._bytes, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "31536000",
        });
      if (error) fail(`uploading ${media.storage_path}: ${error.message}`);
      uploaded.push(media.storage_path);
    }
  }

  const rows = mediaRows.map(({ _sku, _bytes, ...rest }) => {
    void _sku;
    void _bytes;
    return rest;
  });

  if (DRY_RUN) {
    stats.media = { insert: rows.filter((r) => !existingMedia.has(r.storage_path)).length, update: 0, unchanged: reused };
    return;
  }

  const { error } = await db
    .from("media_assets")
    .upsert(rows, { onConflict: "storage_bucket,storage_path" });
  if (error) fail(`writing media_assets: ${error.message}`);

  const { data: mediaBack, error: backError } = await db
    .from("media_assets")
    .select("id, storage_path")
    .eq("storage_bucket", BUCKET)
    .in("storage_path", rows.map((r) => r.storage_path));
  if (backError) fail(`re-reading media_assets: ${backError.message}`);

  const mediaIdByPath = new Map((mediaBack ?? []).map((r) => [r.storage_path, r.id]));

  const links = mediaRows.map((m) => ({
    product_id: productIdBySku.get(m._sku),
    media_id: mediaIdByPath.get(m.storage_path),
    role: "primary",
    sort_priority: 0,
  }));

  const { error: linkError } = await db
    .from("product_media")
    .upsert(links, { onConflict: "product_id,media_id,role" });
  if (linkError) fail(`writing product_media: ${linkError.message}`);

  stats.media = { insert: rows.length - reused, update: 0, unchanged: reused };
}

/* ------------------------------------------------------------ 5. inventory */

async function importInventory() {
  const rows = products.map((p) => ({
    product_id: productIdBySku.get(p.sku),
    location_code: "main",
    on_hand: p._stock,
    reserved: 0,
  }));

  const ids = rows.map((r) => r.product_id).filter(Boolean);
  const existing = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("inventory")
      .select("product_id, on_hand, reserved")
      .in("product_id", ids.slice(i, i + 200));
    if (error) fail(`reading inventory: ${error.message}`);
    for (const row of data ?? []) existing.set(row.product_id, row);
  }

  const fresh = rows.filter((r) => !existing.has(r.product_id));
  stats.inventory = { insert: fresh.length, update: 0, unchanged: existing.size };

  // Stock is initialised ONCE per product. A re-import must never reset a count
  // the shop has since corrected, sold from or received against — the ledger,
  // not the spreadsheet, is the authority after day one.
  const movements = fresh
    .filter((r) => r.on_hand > 0)
    .map((r) => ({
      product_id: r.product_id,
      location_code: "main",
      kind: "receipt",
      on_hand_delta: r.on_hand,
      reserved_delta: 0,
      on_hand_after: r.on_hand,
      reserved_after: 0,
      reference: `Initial catalogue import ${RUN_ID}`,
      actor_type: "system",
      actor_label: "catalogue importer",
    }));

  stats.movements = { insert: movements.length };

  if (DRY_RUN || fresh.length === 0) return;

  const { error } = await db.from("inventory").upsert(fresh, { onConflict: "product_id,location_code" });
  if (error) fail(`writing inventory: ${error.message}`);

  if (movements.length > 0) {
    const { error: movementError } = await db.from("inventory_movements").insert(movements);
    if (movementError) fail(`writing inventory_movements: ${movementError.message}`);
  }
}

/* ---------------------------------------------------------------- 6. audit */

const summary = {
  runId: RUN_ID,
  startedAt: STARTED_AT,
  finishedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  project: PROJECT_REF,
  source: "imports/jojo-usafi-product-master.csv",
  rowsRead: catalogue.products.length,
  counts: stats,
  publishable: publishable.length,
  blocked: products.length - publishable.length,
  blockedSkus: products
    .filter((p) => p._blocked.length > 0)
    .map((p) => ({ sku: p.sku, reasons: p._blocked })),
  imageMatches: withImage.length,
  missingImages: products.length - withImage.length,
  orphanImages,
  warnings,
  errors,
};

async function writeAudit() {
  if (DRY_RUN) return;
  const { error } = await db.from("audit_events").insert({
    action: "catalogue.imported",
    entity_table: "products",
    entity_key: `catalogue-import-${RUN_ID}`,
    actor_type: "system",
    actor_label: "catalogue importer",
    source: "system",
    after_data: {
      runId: RUN_ID,
      source: summary.source,
      rowsRead: summary.rowsRead,
      counts: stats,
      publishable: summary.publishable,
      blocked: summary.blocked,
      imageMatches: summary.imageMatches,
      missingImages: summary.missingImages,
      orphanImages: orphanImages.map((o) => o.sku),
      warnings: warnings.length,
      errors: errors.length,
    },
  });
  if (error) fail(`writing the import audit record: ${error.message}`);
}

await writeAudit();

/* --------------------------------------------------------------- 7. report */

const line = (label, value) => `| ${label} | ${value} |`;

const markdown = `# Catalogue import report

Generated by \`scripts/import-catalogue.mjs\`. **Do not edit by hand.**

| | |
| --- | --- |
${line("Run", summary.runId)}
${line("Finished", summary.finishedAt)}
${line("Mode", DRY_RUN ? "dry run — nothing written" : "applied")}
${line("Project", `\`${PROJECT_REF}\` (development, free tier)`)}
${line("Source", `\`${summary.source}\``)}

## Rows

| | insert | update | unchanged |
| --- | --- | --- | --- |
${["suppliers", "brands", "categories", "families", "products", "media", "inventory"]
  .map((k) => `| ${k} | ${stats[k]?.insert ?? 0} | ${stats[k]?.update ?? 0} | ${stats[k]?.unchanged ?? 0} |`)
  .join("\n")}

Initial stock movements written: **${stats.movements?.insert ?? 0}**.

## Catalogue

| | |
| --- | --- |
${line("Master rows read", summary.rowsRead)}
${line("Publishable (public)", summary.publishable)}
${line("Blocked (kept, not public)", summary.blocked)}
${line("Approved images matched", summary.imageMatches)}
${line("Products with no approved image", summary.missingImages)}
${line("Orphan approved images", orphanImages.length)}
${line("Images uploaded this run", stats.images?.upload ?? 0)}
${line("Images already current", stats.images?.reused ?? 0)}

## Blocked products

These are imported and kept, and are **not** visible to shoppers.

${summary.blockedSkus.length === 0 ? "_None._" : `| SKU | Why |\n| --- | --- |\n${summary.blockedSkus
  .slice(0, 200)
  .map((b) => `| \`${b.sku}\` | ${b.reasons.join(", ")} |`)
  .join("\n")}`}

## Orphan approved images

An approved photograph with no row in the Product Master. **No product is
created for it** — that would mean inventing a price, a category and an
identity.

${orphanImages.length === 0 ? "_None._" : orphanImages.map((o) => `- \`${o.sku}\` — ${o.file}`).join("\n")}

## Warnings

${warnings.length === 0 ? "_None._" : warnings.map((w) => `- ${w}`).join("\n")}
`;

if (!DRY_RUN) {
  writeFileSync(REPORT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, markdown, "utf8");
}

console.log("  results");
for (const [key, value] of Object.entries(stats)) {
  if (!value || Object.keys(value).length === 0) continue;
  console.log(`    ${key.padEnd(12)} ${JSON.stringify(value)}`);
}
console.log("");
console.log(DRY_RUN ? "  DRY RUN — nothing was written.\n" : `  Imported. Report: docs/CATALOGUE_IMPORT_REPORT.md\n`);
