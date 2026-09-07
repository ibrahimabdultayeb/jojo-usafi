import { brands, categories, products, suppliers } from "./mock-data";
import type { Brand, Category, Product } from "./types";

/**
 * The only module the UI reads the catalogue through.
 *
 * Every function here is synchronous today because it reads local prototype data.
 * When Firestore is wired up these become async reads and the components change
 * from `const x = getX()` to `const x = await getX()` — nothing else moves.
 */

export function getBrands(): Brand[] {
  return brands;
}

export function getBrand(id: string): Brand | undefined {
  return brands.find((b) => b.id === id);
}

export function getCategories(): Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getSupplierName(id: string): string | undefined {
  return suppliers.find((s) => s.id === id)?.name;
}

export function getProducts(): Product[] {
  return products;
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductBySku(sku: string): Product | undefined {
  return products.find((p) => p.sku === sku);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return products.filter((p) => p.categoryId === categoryId);
}

/** All pack sizes of one product, smallest listed first, for the size chooser. */
export function getFamilySizes(familyId: string): Product[] {
  return products.filter((p) => p.familyId === familyId).sort((a, b) => a.price - b.price);
}

/** Other products a shopper is likely to add alongside this one. */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products.filter(
    (p) => p.categoryId === product.categoryId && p.familyId !== product.familyId,
  );
  const seenFamilies = new Set<string>();
  const unique = sameCategory.filter((p) => {
    if (seenFamilies.has(p.familyId)) return false;
    seenFamilies.add(p.familyId);
    return true;
  });
  return unique.slice(0, limit);
}

export function getBestSellers(limit = 8): Product[] {
  return products.filter((p) => p.featured).slice(0, limit);
}

/**
 * Best sellers first for a homepage category rail, showing one pack size per
 * product family so a short row does not read as the same bottle four times.
 * If a category has fewer families than the limit, the remaining slots are
 * backfilled with other sizes rather than left empty.
 */
export function getCategoryRail(categoryId: string, limit = 8): Product[] {
  const ranked = [...getProductsByCategory(categoryId)].sort(
    (a, b) => Number(b.featured) - Number(a.featured),
  );

  const seenFamilies = new Set<string>();
  const oncePerFamily: Product[] = [];
  const rest: Product[] = [];

  for (const product of ranked) {
    if (seenFamilies.has(product.familyId)) rest.push(product);
    else {
      seenFamilies.add(product.familyId);
      oncePerFamily.push(product);
    }
  }

  return [...oncePerFamily, ...rest].slice(0, limit);
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
      return sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export function searchProducts(list: Product[], term: string): Product[] {
  const q = term.trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => {
    const brand = getBrand(p.brandId)?.name ?? "";
    return `${brand} ${p.family} ${p.variant} ${p.packSize} ${p.sku}`.toLowerCase().includes(q);
  });
}

/** "Shower Gel Limette & Aloevera" — brand and pack size are shown separately. */
export function productName(product: Product): string {
  return `${product.family} ${product.variant}`.trim();
}

export function fullProductName(product: Product): string {
  const brand = getBrand(product.brandId)?.name;
  return [brand, productName(product), product.packSize].filter(Boolean).join(" ");
}
