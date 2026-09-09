import type { Brand, Product } from "./types";

/**
 * Catalogue presentation, as pure functions.
 *
 * Split out of `queries.ts` when the catalogue moved to Supabase: reading is
 * now asynchronous and server-only, but naming, sorting and searching are
 * neither. Client components — the cart drawer, the checkout summary, the
 * mobile menu — need these and must not drag a database client into the
 * browser bundle to get them.
 */

/** "Multipurpose Detergent Lemon Fresh" — brand and pack size are shown separately. */
export function productName(product: Product): string {
  return `${product.family} ${product.variant}`.trim();
}

/** The full shelf name, when the brand is already to hand. */
export function fullProductNameWith(product: Product, brand: Brand | undefined): string {
  return [brand?.name, productName(product), product.packSize].filter(Boolean).join(" ");
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const sorted = [...list];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "name":
      return sorted.sort((a, b) => productName(a).localeCompare(productName(b)));
    default:
      return sorted.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller));
  }
}

export function searchProducts(list: Product[], term: string, brandsById: Map<string, Brand>): Product[] {
  const q = term.trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => {
    const brand = brandsById.get(p.brandId)?.name ?? "";
    return `${brand} ${p.family} ${p.variant} ${p.packSize} ${p.sku}`.toLowerCase().includes(q);
  });
}
