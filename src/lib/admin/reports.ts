import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The numbers a person running this shop actually asks for.
 *
 * Deliberately small. The temptation with a reports screen is to build the
 * analytics product first and find out later which two figures anybody looks
 * at; this is the two figures. Sales today, sales this week and month, how many
 * orders and what they averaged, how the endings split, what is selling, and
 * what is about to run out.
 *
 * NO CHART LIBRARY. Every number here is one line of text, and a sparkline
 * would cost more kilobytes than the whole screen. If a trend is ever genuinely
 * needed, that is the point to reconsider — not before.
 *
 * READ THROUGH THE CALLER'S OWN SESSION, so Row Level Security answers. An
 * Order staff account has no `analytics.view` in the matrix and never reaches
 * the screen; if it somehow did, the database would return what an Order staff
 * account may see rather than the shop's revenue.
 *
 * AGGREGATED, NOT ITEMISED. Nothing here returns a customer's name, phone or
 * address. The top-selling list is SKUs and quantities. A reports screen is not
 * a reason to put the customer list somewhere new.
 */

export interface MoneyWindow {
  readonly orders: number;
  readonly salesTzs: number;
  readonly averageTzs: number;
}

export interface TopProduct {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly salesTzs: number;
}

export interface StockWarning {
  readonly sku: string;
  readonly name: string;
  readonly available: number;
}

export interface Reports {
  readonly today: MoneyWindow;
  readonly week: MoneyWindow;
  readonly month: MoneyWindow;
  /** Every order ever placed, by how it ended. */
  readonly endings: {
    readonly completed: number;
    readonly cancelled: number;
    readonly deliveryFailed: number;
    readonly open: number;
  };
  /** What was actually collected, across completed orders. */
  readonly payment: { readonly cash: number; readonly digital: number; readonly unrecorded: number };
  readonly topProducts: readonly TopProduct[];
  readonly outOfStock: readonly StockWarning[];
  readonly lowStock: readonly StockWarning[];
  /** True when the shop has never completed an order, so the screen can say so. */
  readonly neverSoldAnything: boolean;
}

const EMPTY_WINDOW: MoneyWindow = { orders: 0, salesTzs: 0, averageTzs: 0 };

/** Midnight this morning, in the shop's own day rather than in UTC. */
function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function windowFrom(rows: { total_tzs: number; state: string }[]): MoneyWindow {
  // Sales means money the shop actually took. An order placed today and
  // cancelled this afternoon is not a sale, and counting it would make the
  // revenue tile disagree with the till.
  const completed = rows.filter((row) => row.state === "completed");
  const salesTzs = completed.reduce((sum, row) => sum + row.total_tzs, 0);

  return {
    orders: rows.length,
    salesTzs,
    averageTzs: completed.length > 0 ? Math.round(salesTzs / completed.length) : 0,
  };
}

export async function getReports(): Promise<Reports> {
  const supabase = await getServerSupabase();

  const today = startOfToday();
  const week = new Date(today);
  week.setDate(week.getDate() - 6); // today plus the six days before it
  const month = new Date(today);
  month.setDate(month.getDate() - 29);

  /*
   * One read of the last thirty days, sliced three ways here.
   *
   * Three separate range queries would be three round trips to Mumbai for data
   * that overlaps almost entirely. Thirty days of a small shop's orders is a
   * few hundred rows at most.
   */
  const [recent, all, items, shelf] = await Promise.all([
    supabase
      .from("orders")
      .select("total_tzs, state, placed_at, payment_method")
      .gte("placed_at", month.toISOString()),
    supabase.from("orders").select("state, payment_method"),
    supabase
      .from("order_items")
      .select("sku, product_name, quantity, line_total_tzs, orders!inner ( state )")
      .eq("orders.state", "completed"),
    supabase
      .from("product_shelf")
      .select("sku, display_name, available, low_stock, in_stock")
      .order("available"),
  ]);

  const recentRows = recent.data ?? [];
  const inWindow = (from: Date) =>
    recentRows.filter((row) => new Date(row.placed_at) >= from);

  const allOrders = all.data ?? [];

  /* --------------------------------------------------------- what sold */

  const bySku = new Map<string, TopProduct>();
  for (const line of items.data ?? []) {
    const found = bySku.get(line.sku) ?? {
      sku: line.sku,
      name: line.product_name,
      quantity: 0,
      salesTzs: 0,
    };
    bySku.set(line.sku, {
      ...found,
      quantity: found.quantity + line.quantity,
      salesTzs: found.salesTzs + line.line_total_tzs,
    });
  }

  const topProducts = [...bySku.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8);

  /* ------------------------------------------------------ what is short */

  const shelfRows = shelf.data ?? [];
  const warning = (row: (typeof shelfRows)[number]): StockWarning => ({
    sku: row.sku ?? "",
    name: row.display_name ?? "",
    available: row.available ?? 0,
  });

  return {
    today: windowFrom(inWindow(today)),
    week: windowFrom(inWindow(week)),
    month: windowFrom(recentRows),
    endings: {
      completed: allOrders.filter((row) => row.state === "completed").length,
      cancelled: allOrders.filter((row) => row.state === "cancelled").length,
      deliveryFailed: allOrders.filter((row) => row.state === "delivery_failed").length,
      open: allOrders.filter(
        (row) => !["completed", "cancelled", "delivery_failed"].includes(row.state),
      ).length,
    },
    payment: {
      cash: allOrders.filter((row) => row.payment_method === "cash").length,
      digital: allOrders.filter((row) => row.payment_method === "digital").length,
      // A completed order with no method recorded should be impossible — the
      // database refuses it — so this is here to show a zero, and to be loud if
      // it ever is not.
      unrecorded: allOrders.filter(
        (row) => row.state === "completed" && row.payment_method === null,
      ).length,
    },
    topProducts,
    outOfStock: shelfRows.filter((row) => row.in_stock === false).slice(0, 10).map(warning),
    lowStock: shelfRows.filter((row) => row.low_stock === true).slice(0, 10).map(warning),
    neverSoldAnything: allOrders.every((row) => row.state !== "completed"),
  };
}

export const EMPTY_REPORTS: Reports = {
  today: EMPTY_WINDOW,
  week: EMPTY_WINDOW,
  month: EMPTY_WINDOW,
  endings: { completed: 0, cancelled: 0, deliveryFailed: 0, open: 0 },
  payment: { cash: 0, digital: 0, unrecorded: 0 },
  topProducts: [],
  outOfStock: [],
  lowStock: [],
  neverSoldAnything: true,
};

/* -------------------------------------------------------------- media */

export interface MediaReport {
  /** Products with no approved photograph — the largest launch gap there is. */
  readonly missingPhoto: readonly { sku: string; name: string; lifecycle: string }[];
  readonly missingPhotoCount: number;
  /** Files in Storage that no product points at. Never attached automatically. */
  readonly orphans: readonly { path: string; filename: string | null; when: string }[];
}

/**
 * What the catalogue's photography is missing, and what is left over.
 *
 * NOTHING HERE IS ACTED ON AUTOMATICALLY. An orphaned file is listed, never
 * attached: matching a file to a product by its name would be a guess, and a
 * guess that puts the wrong photograph on a product is worse than a product
 * with none. `EP23-A02` is the standing example — an approved photograph whose
 * product row does not exist, and which stays an orphan until somebody decides
 * to create that row.
 */
export async function getMediaReport(): Promise<MediaReport> {
  const supabase = await getServerSupabase();

  const [products, assets] = await Promise.all([
    supabase
      .from("products")
      .select("sku, display_name, lifecycle, product_media ( role )")
      .order("sku"),
    supabase
      .from("media_assets")
      .select("id, storage_path, source_filename, created_at, product_media ( id )")
      .eq("storage_bucket", "product-media")
      .order("created_at", { ascending: false }),
  ]);

  const missingPhoto = (products.data ?? [])
    .filter((row) => !(row.product_media ?? []).some((link) => link.role === "primary"))
    .map((row) => ({ sku: row.sku, name: row.display_name, lifecycle: row.lifecycle }));

  const orphans = (assets.data ?? [])
    .filter((row) => (row.product_media ?? []).length === 0)
    .map((row) => ({
      path: row.storage_path,
      filename: row.source_filename,
      when: row.created_at,
    }));

  return {
    missingPhoto: missingPhoto.slice(0, 200),
    missingPhotoCount: missingPhoto.length,
    orphans,
  };
}
