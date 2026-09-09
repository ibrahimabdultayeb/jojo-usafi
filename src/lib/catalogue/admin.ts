import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/public";

/**
 * The catalogue as the admin dashboard needs to see it: real, and including the
 * products a shopper never sees.
 *
 * READ THROUGH THE CALLER'S OWN SESSION, deliberately — not the service role.
 * The ten dashboard screens are not yet behind a sign-in guard, so a privileged
 * read here would hand the shop's full price and stock list to anyone who typed
 * `/admin`. With the session client, Row Level Security answers: staff see all
 * 201 products, and anybody else sees the 95 that are already public. The page
 * says which of those happened rather than pretending.
 *
 * Stock, visibility, offer price and the blocked reasons are now REAL columns.
 * Until Build 07 they were invented in `src/mocks/admin/data.ts` because the
 * Product Master had nowhere to put them; the database does.
 */

export interface AdminCatalogueProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brandName: string;
  categoryName: string;
  packSize: string;
  price: number;
  offerPrice: number | null;
  stock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  visible: boolean;
  lifecycle: string;
  imageUrl: string | null;
  /** The shapes the approved admin screens already read. Derived, never a second truth. */
  hidden: boolean;
  image: { src: string; width: number; height: number } | null;
  /** No Sheet sync exists yet, so nothing can be out of step with it. */
  syncIssue: false;
  /** No approved photograph — the single largest reason a product is withheld. */
  missingImage: boolean;
  /** A price the catalogue build flagged as implausible. Never corrected here. */
  suspiciousPrice: boolean;
  featured: boolean;
  bestSeller: boolean;
  description: string;
  categoryId: string;
}

/** Below this, a TZS retail price cannot be genuine. Mirrors the catalogue build. */
const IMPLAUSIBLE_PRICE_TZS = 1000;

export interface AdminCatalogue {
  products: AdminCatalogueProduct[];
  /** True when the reader is staff and is therefore seeing withheld products too. */
  complete: boolean;
  totals: { all: number; visible: number; missingImage: number; suspicious: number };
}

export async function getAdminCatalogue(): Promise<AdminCatalogue> {
  const supabase = await getServerSupabase();

  // Asked first, because the answer decides which COLUMNS may even be named.
  // `anon` holds a column-limited grant on `inventory` — product, location and
  // `available`, never `on_hand` or `reserved` — so a query that asks for the
  // shop's stock breakdown as a stranger is refused by PostgreSQL before any
  // row is considered. Selecting them anyway would turn the boundary working
  // correctly into a 500 page.
  const { data: staffFlag } = await supabase.rpc("jojo_is_staff");
  const isStaff = staffFlag === true;

  const stockColumns = isStaff ? "on_hand, reserved, available" : "available";

  const products = await supabase
    .from("products")
    .select(
      `id, sku, slug, display_name, pack_size_label, price_tzs, offer_price_tzs,
       lifecycle, storefront_visible, low_stock_threshold, featured, best_seller, category_id,
       brands ( name ), categories ( name ),
       inventory ( ${stockColumns} ),
       product_media ( role, media_assets ( storage_bucket, storage_path ) )`,
    )
    .order("sku");

  if (products.error) {
    throw new Error(`Could not read the catalogue: ${products.error.message}`);
  }

  const rows: AdminCatalogueProduct[] = (products.data ?? []).map((row) => {
    // The selected columns vary with who is asking, so the row shape is stated
    // here rather than inferred from a template string.
    const stockRow = (Array.isArray(row.inventory) ? row.inventory[0] : row.inventory) as
      | { on_hand?: number; reserved?: number; available?: number | null }
      | null
      | undefined;
    const primary = (Array.isArray(row.product_media) ? row.product_media : [])
      .filter((m) => m.role === "primary")
      .map((m) => (Array.isArray(m.media_assets) ? m.media_assets[0] : m.media_assets))
      .find(Boolean);

    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;

    return {
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      name: row.display_name,
      brandName: brand?.name ?? "",
      categoryName: category?.name ?? "",
      packSize: row.pack_size_label ?? "",
      price: row.price_tzs,
      offerPrice: row.offer_price_tzs,
      // A non-staff reader is shown availability, which is all they may see.
      stock: stockRow?.on_hand ?? stockRow?.available ?? 0,
      reserved: stockRow?.reserved ?? 0,
      available: stockRow?.available ?? 0,
      lowStockThreshold: row.low_stock_threshold,
      visible: row.storefront_visible,
      lifecycle: row.lifecycle,
      imageUrl: primary ? publicStorageUrl(primary.storage_bucket, primary.storage_path) : null,
      hidden: !row.storefront_visible,
      image: primary
        ? { src: publicStorageUrl(primary.storage_bucket, primary.storage_path), width: 800, height: 800 }
        : null,
      syncIssue: false as const,
      missingImage: !primary,
      suspiciousPrice: row.price_tzs > 0 && row.price_tzs < IMPLAUSIBLE_PRICE_TZS,
      featured: row.featured,
      bestSeller: row.best_seller,
      // The Product Master carries a description for 1 of 201 rows, and the
      // column is not selected here — the editor shows an empty box, honestly.
      description: "",
      categoryId: row.category_id,
    };
  });

  return {
    products: rows,
    complete: isStaff,
    totals: {
      all: rows.length,
      visible: rows.filter((p) => p.visible).length,
      missingImage: rows.filter((p) => p.missingImage).length,
      suspicious: rows.filter((p) => p.suspiciousPrice).length,
    },
  };
}
