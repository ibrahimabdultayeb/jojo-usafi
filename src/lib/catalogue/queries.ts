import { unstable_cache } from "next/cache";
import { getPublicSupabase, publicStorageUrl } from "@/lib/supabase/public";
import type { Brand, Catalogue, Category, Product, ProductBadge, Tone } from "./types";
import { productName } from "./format";

export { productName, sortProducts, searchProducts, type SortKey } from "./format";

/**
 * The only module the storefront reads the catalogue through — now backed by
 * Supabase instead of a committed JSON file.
 *
 * HOW MANY QUERIES A SHOPPER COSTS
 *
 * Three, for the whole catalogue, shared by every visitor for five minutes.
 *
 * The shelf is 95 products that change when Ibrahim changes them, which is not
 * often and never mid-page-load. So the whole thing is fetched once — the
 * `product_shelf` view plus the brand and category lists — and cached. A
 * homepage that renders four shelves, a category strip and a brand row costs
 * the same three queries as a single product page, and usually none at all.
 *
 * What this deliberately is NOT: a per-product read. Ninety-five products on a
 * Shop All page must never be ninety-five round trips to Mumbai.
 *
 * Commerce is a different matter. Checkout must price the cart from the
 * database at the moment of the order, not from a five-minute-old snapshot, and
 * will read authoritatively rather than through here.
 *
 * WHY `product_shelf`
 *
 * The view is the one definition of "a customer may see this": active,
 * switched on for the storefront, and photographed. Reading `products` here and
 * filtering in TypeScript would put a second definition in the application,
 * where it could drift. Anything this module cannot see is something Row Level
 * Security has already decided is not public.
 */

const REVALIDATE_SECONDS = 300;

/** Presentation only — never product data. Mirrors the catalogue builder. */
const TONES: Tone[] = ["green", "lime", "aqua", "sky", "berry", "amber", "violet", "slate"];

function toneFrom(value: string | null | undefined, seed: string): Tone {
  if (value && (TONES as string[]).includes(value)) return value as Tone;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

function badgesFor(row: { best_seller: boolean | null; featured: boolean | null }): ProductBadge[] {
  const badges: ProductBadge[] = [];
  if (row.best_seller) badges.push({ label: "Best Seller", kind: "bestseller" });
  if (row.featured) badges.push({ label: "Featured", kind: "new" });
  return badges;
}

/**
 * One fetch of everything public, cached across requests and visitors.
 *
 * `unstable_cache` is the right tool rather than `React.cache`: React's cache
 * dedupes within a single render, which would still mean one database round
 * trip per page view. This survives between requests.
 */
const loadCatalogue = unstable_cache(
  async (): Promise<Catalogue> => {
    const db = getPublicSupabase();

    const [shelf, brandRows, categoryRows] = await Promise.all([
      db.from("product_shelf").select("*").order("sort_priority").order("sku"),
      db.from("brands").select("*").eq("active", true).order("sort_priority").order("name"),
      db.from("categories").select("*").eq("active", true).order("sort_priority").order("name"),
    ]);

    if (shelf.error) throw new Error(`Could not read the shelf: ${shelf.error.message}`);
    if (brandRows.error) throw new Error(`Could not read brands: ${brandRows.error.message}`);
    if (categoryRows.error) throw new Error(`Could not read categories: ${categoryRows.error.message}`);

    const brands: Brand[] = (brandRows.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline ?? "",
      mark: row.mark ?? row.name.slice(0, 1).toUpperCase(),
      tone: toneFrom(row.tone, row.slug),
    }));

    const categories: Category[] = (categoryRows.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      blurb: row.blurb ?? "",
      icon: row.icon_path ?? "",
      tone: toneFrom(row.tone, row.slug),
    }));

    const toneByBrandId = new Map(brands.map((brand) => [brand.id, brand.tone]));

    const products: Product[] = (shelf.data ?? []).map((row) => ({
      id: row.id!,
      sku: row.sku!,
      slug: row.slug!,
      brandId: row.brand_id!,
      // Suppliers are commercial information and are not exposed to shoppers —
      // `product_shelf` does not carry one, and neither does this.
      supplierId: "",
      categoryId: row.category_id!,
      familyId: row.family_id!,
      family: row.display_name!,
      variant: row.variant_label ?? "",
      packSize: row.pack_size_label ?? "",
      packType: (row.pack_type ?? "bottle") as Product["packType"],
      sizeRank: row.size_rank ?? 0,
      price: row.price_tzs!,
      offerPrice: row.offer_price_tzs,
      ean: null,
      itf14: null,
      stockQty: row.available ?? 0,
      lowStockThreshold: 0,
      description: "",
      badges: badgesFor(row),
      inStock: Boolean(row.in_stock),
      bestSeller: Boolean(row.best_seller),
      featured: Boolean(row.featured),
      tone: toneByBrandId.get(row.brand_id!) ?? "slate",
      image: row.image_path
        ? {
            src: publicStorageUrl(row.image_bucket ?? "product-media", row.image_path),
            width: row.image_width ?? 800,
            height: row.image_height ?? 800,
            source: row.image_alt ?? "",
          }
        : null,
      flags: [],
      publishable: true,
    }));

    // Brands and categories with nothing on the shelf are dropped, so no link
    // ever leads a shopper into an empty page.
    const stockedBrands = new Set(products.map((p) => p.brandId));
    const stockedCategories = new Set(products.map((p) => p.categoryId));

    return {
      suppliers: [],
      brands: brands.filter((b) => stockedBrands.has(b.id)),
      categories: categories.filter((c) => stockedCategories.has(c.id)),
      products,
    };
  },
  ["jojo-catalogue-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalogue"] },
);

export async function getCatalogue(): Promise<Catalogue> {
  return loadCatalogue();
}

/* ------------------------------------------------------------------ reads */

export async function getProducts(): Promise<Product[]> {
  return (await getCatalogue()).products;
}

export async function getBrands(): Promise<Brand[]> {
  return (await getCatalogue()).brands;
}

export async function getBrand(id: string): Promise<Brand | undefined> {
  return (await getCatalogue()).brands.find((b) => b.id === id);
}

export async function getCategories(): Promise<Category[]> {
  return (await getCatalogue()).categories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getCatalogue()).categories.find((c) => c.slug === slug);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await getProducts()).find((p) => p.slug === slug);
}

export async function getProductBySku(sku: string): Promise<Product | undefined> {
  return (await getProducts()).find((p) => p.sku === sku);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return (await getProducts()).filter((p) => p.categoryId === categoryId);
}

/** All pack sizes of one product, smallest pack first, for the size chooser. */
export async function getFamilySizes(familyId: string): Promise<Product[]> {
  return (await getProducts())
    .filter((p) => p.familyId === familyId)
    .sort((a, b) => a.sizeRank - b.sizeRank);
}

/** Other products a shopper is likely to add alongside this one. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const products = await getProducts();
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
export async function getBestSellers(limit = 8): Promise<Product[]> {
  const seenFamilies = new Set<string>();
  const picked: Product[] = [];
  for (const product of (await getProducts()).filter((p) => p.bestSeller)) {
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
export async function getCategoryRail(categoryId: string, limit = 8): Promise<Product[]> {
  const ranked = [...(await getProductsByCategory(categoryId))].sort(
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

export async function fullProductName(product: Product): Promise<string> {
  const brand = await getBrand(product.brandId);
  return [brand?.name, productName(product), product.packSize].filter(Boolean).join(" ");
}
