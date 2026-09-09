/**
 * Turning a spreadsheet row into a catalogue record, or refusing to.
 *
 * EVERYTHING HERE TREATS THE SHEET AS UNTRUSTED INPUT. It is a text file a
 * person edits on a phone; it will contain "TSh 34,000", "34 000", a stray
 * apostrophe, a pasted newline, "TRUE", "Yes", "y", and a price somebody meant
 * to be 34000 and typed as 3400. The same domain rules that guard the admin
 * editor guard it here, and the database CHECK constraints guard it a third
 * time. A row that cannot be read is a reported issue, never a silent skip and
 * never a coerced guess.
 *
 * Pure: no database, no Google, no clock. Everything is testable from a
 * literal.
 */

import type { CatalogueFields } from "./columns";
import { ruleFor } from "./columns";

export interface RowIssue {
  readonly sku: string | null;
  readonly row: number;
  readonly field: string | null;
  readonly problem: string;
}

export type ParsedRow =
  | { readonly ok: true; readonly sku: string; readonly row: number; readonly fields: CatalogueFields; readonly reference: ReferenceFields }
  | { readonly ok: false; readonly sku: string | null; readonly row: number; readonly issues: RowIssue[] };

/** Sheet-owned metadata that is not part of the bidirectional comparison. */
export interface ReferenceFields {
  readonly familyCode: string | null;
  readonly supplierName: string | null;
}

/* ------------------------------------------------------------- primitives */

/** Spreadsheet cells arrive as strings, and a lot of them are nearly-empty. */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  // A leading apostrophe is how a spreadsheet forces a value to stay text;
  // it belongs to the spreadsheet, not to the data.
  return String(value).replace(/^'/, "").replace(/\s+/g, " ").trim();
}

/**
 * A whole number of shillings, or null when the cell is blank, or NaN when the
 * cell has something in it that is not a number.
 *
 * Deliberately strict about what it strips: spaces, commas and a leading
 * currency word, because those are how a person writes money. It does NOT
 * strip a decimal point — "34.5" is not a number of shillings and must be
 * reported rather than rounded, and it does not accept a negative.
 */
function shillings(value: unknown): number | null | typeof NaN {
  const raw = text(value);
  if (raw === "") return null;
  const cleaned = raw.replace(/^(tsh|tzs)\s*/i, "").replace(/[\s,]/g, "");
  if (!/^\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

function wholeNumber(value: unknown): number | null | typeof NaN {
  const raw = text(value);
  if (raw === "") return null;
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^-?\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "show", "on", "shown"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "hide", "hidden", "off", ""]);

function bool(value: unknown): boolean | typeof NaN {
  const word = text(value).toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return NaN;
}

const LIFECYCLES = ["draft", "active", "hidden", "archived"] as const;
type Lifecycle = (typeof LIFECYCLES)[number];

function lifecycle(value: unknown): Lifecycle | null | typeof NaN {
  const word = text(value).toLowerCase();
  if (word === "") return null;
  return (LIFECYCLES as readonly string[]).includes(word) ? (word as Lifecycle) : NaN;
}

/** The same pattern the database column enforces. */
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,47}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Derive a web address from a name, the way the importer already does. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/* ------------------------------------------------------------------ parse */

/**
 * One row, by header name rather than by position.
 *
 * Column ORDER is never assumed: `checkHeaders` has already proved every header
 * is one this project classified, and the row is read through that map. Moving
 * a column in the spreadsheet must not change what the sync does.
 */
export function parseRow(
  cells: Record<string, unknown>,
  rowNumber: number,
): ParsedRow {
  const issues: RowIssue[] = [];
  const get = (header: string) => cells[header];
  const add = (field: string | null, problem: string, sku: string | null) =>
    issues.push({ sku, row: rowNumber, field, problem });

  const sku = text(get("SKU")).toUpperCase();

  // A blank SKU is never invented. The row is reported and left alone: it may
  // be a heading someone typed, a half-finished product, or a real one waiting
  // for its code, and none of those is ours to decide.
  if (sku === "") {
    add(null, "This row has no SKU, so there is nothing to match it to. Add the SKU or remove the row.", null);
    return { ok: false, sku: null, row: rowNumber, issues };
  }
  if (!SKU_PATTERN.test(sku)) {
    add("sku", `"${sku}" is not a valid SKU. Use letters, numbers, dots, dashes or underscores.`, sku);
    return { ok: false, sku, row: rowNumber, issues };
  }

  const displayName = text(get("PRODUCT VARIANT"));
  if (displayName === "") add("displayName", "This product has no name.", sku);

  const brandName = text(get("PRODUCT BRAND"));
  if (brandName === "") add("brandName", "This product has no brand.", sku);

  const categoryName = text(get("CATEGORY"));
  if (categoryName === "") add("categoryName", "This product has no category.", sku);

  const price = shillings(get("PRICE TZS"));
  if (Number.isNaN(price as number)) {
    add("priceTzs", `"${text(get("PRICE TZS"))}" is not a price. Use whole shillings, for example 34000.`, sku);
  } else if (price === null) {
    add("priceTzs", "This product has no price.", sku);
  }

  const offer = shillings(get("OFFER PRICE TZS"));
  if (Number.isNaN(offer as number)) {
    add("offerPriceTzs", `"${text(get("OFFER PRICE TZS"))}" is not a price. Leave it empty for no offer.`, sku);
  } else if (offer !== null && typeof price === "number" && offer >= price) {
    add("offerPriceTzs", `The offer price (${offer}) has to be lower than the price (${price}).`, sku);
  }

  const visible = bool(get("WEBSITE STATUS"));
  if (Number.isNaN(visible as number)) {
    add("storefrontVisible", `"${text(get("WEBSITE STATUS"))}" is not clear. Use Show or Hide.`, sku);
  }

  const featured = bool(get("FEATURED"));
  if (Number.isNaN(featured as number)) add("featured", "Featured must be Yes or No.", sku);

  const bestSeller = bool(get("BEST SELLER"));
  if (Number.isNaN(bestSeller as number)) add("bestSeller", "Best seller must be Yes or No.", sku);

  const status = lifecycle(get("PRODUCT STATUS"));
  if (Number.isNaN(status as number)) {
    add("lifecycle", `"${text(get("PRODUCT STATUS"))}" is not a status. Use Active, Hidden, Archived or Draft.`, sku);
  }

  const lowStock = wholeNumber(get("LOW STOCK THRESHOLD"));
  if (Number.isNaN(lowStock as number) || (typeof lowStock === "number" && lowStock < 0)) {
    add("lowStockThreshold", "The low stock warning has to be a whole number, zero or more.", sku);
  }

  const priority = wholeNumber(get("PRODUCT PRIORITY"));
  if (Number.isNaN(priority as number)) add("sortPriority", "Display order has to be a whole number.", sku);

  const ean = text(get("EAN"));
  if (ean !== "" && !/^(\d{8}|\d{13})$/.test(ean)) {
    add("ean", `"${ean}" is not a barcode. An EAN is 8 or 13 digits.`, sku);
  }

  const itf = text(get("ITF"));
  if (itf !== "" && !/^\d{14}$/.test(itf)) {
    add("itf14", `"${itf}" is not a carton barcode. An ITF-14 is 14 digits.`, sku);
  }

  const rawSlug = text(get("SEO SLUG"));
  const slug = rawSlug === "" ? slugify(displayName) : rawSlug.toLowerCase();
  if (slug === "" || !SLUG_PATTERN.test(slug)) {
    add("slug", `"${rawSlug}" is not a valid web address. Use lowercase letters, numbers and dashes.`, sku);
  }

  if (issues.length > 0) return { ok: false, sku, row: rowNumber, issues };

  const description = text(get("DESCRIPTION"));

  return {
    ok: true,
    sku,
    row: rowNumber,
    fields: {
      displayName,
      // The master carries the whole descriptive name in one column and has no
      // separate variant. Blank stays blank rather than being split by guesswork.
      variantLabel: null,
      packSizeLabel: text(get("SIZE")) || null,
      categoryName,
      brandName,
      ean: ean || null,
      itf14: itf || null,
      priceTzs: price as number,
      offerPriceTzs: offer,
      storefrontVisible: visible as boolean,
      featured: featured as boolean,
      bestSeller: bestSeller as boolean,
      lifecycle: (status ?? "draft") as CatalogueFields["lifecycle"],
      lowStockThreshold: (lowStock ?? 0) as number,
      sortPriority: (priority ?? 0) as number,
      slug,
      description: description || null,
    },
    reference: {
      familyCode: text(get("FAMILY CODE")) || null,
      supplierName: text(get("SUPPLIER")) || null,
    },
  };
}

/* --------------------------------------------------------------- a sheet */

export interface SheetSnapshot {
  readonly headers: readonly string[];
  /** Data rows only, each already keyed by header. Row 1 is the header row. */
  readonly rows: readonly { readonly rowNumber: number; readonly cells: Record<string, unknown> }[];
}

/** Raw grid (including the header row) → rows keyed by header. */
export function toSnapshot(grid: readonly (readonly unknown[])[]): SheetSnapshot {
  const [headerRow = [], ...body] = grid;
  const headers = headerRow.map((h) => String(h ?? "").replace(/^﻿/, "").trim());

  const rows = body
    .map((cells, index) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, column) => {
        if (header !== "") record[header] = cells[column];
      });
      return { rowNumber: index + 2, cells: record };
    })
    // A trailing run of blank rows is how every spreadsheet ends. It is not
    // 900 products with no SKU.
    .filter((row) => Object.values(row.cells).some((value) => text(value) !== ""));

  return { headers, rows };
}

export interface ParsedSheet {
  readonly parsed: ParsedRow[];
  readonly issues: RowIssue[];
  /** SKUs appearing on more than one row, with the rows they appear on. */
  readonly duplicates: { readonly sku: string; readonly rows: number[] }[];
}

/**
 * Parse every row, then check the one thing a row cannot check about itself:
 * that its SKU is unique. Two rows claiming the same SKU is not a merge — it is
 * two people describing different products with the same code, and neither may
 * be applied.
 */
export function parseSheet(snapshot: SheetSnapshot): ParsedSheet {
  const parsed = snapshot.rows.map((row) => parseRow(row.cells, row.rowNumber));
  const issues = parsed.flatMap((row) => (row.ok ? [] : row.issues));

  const rowsBySku = new Map<string, number[]>();
  for (const row of parsed) {
    if (!row.sku) continue;
    rowsBySku.set(row.sku, [...(rowsBySku.get(row.sku) ?? []), row.row]);
  }

  const duplicates = [...rowsBySku.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([sku, rows]) => ({ sku, rows }));

  for (const duplicate of duplicates) {
    issues.push({
      sku: duplicate.sku,
      row: duplicate.rows[0],
      field: "sku",
      problem: `${duplicate.sku} is on ${duplicate.rows.length} rows (${duplicate.rows.join(", ")}). A SKU identifies one product, so none of these rows can be applied.`,
    });
  }

  const duplicated = new Set(duplicates.map((d) => d.sku));

  return {
    parsed: parsed.map((row) =>
      row.ok && duplicated.has(row.sku)
        ? { ok: false as const, sku: row.sku, row: row.row, issues: [] }
        : row,
    ),
    issues,
    duplicates,
  };
}

/** Exposed for the tests that prove the header map, not the values, is used. */
export const __internal = { text, shillings, bool, lifecycle, ruleFor };
