/**
 * Catalogue types for the Jojo Usafi storefront.
 *
 * Jojo Usafi is the retailer. A brand (EcoPlus today) is one supplier catalogue
 * among many, so nothing here may assume cleaning products, EP codes or a single
 * brand. Adding an unrelated brand must only mean adding rows, never new types.
 */

export type PackType = "bottle" | "jerrycan" | "drum" | "tub" | "carton" | "sachet";

/** Visual tone used by the placeholder product artwork. */
export type Tone = "green" | "lime" | "aqua" | "sky" | "berry" | "amber" | "violet" | "slate";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  /** Single letter used by the placeholder brand mark. */
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

export interface Product {
  id: string;
  /** Stable identifier. Never rewritten once used on an order. */
  sku: string;
  slug: string;
  brandId: string;
  supplierId: string;
  categoryId: string;
  /**
   * Products that only differ by size share a familyId, which is what lets the
   * product page offer a size chooser instead of listing near-duplicates.
   */
  familyId: string;
  /** Family name, e.g. "Multipurpose Detergent". */
  family: string;
  /** Variant within the family, e.g. "Lemon Fresh". */
  variant: string;
  packSize: string;
  packType: PackType;
  price: number;
  description: string;
  badges: ProductBadge[];
  inStock: boolean;
  featured: boolean;
  tone: Tone;
}

export interface CartLine {
  sku: string;
  quantity: number;
}
