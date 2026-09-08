import type { Product } from "@/lib/catalogue/types";

/**
 * DEMONSTRATION STOCK OVERLAY — NOT REAL INVENTORY.
 *
 * Real stock comes from the Product Master's STOCK QTY, carried through to
 * `product.stockQty`. The master's numbers are healthy almost everywhere, so the
 * admin prototype would never show a low-stock or out-of-stock state without
 * help.
 *
 * This file supplies that help for a named handful of SKUs, and nothing else. It
 * is deliberately kept in one small module so the boundary is obvious:
 *
 *   - it NEVER writes to the Product Master or the generated catalogue
 *   - it NEVER changes a price, a name, or any product identity
 *   - every overridden value is reported as `source: "demo"`, and the UI labels
 *     it as demo data wherever it is shown
 *
 * When real inventory lands in Supabase this module is deleted outright.
 */

interface DemoStock {
  available: number;
  /** Why this SKU was chosen, so the demo state is never mistaken for a fact. */
  note: string;
}

/** Real SKUs from the recovered catalogue, chosen to exercise the UI states. */
const DEMO_STOCK: Record<string, DemoStock> = {
  "EP01-A02": { available: 6, note: "Low stock demo" },
  "EP02-A06": { available: 3, note: "Low stock demo" },
  "EP03-A02": { available: 0, note: "Out of stock demo" },
  "EP04-A02": { available: 9, note: "Low stock demo" },
  "EP09-A02": { available: 0, note: "Out of stock demo" },
  "EP19-A02": { available: 4, note: "Low stock demo" },
};

/** SKUs shown with a sync issue, so that UI state is reachable in the prototype. */
const DEMO_SYNC_ISSUES = new Set(["EP02-B02", "EP12-A02"]);

export interface StockReading {
  available: number;
  threshold: number;
  /** `master` is the Product Master's own figure; `demo` is this overlay. */
  source: "master" | "demo";
  note?: string;
}

export function stockFor(product: Product): StockReading {
  const demo = DEMO_STOCK[product.sku];
  if (demo) {
    return {
      available: demo.available,
      threshold: product.lowStockThreshold,
      source: "demo",
      note: demo.note,
    };
  }
  return {
    available: product.stockQty,
    threshold: product.lowStockThreshold,
    source: "master",
  };
}

export function isOutOfStock(product: Product): boolean {
  return stockFor(product).available <= 0;
}

export function isLowStock(product: Product): boolean {
  const { available, threshold } = stockFor(product);
  return available > 0 && available <= threshold;
}

export function hasSyncIssue(product: Product): boolean {
  return DEMO_SYNC_ISSUES.has(product.sku);
}

/** True when any demo value is in play, so a screen can say so out loud. */
export const DEMO_STOCK_SKUS = Object.keys(DEMO_STOCK);
export const DEMO_SYNC_SKUS = [...DEMO_SYNC_ISSUES];
