/**
 * The field authority matrix: who owns each column of the Product Master.
 *
 * This file is the whole safety argument of the Google Sheet sync, written down
 * once and read by everything else. Every one of the 39 real Product Master
 * columns appears below with an explicit authority. There is no default and no
 * fall-through: a column this file does not name is reported as unknown rather
 * than guessed at, because a column nobody classified is a column nobody
 * decided the safety of.
 *
 * THE FOUR AUTHORITIES
 *
 *   "both"      Catalogue control. Either side may change it, and a change on
 *               one side reaches the other. If BOTH sides changed the same one
 *               since they last agreed, that is a conflict and a person decides.
 *
 *   "database"  Operational truth. The Sheet may hold a stale copy and a person
 *               may type anything they like into it; it is never read as an
 *               instruction. Stock is the important member of this group — see
 *               `docs/GOOGLE_SHEET_SYNC.md` and the test that proves 10 → 1000
 *               in the Sheet creates no units.
 *
 *   "sheet"     Reference and internal metadata the Sheet owns. It flows into
 *               the database where a column exists for it, and the database
 *               never writes it back.
 *
 *   "report"    Written by the database INTO the Sheet and never read back.
 *               These are the system columns appended to the right of the
 *               operator's own layout.
 *
 *   "ignore"    Present in the master, mapped to nothing, deliberately. Named
 *               here so that "unknown column" keeps meaning "nobody has looked
 *               at this yet".
 *
 * NOTHING IN THIS FILE TALKS TO GOOGLE. It is pure data and pure functions, so
 * the matrix can be tested without a spreadsheet, a credential or a network.
 */

export type FieldAuthority = "both" | "database" | "sheet" | "report" | "ignore";

export interface ColumnRule {
  /** The exact header text in the Product Master. Matched case-insensitively. */
  readonly header: string;
  /** The catalogue field this maps to, or null when it maps to nothing. */
  readonly field: string | null;
  readonly authority: FieldAuthority;
  /** Why it is classified this way, in one sentence. Rendered into the docs. */
  readonly note: string;
}

/**
 * The canonical catalogue record a Sheet row becomes, and the same shape the
 * database side is reduced to before the two are compared. Only `both` fields
 * appear here: the comparison is over exactly the fields either side may own.
 */
export interface CatalogueFields {
  displayName: string;
  variantLabel: string | null;
  packSizeLabel: string | null;
  categoryName: string;
  brandName: string;
  ean: string | null;
  itf14: string | null;
  priceTzs: number;
  offerPriceTzs: number | null;
  storefrontVisible: boolean;
  featured: boolean;
  bestSeller: boolean;
  lifecycle: "draft" | "active" | "hidden" | "archived";
  lowStockThreshold: number;
  sortPriority: number;
  slug: string;
  description: string | null;
}

/** The bidirectional fields, in the order a person would read them. */
export const BIDIRECTIONAL_FIELDS: readonly (keyof CatalogueFields)[] = [
  "displayName",
  "variantLabel",
  "packSizeLabel",
  "categoryName",
  "brandName",
  "ean",
  "itf14",
  "priceTzs",
  "offerPriceTzs",
  "storefrontVisible",
  "featured",
  "bestSeller",
  "lifecycle",
  "lowStockThreshold",
  "sortPriority",
  "slug",
  "description",
] as const;

/** Plain-language names, for the conflict screen and the audit report. */
export const FIELD_LABELS: Record<keyof CatalogueFields, string> = {
  displayName: "Product name",
  variantLabel: "Variant",
  packSizeLabel: "Size",
  categoryName: "Category",
  brandName: "Brand",
  ean: "Barcode (EAN)",
  itf14: "Carton barcode (ITF-14)",
  priceTzs: "Price",
  offerPriceTzs: "Offer price",
  storefrontVisible: "Show on website",
  featured: "Featured",
  bestSeller: "Best seller",
  lifecycle: "Status",
  lowStockThreshold: "Low stock warning at",
  sortPriority: "Display order",
  slug: "Web address",
  description: "Description",
};

/* ------------------------------------------------------------ the matrix */

/**
 * All 39 columns of the real Product Master, in the order they appear in it.
 *
 * Read against `imports/jojo-usafi-product-master.csv`. The order below is the
 * order in the file, and `assertHeadersKnown()` refuses a sheet whose headers
 * this list does not recognise — so a column added, renamed or removed by hand
 * stops the sync rather than being silently dropped.
 */
export const COLUMNS: readonly ColumnRule[] = [
  { header: "SKU", field: "sku", authority: "sheet", note: "The identity. Matched exactly, never fuzzily, and immutable once a product exists." },
  { header: "FAMILY CODE", field: "familyCode", authority: "sheet", note: "Groups pack sizes into one product family. Structural; the dashboard does not edit it." },
  { header: "ITF", field: "itf14", authority: "both", note: "Carton barcode. 14 digits or blank." },
  { header: "EAN", field: "ean", authority: "both", note: "Retail barcode. 8 or 13 digits or blank." },
  { header: "SUPPLIER", field: "supplierName", authority: "sheet", note: "Internal. Resolves to a supplier row; never shown to a shopper." },
  { header: "BRAND GROUP", field: null, authority: "ignore", note: "Not modelled: the schema has brands and suppliers, and a third grouping has no home yet." },
  { header: "PRODUCT BRAND", field: "brandName", authority: "both", note: "Resolves to an existing brand by name. An unknown brand is a sync issue, never a new brand." },
  { header: "PRODUCT VARIANT", field: "displayName", authority: "both", note: "The descriptive product name the shelf shows." },
  { header: "SIZE", field: "packSizeLabel", authority: "both", note: "Pack size as printed — 5LT, 500ML." },
  { header: "SELLING UOM", field: null, authority: "ignore", note: "Every row is sold as a unit; the schema has no unit-of-measure column." },
  { header: "SYSTEM NAME", field: null, authority: "ignore", note: "The operator's own internal label. Not a catalogue field." },
  { header: "SHORT NAME", field: null, authority: "ignore", note: "Unused by the storefront, which shows the full descriptive name." },
  { header: "DESCRIPTION", field: "description", authority: "both", note: "Storefront copy, stored in product_content for the English locale." },
  { header: "CATEGORY", field: "categoryName", authority: "both", note: "Resolves to an existing category by name. An unknown category is a sync issue." },
  { header: "SUBCATEGORY", field: null, authority: "ignore", note: "The schema has one level of category today. Modelling a second is a schema decision, not a sync one." },
  { header: "TAGS", field: null, authority: "ignore", note: "No tag model exists. Importing free text into nothing would lose it silently." },
  { header: "WEBSITE STATUS", field: "storefrontVisible", authority: "both", note: "\"Show\" means visible. Anything else means not." },
  { header: "PRICE TZS", field: "priceTzs", authority: "both", note: "Whole shillings. Validated exactly as the admin editor is." },
  { header: "OFFER PRICE TZS", field: "offerPriceTzs", authority: "both", note: "Blank means no offer. Must be below the price, as the database CHECK also insists." },
  { header: "STOCK QTY", field: null, authority: "database", note: "NOT AUTHORITATIVE. The ledger owns stock. A Sheet edit here moves nothing; the current figure is reported back instead." },
  { header: "LOW STOCK THRESHOLD", field: "lowStockThreshold", authority: "both", note: "A merchandising setting, not a stock level. Safe in both directions." },
  { header: "ALLOW BACKORDER", field: null, authority: "ignore", note: "Out-of-stock ordering is not allowed and is not a per-product setting." },
  { header: "AVAILABILITY MESSAGE", field: null, authority: "ignore", note: "Availability wording is computed from real stock, never typed per product." },
  { header: "DELIVERY CLASS", field: null, authority: "ignore", note: "Delivery is priced by area, not by product class." },
  { header: "IMAGE URL", field: null, authority: "ignore", note: "Images live in Supabase Storage, matched on exact SKU. A URL here never becomes a product photograph." },
  { header: "IMAGE ASSET KEY", field: null, authority: "ignore", note: "Same: media mapping is by SKU and is not driven from the Sheet." },
  { header: "CARD SIZE", field: null, authority: "ignore", note: "A layout hint from an earlier design. The grid is uniform." },
  { header: "BEST SELLER", field: "bestSeller", authority: "both", note: "Merchandising flag." },
  { header: "FEATURED", field: "featured", authority: "both", note: "Merchandising flag." },
  { header: "NEW ARRIVAL", field: null, authority: "ignore", note: "No new-arrival flag in the schema; the shelf has no such row." },
  { header: "PRODUCT PRIORITY", field: "sortPriority", authority: "both", note: "Display order within a listing." },
  { header: "PRODUCT STATUS", field: "lifecycle", authority: "both", note: "Active / Hidden / Archived / Draft. Archiving from the Sheet is allowed; deleting is not." },
  { header: "SEO SLUG", field: "slug", authority: "both", note: "The web address. Changing it changes a link customers may have saved." },
  { header: "SEO TITLE", field: null, authority: "ignore", note: "Page titles are generated from the product name today." },
  { header: "META DESCRIPTION", field: null, authority: "ignore", note: "Generated. A per-product override is a later decision." },
  { header: "WEIGHT KG", field: null, authority: "ignore", note: "No shipping-weight model: delivery is priced by area." },
  { header: "DIMENSIONS", field: null, authority: "ignore", note: "Same." },
  { header: "TAX CLASS", field: null, authority: "ignore", note: "Prices are VAT-inclusive retail shillings; no per-product tax model." },
  { header: "NOTES", field: null, authority: "ignore", note: "The operator's own scratch column. Deliberately untouched." },
] as const;

/**
 * Columns the sync APPENDS to the right of the operator's own layout, and then
 * owns entirely. They are written by the database and never read as input, so
 * an operator typing in one changes nothing — which is why each is labelled.
 */
export const REPORT_COLUMNS: readonly ColumnRule[] = [
  { header: "SYSTEM AVAILABLE STOCK", field: "availableStock", authority: "report", note: "What can actually be sold right now: on hand minus what is promised to open orders." },
  { header: "SYSTEM IMAGE", field: "imageStatus", authority: "report", note: "Whether an approved photograph is filed for this SKU." },
  { header: "SYSTEM ON WEBSITE", field: "publishStatus", authority: "report", note: "Whether a shopper can see and buy it right now." },
  { header: "SYSTEM BLOCKED REASON", field: "blockedReason", authority: "report", note: "Why it is not on the website, in plain words. Blank when it is." },
  { header: "SYSTEM LAST SYNCED", field: "lastSyncedAt", authority: "report", note: "When this row was last compared with Jojo Usafi." },
] as const;

/** Every header the sync understands, report columns included. */
export const KNOWN_HEADERS: readonly string[] = [
  ...COLUMNS.map((c) => c.header),
  ...REPORT_COLUMNS.map((c) => c.header),
];

const norm = (header: string) => header.replace(/^﻿/, "").trim().toUpperCase();

const BY_HEADER = new Map<string, ColumnRule>(
  [...COLUMNS, ...REPORT_COLUMNS].map((rule) => [norm(rule.header), rule]),
);

export function ruleFor(header: string): ColumnRule | null {
  return BY_HEADER.get(norm(header)) ?? null;
}

/** The header that carries a given catalogue field, for writing back. */
export function headerFor(field: keyof CatalogueFields | string): string | null {
  return [...COLUMNS, ...REPORT_COLUMNS].find((c) => c.field === field)?.header ?? null;
}

export interface HeaderCheck {
  readonly ok: boolean;
  /** Headers present in the sheet that this file does not classify. */
  readonly unknown: string[];
  /** Headers this file expects that the sheet does not have. */
  readonly missing: string[];
  /** Report columns not yet present, which the sync would append. */
  readonly toAppend: string[];
}

/**
 * Look at the sheet's real headers before reading a single row.
 *
 * An unknown column is a STOP, not a warning: somebody has added a column and
 * nobody has decided whether the sync may write it, whether it is operational
 * truth, or whether it is a private note. Guessing that is how a spreadsheet
 * quietly starts overwriting the shop.
 *
 * A missing column is also a stop — a renamed `PRICE TZS` would otherwise read
 * as "every product has no price".
 */
export function checkHeaders(headers: readonly string[]): HeaderCheck {
  const present = new Set(headers.map(norm));
  const unknown = headers.filter((h) => h.trim() !== "" && !BY_HEADER.has(norm(h)));
  const missing = COLUMNS.filter((c) => !present.has(norm(c.header))).map((c) => c.header);
  const toAppend = REPORT_COLUMNS.filter((c) => !present.has(norm(c.header))).map((c) => c.header);

  return { ok: unknown.length === 0 && missing.length === 0, unknown, missing, toAppend };
}
