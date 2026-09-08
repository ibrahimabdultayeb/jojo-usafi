/**
 * SKU — the stable business identifier.
 *
 * Everything keys off it: the cart, order lines, image matching, the stock
 * ledger and the Google Sheet sync. Once a SKU has appeared on an order it is
 * historical fact; a trigger in migration 0005 refuses to rewrite it.
 *
 * The pattern is deliberately generic. "EP01-A02" fits it, but so does any
 * future brand's coding scheme — nothing here assumes EcoPlus.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";

/**
 * Uppercase letters, digits, dot, underscore and hyphen. 2–48 characters,
 * starting on a letter or digit.
 *
 * MUST stay identical to the CHECK constraint on `products.sku` and
 * `order_items.sku`; `scripts/schema-check.mjs` compares the two.
 */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,47}$/;

export const skuSchema = z
  .string({ message: "Enter a SKU." })
  .trim()
  .regex(SKU_PATTERN, {
    message: "A SKU uses capital letters, numbers, dots, dashes or underscores — 2 to 48 characters.",
  });

export type Sku = string;

/**
 * Tidy a SKU a human typed or a spreadsheet cell produced, without changing its
 * identity: trim, collapse nothing, uppercase. A lowercase "ep01-a02" from the
 * Sheet is the same product as "EP01-A02"; a SKU with an internal space is not
 * a formatting problem, it is a different string, and is rejected.
 */
export function normalizeSku(input: string): string {
  return input.trim().toUpperCase();
}

export function isSku(value: unknown): value is Sku {
  return typeof value === "string" && SKU_PATTERN.test(value);
}

export function parseSku(input: unknown): Result<Sku> {
  if (typeof input !== "string") return err("invalid_sku", "Enter a SKU.");
  const parsed = skuSchema.safeParse(normalizeSku(input));
  if (!parsed.success) {
    return err("invalid_sku", parsed.error.issues[0]?.message ?? "That SKU is not valid.");
  }
  return ok(parsed.data);
}

/**
 * Find SKUs that appear more than once. The Sheet is a spreadsheet: a copied
 * row is the single most likely way a duplicate ever reaches the database, and
 * catching it before the write gives a better message than a unique-violation.
 */
export function findDuplicateSkus(skus: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const raw of skus) {
    const sku = normalizeSku(raw);
    if (seen.has(sku)) duplicates.add(sku);
    else seen.add(sku);
  }
  return [...duplicates].sort();
}
