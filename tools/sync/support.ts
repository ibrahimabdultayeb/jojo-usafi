import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  googleSheetGateway,
  googleStatus,
  type CellUpdate,
  type SheetGateway,
} from "@/lib/sheets/google";
import type { CatalogueFields, } from "@/lib/sheets/columns";
import type { DbProduct } from "@/lib/sheets/plan";

/**
 * Shared ground for the staged sync operations.
 *
 * Two guarantees live here, and both are load-bearing:
 *
 *   `assertDevelopment()`  — refuses to run against anything but the
 *                            development project and the one approved
 *                            spreadsheet, checked before a single call.
 *   `readOnly()`           — a gateway whose write methods throw, so a step
 *                            that is supposed to look does not depend on a flag
 *                            being honoured somewhere else to avoid writing.
 */

export const DEV_PROJECT_REF = "dyjhacbbedytcstxxjzl";
export const APPROVED_SPREADSHEET_ID = "1mezJmgIu5VKT643DdeJtgqeYFfYyQFNqVNQfLNax2z4";
export const APPROVED_TAB = "Product Master";

export function loadEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* already loaded */
  }
}

/** Nothing runs until both the database and the spreadsheet are the intended ones. */
export function assertDevelopment(): void {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(DEV_PROJECT_REF)) {
    throw new Error(`Refusing to run against ${url}. Development project only.`);
  }

  const status = googleStatus();
  if (!status.configured) {
    throw new Error(`Google is not configured: waiting for ${status.missing.join(", ")}.`);
  }
  if (status.config.spreadsheetId !== APPROVED_SPREADSHEET_ID) {
    throw new Error("Refusing to open a spreadsheet other than the approved Product Master.");
  }
  if (status.config.tab !== APPROVED_TAB) {
    throw new Error(`Refusing to open the tab "${status.config.tab}".`);
  }
}

export function db(): SupabaseClient<Database> {
  loadEnv();
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function liveGateway(): SheetGateway {
  const status = googleStatus();
  if (!status.configured) throw new Error("not configured");
  return googleSheetGateway(status.config);
}

/** A gateway that cannot write, whatever it is asked to do. */
export function readOnly(gateway: SheetGateway): SheetGateway & { attempts: string[] } {
  const attempts: string[] = [];
  return {
    attempts,
    describe: gateway.describe,
    readGrid: () => gateway.readGrid(),
    writeCells: async (updates: readonly CellUpdate[]) => {
      attempts.push(`writeCells(${updates.length})`);
      throw new Error("READ-ONLY STEP: a sheet write was attempted and blocked.");
    },
    appendHeaders: async (headers: readonly string[]) => {
      attempts.push(`appendHeaders(${headers.length})`);
      throw new Error("READ-ONLY STEP: a header append was attempted and blocked.");
    },
  };
}

/**
 * A gateway that writes for real, but only cells whose column this step has
 * approved. Anything else throws before it reaches Google.
 *
 * This is the belt to `planSync`'s braces on the baseline run: even if the plan
 * were wrong, a write to one of Ibrahim's own columns cannot leave the process.
 */
export function onlyColumns(
  gateway: SheetGateway,
  headerRow: readonly string[],
  allowed: readonly string[],
): SheetGateway & { written: CellUpdate[] } {
  const permitted = new Set(allowed.map((h) => h.trim().toUpperCase()));
  const written: CellUpdate[] = [];

  return {
    written,
    describe: gateway.describe,
    readGrid: () => gateway.readGrid(),

    async writeCells(updates: readonly CellUpdate[]) {
      for (const update of updates) {
        const header = (headerRow[update.column] ?? "").trim().toUpperCase();
        // A column past the end of the header row is one this run is appending,
        // which is checked against the allow-list by name below.
        const name = header === "" ? `COLUMN ${update.column}` : header;
        if (!permitted.has(header)) {
          throw new Error(
            `BOUNDARY: this step may only write ${allowed.join(", ")} — it tried to write ${name} at row ${update.row}.`,
          );
        }
      }
      written.push(...updates);
      await gateway.writeCells(updates);
    },

    async appendHeaders(headers: readonly string[], afterColumnCount: number) {
      for (const header of headers) {
        if (!permitted.has(header.trim().toUpperCase())) {
          throw new Error(`BOUNDARY: this step may not append the column ${header}.`);
        }
      }
      await gateway.appendHeaders(headers, afterColumnCount);
    },
  };
}

/* ------------------------------------------------------- reading the shop */

export const PRODUCT_SELECT = `
  id, sku, slug, display_name, variant_label, pack_size_label,
  price_tzs, offer_price_tzs, storefront_visible, featured, best_seller,
  lifecycle, low_stock_threshold, sort_priority, ean, itf14,
  brands ( name ), categories ( name ),
  inventory ( on_hand, reserved, available ),
  product_media ( role ),
  product_content ( locale, description )
`;

const one = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/** The catalogue in the shape `planSync` compares, minus any test fixtures. */
export async function realProducts(
  client: SupabaseClient<Database> = db(),
): Promise<DbProduct[]> {
  const { data, error } = await client.from("products").select(PRODUCT_SELECT).order("sku");
  if (error) throw new Error(`Could not read the catalogue: ${error.message}`);

  return (data ?? [])
    .filter((row) => !row.sku.startsWith("ZZ"))
    .map((row) => {
      const stock = one(
        row.inventory as unknown as { on_hand: number; reserved: number; available: number }[] | null,
      );
      const media = (Array.isArray(row.product_media) ? row.product_media : []) as { role: string }[];
      const content = (Array.isArray(row.product_content) ? row.product_content : []) as {
        locale: string;
        description: string | null;
      }[];

      const hasImage = media.some((m) => m.role === "primary");
      const onWebsite = row.lifecycle === "active" && row.storefront_visible && hasImage;
      const blocked: string[] = [];
      if (!hasImage) blocked.push("no approved photo");
      if (row.lifecycle !== "active") blocked.push(`status is ${row.lifecycle}`);
      if (!row.storefront_visible) blocked.push("switched off");

      const fields: CatalogueFields = {
        displayName: row.display_name,
        variantLabel: row.variant_label,
        packSizeLabel: row.pack_size_label,
        categoryName: one(row.categories as unknown as { name: string }[] | null)?.name ?? "",
        brandName: one(row.brands as unknown as { name: string }[] | null)?.name ?? "",
        ean: row.ean,
        itf14: row.itf14,
        priceTzs: row.price_tzs,
        offerPriceTzs: row.offer_price_tzs,
        storefrontVisible: row.storefront_visible,
        featured: row.featured,
        bestSeller: row.best_seller,
        lifecycle: row.lifecycle as CatalogueFields["lifecycle"],
        lowStockThreshold: row.low_stock_threshold,
        sortPriority: row.sort_priority,
        slug: row.slug,
        description: content.find((c) => c.locale === "en")?.description ?? null,
      };

      return {
        id: row.id,
        sku: row.sku,
        fields,
        report: {
          availableStock: stock?.available ?? 0,
          hasImage,
          onWebsite,
          blockedReason: onWebsite ? "" : blocked.join(", "),
        },
      };
    });
}

/** A snapshot of everything that must not move, for comparing before and after. */
export async function shopSnapshot(client: SupabaseClient<Database> = db()) {
  const count = async (table: string) => {
    const { count: n } = await client.from(table as never).select("*", { count: "exact", head: true });
    return n ?? 0;
  };

  const { data: inventory } = await client
    .from("inventory")
    .select("product_id, on_hand, reserved, available")
    .order("product_id");

  const { data: shelf } = await client.from("product_shelf").select("sku").order("sku");

  const { data: prices } = await client
    .from("products")
    .select("sku, price_tzs, offer_price_tzs")
    .not("sku", "like", "ZZ%")
    .order("sku");

  return {
    products: await count("products"),
    orders: await count("orders"),
    orderItems: await count("order_items"),
    customers: await count("customers"),
    movements: await count("inventory_movements"),
    inventory: JSON.stringify(inventory),
    shelf: (shelf ?? []).map((r) => r.sku),
    prices: JSON.stringify(prices),
  };
}

export const say = (text = "") => console.log(text);
