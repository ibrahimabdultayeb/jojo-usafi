import generated from "./generated/catalogue.json";
import type { Brand, Catalogue, Category, Product, Supplier } from "./types";

/**
 * The only module the UI reads the catalogue through.
 *
 * It is backed by `generated/catalogue.json`, which `scripts/build-catalogue.mjs`
 * builds from the Product Master CSV and the approved photography. The generated
 * file holds ALL master rows; everything exported here exposes only the rows that
 * are safe to show a customer.
 *
 * Every function is synchronous today because it reads a committed file. When
 * Supabase is wired up these become async reads and components change from
 * `const x = getX()` to `const x = await getX()` — nothing else moves.
 */

const catalogue = generated as unknown as Catalogue;

/** Every master row, including the ones withheld from customers. Validation only. */
export function getAllProductRecords(): Product[] {
  return catalogue.products;
}

/** The publishable shelf: an approved photo, a plausible price, active status. */
const products: Product[] = catalogue.products.filter((p) => p.publishable);

const publishableBrandIds = new Set(products.map((p) => p.brandId));
const publishableCategoryIds = new Set(products.map((p) => p.categoryId));

/** Brands with at least one publishable product — never a link into an empty shelf. */
const brands: Brand[] = catalogue.brands.filter((b) => publishableBrandIds.has(b.id));
const categories: Category[] = catalogue.categories.filter((c) => publishableCategoryIds.has(c.id));

export function getBrands(): Brand[] {
  return brands;
}

export function getBrand(id: string): Brand | undefined {
  return catalogue.brands.find((b) => b.id === id);
}

export function getCategories(): Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getSuppliers(): Supplier[] {
  return catalogue.suppliers;
}

export function getSupplierName(id: string): string | undefined {
  return catalogue.suppliers.find((s) => s.id === id)?.name;
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

/** All pack sizes of one product, smallest pack first, for the size chooser. */
export function getFamilySizes(familyId: string): Product[] {
  return products.filter((p) => p.familyId === familyId).sort((a, b) => a.sizeRank - b.sizeRank);
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

/** The master's BEST SELLER column, one pack size per family so the row varies. */
export function getBestSellers(limit = 8): Product[] {
  const seenFamilies = new Set<string>();
  const picked: Product[] = [];
  for (const product of products.filter((p) => p.bestSeller)) {
    if (seenFamilies.has(product.familyId)) continue;
    seenFamilies.add(product.familyId);
    picked.push(product);
    if (picked.length === limit) break;
  }
  return picked;
}

/**
 * Best sellers first for a homepage category rail, showing one pack size per
 * product family so a short row does not read as the same bottle four times.
 * If a category has fewer families than the limit, the remaining slots are
 * backfilled with other sizes rather than left empty.
 */
export function getCategoryRail(categoryId: string, limit = 8): Product[] {
  const ranked = [...getProductsByCategory(categoryId)].sort(
    (a, b) => Number(b.bestSeller) - Number(a.bestSeller),
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
      return sorted.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller));
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

/** "Multipurpose Detergent Lemon Fresh" — brand and pack size are shown separately. */
export function productName(product: Product): string {
  return `${product.family} ${product.variant}`.trim();
}

export function fullProductName(product: Product): string {
  const brand = getBrand(product.brandId)?.name;
  return [brand, productName(product), product.packSize].filter(Boolean).join(" ");
}
