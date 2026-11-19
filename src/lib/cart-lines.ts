import type { CartLine, Product } from "./catalogue/types";

export const MAX_PER_LINE = 99;

/** Local storage is untrusted and may contain an older or damaged basket. */
export function normalizeCartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const line of value) {
    if (!line || typeof line !== "object" || typeof line.sku !== "string" ||
      !line.sku.trim() || typeof line.quantity !== "number" ||
      !Number.isFinite(line.quantity) || line.quantity <= 0) continue;
    const quantity = Math.min(MAX_PER_LINE, Math.floor(line.quantity));
    if (!quantity) continue;
    quantities.set(line.sku, Math.min(MAX_PER_LINE, (quantities.get(line.sku) ?? 0) + quantity));
  }
  return Array.from(quantities, ([sku, quantity]) => ({ sku, quantity }));
}

/** A helpful client limit; checkout still rechecks live stock on the server. */
export function cartQuantityLimit(product: Pick<Product, "inStock" | "stockQty">): number {
  return product.inStock && Number.isFinite(product.stockQty)
    ? Math.max(0, Math.min(MAX_PER_LINE, Math.floor(product.stockQty)))
    : 0;
}
