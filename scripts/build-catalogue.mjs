/**
 * Builds the committed Jojo Usafi catalogue from the restored source inputs.
 *
 *   imports/jojo-usafi-product-master.csv   Product Master — the source of truth
 *   imports/white-bg-products/              approved white-background photography
 *
 * Produces, deterministically (no timestamps, stable ordering):
 *
 *   public/products/<SKU>.webp                     one approved photo per matched SKU
 *   src/lib/catalogue/generated/catalogue.json     brands, categories, suppliers, all 201 products
 *   src/lib/catalogue/generated/report.json        machine-readable validation report
 *   docs/CATALOGUE_REPORT.md                       human-readable validation report
 *
 * RULES (see docs/DECISIONS.md):
 *   - SKU is the only identity key. Images match on the exact leading SKU token.
 *   - Never fuzzy-match on product name. Never reuse another SKU's photograph.
 *   - Nothing is invented: no prices, stock, descriptions, categories or identity.
 *   - All 201 master rows are preserved; only `publishable` rows reach the storefront.
 *
 *   node scripts/build-catalogue.mjs [--check]
 *
 * `--check` verifies the committed output still matches the sources, writing nothing.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "imports", "jojo-usafi-product-master.csv");
const IMG_DIR = path.join(ROOT, "imports", "white-bg-products");
const ASSET_DIR = path.join(ROOT, "public", "products");
const GEN_DIR = path.join(ROOT, "src", "lib", "catalogue", "generated");
const DOC = path.join(ROOT, "docs", "CATALOGUE_REPORT.md");

const CHECK_ONLY = process.argv.includes("--check");

/** Below this, a TZS retail price cannot be genuine. Flags — never corrects. */
const IMPLAUSIBLE_PRICE_TZS = 1000;
const IMAGE_EDGE = 800;
const WEBP_QUALITY = 80;

/* ------------------------------------------------------------------ CSV --- */

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* CRLF */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/* ------------------------------------------------------- presentation ---- */

const TONES = ["green", "lime", "aqua", "sky", "berry", "amber", "violet", "slate"];

/** Stable per-brand colour. Presentation only — never product data. */
function toneFor(seed) {
  const digest = createHash("sha1").update(seed).digest();
  return TONES[digest[0] % TONES.length];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Container silhouette for a pack size, used only where no photo exists. */
function packTypeFor(size) {
  if (/^\d+\s*(G|KG)$/i.test(size)) return "tub";
  if (/^20\s*LT$/i.test(size)) return "drum";
  if (/^(5|10)\s*LT$/i.test(size)) return "jerrycan";
  return "bottle";
}

/** Comparable magnitude so pack sizes sort smallest-first rather than by price. */
function sizeRank(size) {
  const m = /^([\d.]+)\s*(ML|LT|G|KG)$/i.exec(size);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "LT" || unit === "KG") return n * 1000;
  return n;
}

/**
 * Presentation for the five categories the master currently uses. Names come
 * from the master; only the icon and the shelf blurb are ours. An unknown
 * category still works — it just gets the neutral tile.
 */
const CATEGORY_PRESENTATION = {
  "Personal Care": {
    tone: "aqua",
    blurb: "Shower gels, handwash and everyday body care.",
    icon: "M12 3c2.6 2.8 4.5 5.4 4.5 8a4.5 4.5 0 1 1-9 0c0-2.6 1.9-5.2 4.5-8Z",
  },
  Housekeeping: {
    tone: "lime",
    blurb: "Multipurpose detergents and dishwashing.",
    icon: "M5 21h14M7 21V9l5-6 5 6v12M10 13h4",
  },
  "Washroom & Surface Care": {
    tone: "sky",
    blurb: "Toilet cleaners, scouring powders and surface care.",
    icon: "M6 4h12v5a6 6 0 0 1-12 0V4ZM9 20h6M12 15v5",
  },
  "Laundry Care": {
    tone: "green",
    blurb: "Liquid detergents for machine and hand wash.",
    icon: "M4 4h16v16H4zM12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  },
  "Vehicle Care": {
    tone: "slate",
    blurb: "Shampoos and finishes for cars and bikes.",
    icon: "M4 16h16M6 16l1.6-5.2A2 2 0 0 1 9.5 9.4h5a2 2 0 0 1 1.9 1.4L18 16M7.5 19h1M15.5 19h1",
  },
};

const FALLBACK_CATEGORY = {
  tone: "slate",
  blurb: "",
  icon: "M21 8 12 3 3 8v8l9 5 9-5z",
};

/* ------------------------------------------------------------- sources --- */

const records = parseCsv(fs.readFileSync(CSV, "utf8"));

const imageFiles = fs
  .readdirSync(IMG_DIR)
  .filter((f) => /\.png$/i.test(f))
  .sort();

/** Exact identity match only: the leading SKU token of the filename. */
const SKU_TOKEN = /^([A-Za-z0-9]+-[A-Za-z0-9]+)\s*-\s*/;

const imagesBySku = new Map();
const unparsableImages = [];
const duplicateImages = [];

for (const file of imageFiles) {
  const match = SKU_TOKEN.exec(file);
  if (!match) {
    unparsableImages.push(file);
    continue;
  }
  const sku = match[1].toUpperCase();
  if (imagesBySku.has(sku)) {
    duplicateImages.push({ sku, file, kept: imagesBySku.get(sku) });
    continue;
  }
  imagesBySku.set(sku, file);
}

const masterSkus = new Set(records.map((r) => r.SKU));
const orphanImages = [...imagesBySku.entries()]
  .filter(([sku]) => !masterSkus.has(sku))
  .map(([sku, file]) => ({ sku, file }));

/* ------------------------------------------------------------- derive ---- */

const brandNames = [...new Set(records.map((r) => r["PRODUCT BRAND"]).filter(Boolean))].sort();
const categoryNames = [...new Set(records.map((r) => r.CATEGORY).filter(Boolean))].sort();
const supplierNames = [...new Set(records.map((r) => r.SUPPLIER).filter(Boolean))].sort();

/** A brand's tagline is its busiest category — derived from the master, not invented. */
function primaryCategoryOf(brandName) {
  const counts = new Map();
  for (const r of records) {
    if (r["PRODUCT BRAND"] !== brandName) continue;
    counts.set(r.CATEGORY, (counts.get(r.CATEGORY) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

const suppliers = supplierNames.map((name) => ({
  id: `sup_${slugify(name)}`,
  name,
  country: "Tanzania",
}));

const brands = brandNames.map((name) => ({
  id: `brd_${slugify(name)}`,
  slug: slugify(name),
  name,
  tagline: primaryCategoryOf(name),
  mark: name.trim().charAt(0).toUpperCase(),
  tone: toneFor(`brand:${slugify(name)}`),
}));

const categories = categoryNames.map((name) => {
  const presentation = CATEGORY_PRESENTATION[name] ?? FALLBACK_CATEGORY;
  return {
    id: `cat_${slugify(name)}`,
    slug: slugify(name),
    name,
    blurb: presentation.blurb,
    icon: presentation.icon,
    tone: presentation.tone,
  };
});

const brandByName = new Map(brands.map((b) => [b.name, b]));
const categoryByName = new Map(categories.map((c) => [c.name, c]));
const supplierByName = new Map(suppliers.map((s) => [s.name, s]));

/* ------------------------------------------------------------ products --- */

function truthy(value) {
  return String(value).trim().toLowerCase() === "true";
}

const products = records.map((row) => {
  const price = Number(row["PRICE TZS"]);
  const stock = Number(row["STOCK QTY"]);
  const brand = brandByName.get(row["PRODUCT BRAND"]);
  const category = categoryByName.get(row.CATEGORY);
  const supplier = supplierByName.get(row.SUPPLIER);
  const imageFile = imagesBySku.get(row.SKU);

  const flags = [];
  if (!imageFile) flags.push("MISSING_APPROVED_IMAGE");
  if (!Number.isFinite(price) || price <= 0) flags.push("PRICE_MISSING");
  else if (price < IMPLAUSIBLE_PRICE_TZS) flags.push("PRICE_IMPLAUSIBLE");
  if (!brand) flags.push("BRAND_UNRESOLVED");
  if (!category) flags.push("CATEGORY_UNRESOLVED");
  if (row["WEBSITE STATUS"] !== "Show") flags.push("WEBSITE_STATUS_NOT_SHOW");
  if (row["PRODUCT STATUS"] !== "Active") flags.push("PRODUCT_STATUS_NOT_ACTIVE");

  const badges = [];
  if (truthy(row["BEST SELLER"])) badges.push({ label: "Best Seller", kind: "bestseller" });
  if (truthy(row["NEW ARRIVAL"])) badges.push({ label: "New", kind: "new" });

  return {
    id: `prd_${row.SKU.toLowerCase()}`,
    sku: row.SKU,
    slug: row["SEO SLUG"],
    brandId: brand?.id ?? "",
    supplierId: supplier?.id ?? "",
    categoryId: category?.id ?? "",
    familyId: row["FAMILY CODE"],
    // The master carries one descriptive name per row and no separate
    // family/variant split, so `variant` stays empty rather than invented.
    family: row["PRODUCT VARIANT"],
    variant: "",
    packSize: row.SIZE,
    packType: packTypeFor(row.SIZE),
    sizeRank: sizeRank(row.SIZE),
    price: Number.isFinite(price) ? price : 0,
    // 200 of 201 master rows carry no description. Blank stays blank.
    description: row.DESCRIPTION,
    badges,
    inStock: Number.isFinite(stock) && stock > 0,
    bestSeller: truthy(row["BEST SELLER"]),
    featured: truthy(row.FEATURED),
    tone: brand ? brand.tone : "slate",
    image: null,
    flags,
    publishable: false,
  };
});

/** Warning only: a bigger pack listed below a smaller one in the same family. */
const byFamily = new Map();
for (const p of products) {
  if (!byFamily.has(p.familyId)) byFamily.set(p.familyId, []);
  byFamily.get(p.familyId).push(p);
}
const priceInversions = [];
for (const [familyId, list] of byFamily) {
  const sorted = [...list].sort((a, b) => a.sizeRank - b.sizeRank);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price > 0 && sorted[i].price < sorted[i - 1].price) {
      priceInversions.push({
        familyId,
        smaller: {
          sku: sorted[i - 1].sku,
          packSize: sorted[i - 1].packSize,
          price: sorted[i - 1].price,
        },
        larger: { sku: sorted[i].sku, packSize: sorted[i].packSize, price: sorted[i].price },
      });
      sorted[i].flags.push("PRICE_INVERSION");
    }
  }
}

/** A flag that must keep a product off the public storefront. */
const BLOCKING = new Set([
  "MISSING_APPROVED_IMAGE",
  "PRICE_MISSING",
  "PRICE_IMPLAUSIBLE",
  "BRAND_UNRESOLVED",
  "CATEGORY_UNRESOLVED",
  "WEBSITE_STATUS_NOT_SHOW",
  "PRODUCT_STATUS_NOT_ACTIVE",
]);

for (const p of products) {
  p.publishable = !p.flags.some((f) => BLOCKING.has(f));
}

products.sort((a, b) => a.sku.localeCompare(b.sku));

/* -------------------------------------------------------------- assets --- */

async function writeAssets() {
  const written = [];
  for (const product of products) {
    const file = imagesBySku.get(product.sku);
    // Only products that actually reach the storefront get a committed asset.
    if (!file || !product.publishable) continue;

    const buffer = await sharp(path.join(IMG_DIR, file))
      .resize({ width: IMAGE_EDGE, height: IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer();

    const meta = await sharp(buffer).metadata();
    if (!CHECK_ONLY) fs.writeFileSync(path.join(ASSET_DIR, `${product.sku}.webp`), buffer);

    product.image = {
      src: `/products/${product.sku}.webp`,
      width: meta.width,
      height: meta.height,
      /** The approved source file this photo came from — the audit trail. */
      source: file,
    };
    written.push(product.sku);
  }
  return written;
}

/* -------------------------------------------------------------- output --- */

function stable(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function renderReport(report) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push("# Catalogue Validation Report");
  push();
  push("Generated by `npm run catalogue:build` from the restored import sources.");
  push("**Do not edit by hand.** `imports/` is source-only and excluded from Git.");
  push();
  push("## Sources");
  push();
  push("| Input | Count |");
  push("| --- | --- |");
  push(`| Product Master rows | ${report.source.masterRows} |`);
  push(`| Approved white-background images | ${report.source.approvedImageFiles} |`);
  push(`| Distinct brands | ${report.source.distinctBrands} |`);
  push(`| Distinct categories | ${report.source.distinctCategories} |`);
  push(`| Distinct product families | ${report.source.distinctFamilies} |`);
  push();
  push("## SKU matching");
  push();
  push(`Strategy: **${report.matching.strategy}**.`);
  push();
  push("| Result | Count |");
  push("| --- | --- |");
  push(`| Images matched to a master row | ${report.matching.imagesMatchedToMaster} |`);
  push(`| Images with no master row | ${report.matching.imagesWithoutMasterRow.length} |`);
  push(`| Image filenames with no SKU token | ${report.matching.imageFilenamesWithoutSkuToken.length} |`);
  push(`| Duplicate image SKUs | ${report.matching.duplicateImageSkus.length} |`);
  push(`| Master rows with no approved image | ${report.matching.masterRowsWithoutApprovedImage} |`);
  push();

  if (report.matching.imagesWithoutMasterRow.length) {
    push("### Approved images with no master row");
    push();
    push("Reported, never invented as products. The master needs a row before these can sell.");
    push();
    push("| SKU | File |");
    push("| --- | --- |");
    for (const o of report.matching.imagesWithoutMasterRow) push(`| \`${o.sku}\` | ${o.file} |`);
    push();
  }

  push("## Storefront exposure");
  push();
  push("| Outcome | Count |");
  push("| --- | --- |");
  push(`| Publishable (visible to customers) | ${report.storefront.publishable} |`);
  push(`| Hidden — no approved image | ${report.storefront.hiddenMissingImage} |`);
  push(`| Hidden — other blocking flag | ${report.storefront.hiddenOtherReason} |`);
  push(`| Committed image assets | ${report.storefront.assetsWritten} |`);
  push();
  push("All 201 master rows are preserved in `src/lib/catalogue/generated/catalogue.json`.");
  push("Only rows with `publishable: true` are exposed by `src/lib/catalogue/queries.ts`.");
  push();

  if (report.flagged.length) {
    push("## Flagged rows");
    push();
    push("**Nothing below has been corrected.** Flagged commercial data is Ibrahim's to confirm.");
    push();
    push("| SKU | Product | Price TZS | Flags | Published |");
    push("| --- | --- | --- | --- | --- |");
    for (const f of report.flagged) {
      push(
        `| \`${f.sku}\` | ${f.name} | ${f.price} | ${f.flags.join(", ")} | ${f.publishable ? "yes" : "**no**"} |`,
      );
    }
    push();
  }

  if (report.priceInversions.length) {
    push("## Price inversions");
    push();
    push("A larger pack listed below a smaller pack in the same family. Warning only.");
    push();
    push("| Family | Smaller pack | Larger pack |");
    push("| --- | --- | --- |");
    for (const i of report.priceInversions) {
      push(
        `| \`${i.familyId}\` | ${i.smaller.sku} ${i.smaller.packSize} — ${i.smaller.price} | ` +
          `${i.larger.sku} ${i.larger.packSize} — ${i.larger.price} |`,
      );
    }
    push();
  }

  push("## Rules applied");
  push();
  push(
    `- A price below **TZS ${report.rules.implausiblePriceBelowTzs}** is flagged \`PRICE_IMPLAUSIBLE\` and withheld.`,
  );
  push("- Images are matched on the exact SKU token only. No fuzzy name matching, ever.");
  push("- No product is given another SKU's photograph.");
  push("- Blank descriptions stay blank. 200 of 201 master rows carry none.");
  push(`- Blocking flags: ${report.rules.blockingFlags.map((f) => `\`${f}\``).join(", ")}.`);
  push();
  return lines.join("\n");
}

async function run() {
  if (!CHECK_ONLY) {
    fs.mkdirSync(ASSET_DIR, { recursive: true });
    fs.mkdirSync(GEN_DIR, { recursive: true });
  }

  const writtenAssets = await writeAssets();

  const publishable = products.filter((p) => p.publishable);
  const hiddenMissingImage = products.filter((p) => p.flags.includes("MISSING_APPROVED_IMAGE"));
  const flagged = products.filter((p) => p.flags.some((f) => f !== "MISSING_APPROVED_IMAGE"));

  const catalogue = { suppliers, brands, categories, products };

  const report = {
    source: {
      masterRows: records.length,
      approvedImageFiles: imageFiles.length,
      distinctBrands: brands.length,
      distinctCategories: categories.length,
      distinctFamilies: byFamily.size,
    },
    matching: {
      strategy: "exact leading SKU token; no fuzzy name matching",
      imagesMatchedToMaster: [...imagesBySku.keys()].filter((s) => masterSkus.has(s)).length,
      imagesWithoutMasterRow: orphanImages,
      imageFilenamesWithoutSkuToken: unparsableImages,
      duplicateImageSkus: duplicateImages,
      masterRowsWithoutApprovedImage: hiddenMissingImage.length,
    },
    storefront: {
      publishable: publishable.length,
      hiddenMissingImage: hiddenMissingImage.length,
      hiddenOtherReason: products.filter(
        (p) => !p.publishable && !p.flags.includes("MISSING_APPROVED_IMAGE"),
      ).length,
      assetsWritten: writtenAssets.length,
    },
    flagged: flagged.map((p) => ({
      sku: p.sku,
      name: `${p.family} ${p.packSize}`.trim(),
      price: p.price,
      flags: p.flags,
      publishable: p.publishable,
    })),
    priceInversions,
    rules: {
      implausiblePriceBelowTzs: IMPLAUSIBLE_PRICE_TZS,
      blockingFlags: [...BLOCKING].sort(),
      note: "Flagged values are never corrected here. Only Ibrahim can confirm commercial data.",
    },
  };

  const doc = renderReport(report);

  if (CHECK_ONLY) {
    const problems = [];
    const compare = (file, expected) => {
      if (!fs.existsSync(file)) return problems.push(`missing: ${path.relative(ROOT, file)}`);
      if (fs.readFileSync(file, "utf8") !== expected) {
        problems.push(`stale: ${path.relative(ROOT, file)}`);
      }
    };
    compare(path.join(GEN_DIR, "catalogue.json"), stable(catalogue));
    compare(path.join(GEN_DIR, "report.json"), stable(report));
    compare(DOC, doc);
    for (const sku of writtenAssets) {
      if (!fs.existsSync(path.join(ASSET_DIR, `${sku}.webp`))) {
        problems.push(`missing asset: products/${sku}.webp`);
      }
    }
    if (problems.length) {
      console.error("Catalogue output is out of date. Run `npm run catalogue:build`.");
      for (const p of problems) console.error(`  ${p}`);
      process.exitCode = 1;
    } else {
      console.log(`Catalogue output matches the import sources (${publishable.length} publishable).`);
    }
    return;
  }

  fs.writeFileSync(path.join(GEN_DIR, "catalogue.json"), stable(catalogue));
  fs.writeFileSync(path.join(GEN_DIR, "report.json"), stable(report));
  fs.writeFileSync(DOC, doc);

  console.log(`master rows          ${records.length}`);
  console.log(`approved images      ${imageFiles.length}`);
  console.log(`matched exactly      ${report.matching.imagesMatchedToMaster}`);
  console.log(
    `orphan images        ${orphanImages.length}  ${orphanImages.map((o) => o.sku).join(", ")}`,
  );
  console.log(`publishable          ${publishable.length}`);
  console.log(`hidden (no image)    ${hiddenMissingImage.length}`);
  console.log(`hidden (other)       ${report.storefront.hiddenOtherReason}`);
  console.log(`assets written       ${writtenAssets.length}`);
}

run();
