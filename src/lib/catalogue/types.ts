/**
 * Catalogue types for the Jojo Usafi storefront.
 *
 * Jojo Usafi is the retailer. A brand (EcoPlus today) is one supplier catalogue
 * among many, so nothing here may assume cleaning products, EP codes or a single
 * brand. Adding an unrelated brand must only mean adding rows, never new types.
 *
 * These shapes are produced by `scripts/build-catalogue.mjs` from the Product
 * Master CSV and the approved white-background photography. They deliberately
 * mirror the documents the future Supabase tables will hold.
 */

export type PackType = "bottle" | "jerrycan" | "drum" | "tub" | "carton" | "sachet";

/** Visual tone used by brand marks, category tiles and placeholder artwork. */
export type Tone = "green" | "lime" | "aqua" | "sky" | "berry" | "amber" | "violet" | "slate";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  /** Derived from the master: the category this brand sells most of. */
  tagline: string;
  /** Single letter used by the brand mark. */
  mark: string;
  tone: Tone;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  /** Short line shown under the category name on the storefront. */
  blurb: string;
  /** Inline SVG path data for the category tile icon. */
  icon: string;
  tone: Tone;
}

export interface ProductBadge {
  label: string;
  kind: "bestseller" | "value" | "new" | "bulk";
}

/**
 * An approved product photograph, matched to its product on the exact SKU.
 * `source` records the approved filename it came from, so any image shown on the
 * storefront can be traced back to the file Ibrahim approved.
 */
export interface ProductImage {
  src: string;
  width: number;
  height: number;
  source: string;
}

/**
 * Why a master row is not safe to show customers. Rows carrying any blocking
 * flag stay in the catalogue but never reach the storefront.
 */
export type ProductFlag =
  | "MISSING_APPROVED_IMAGE"
  | "PRICE_MISSING"
  | "PRICE_IMPLAUSIBLE"
  | "PRICE_INVERSION"
  | "BRAND_UNRESOLVED"
  | "CATEGORY_UNRESOLVED"
  | "WEBSITE_STATUS_NOT_SHOW"
  | "PRODUCT_STATUS_NOT_ACTIVE";

export interface Product {
  id: string;
  /** Stable identifier. Never rewritten once used on an order. */
  sku: string;
  slug: string;
  brandId: string;
  supplierId: string;
  categoryId: string;
  /**
   * The master's FAMILY CODE. Products that only differ by size share it, which
   * is what lets the product page offer a size chooser instead of near-duplicates.
   */
  familyId: string;
  /** The master's descriptive product name, e.g. "Multipurpose Detergent Lemon Fresh". */
  family: string;
  /** Empty: the master has no separate variant column to read. */
  variant: string;
  packSize: string;
  packType: PackType;
  /** Millilitres or grams, so pack sizes sort smallest-first rather than by price. */
  sizeRank: number;
  price: number;
  /** Import-only catalogue facts, carried for Supabase rather than the shelf. */
  offerPrice: number | null;
  ean: string | null;
  itf14: string | null;
  stockQty: number;
  lowStockThreshold: number;
  /** Blank for 200 of 201 master rows. Never invented. */
  description: string;
  badges: ProductBadge[];
  inStock: boolean;
  bestSeller: boolean;
  featured: boolean;
  tone: Tone;
  /** Present only when an approved photo matched this exact SKU. */
  image: ProductImage | null;
  flags: ProductFlag[];
  /** False keeps the product out of every public storefront surface. */
  publishable: boolean;
}

export interface CartLine {
  sku: string;
  quantity: number;
}

export interface Catalogue {
  suppliers: Supplier[];
  brands: Brand[];
  categories: Category[];
  products: Product[];
}
