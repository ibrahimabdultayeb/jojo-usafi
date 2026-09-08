import { getAllProductRecords, getBrand, getCategories } from "@/lib/catalogue/queries";
import type { Product } from "@/lib/catalogue/types";
import { mockCustomers } from "./mock/customers";
import { hasSyncIssue, isLowStock, isOutOfStock, stockFor, type StockReading } from "./mock/inventory";
import { mockOrders } from "./mock/orders";
import { mockWebsiteContent } from "./mock/content";
import { mockZones } from "./mock/zones";
import type { Customer, DeliveryZone, Order, ProductAdminStatus, WebsiteContent } from "./types";

/**
 * The only module the admin UI reads data through — the same idea as
 * `src/lib/catalogue/queries.ts` on the storefront side.
 *
 * Products are REAL: they come from the recovered Product Master. Orders,
 * customers, delivery zones and website content are MOCK, and every screen that
 * shows them says so.
 *
 * Everything here is synchronous because it reads local modules. When Supabase
 * lands these become async reads and the screens change from `const x = getX()`
 * to `const x = await getX()` — nothing else moves.
 */

/* -------------------------------------------------------------- orders --- */

export function getOrders(): Order[] {
  return mockOrders;
}

export function getOrder(id: string): Order | undefined {
  return mockOrders.find((order) => order.id.toLowerCase() === id.toLowerCase());
}

/** The prototype has no clock, so "today" is read off the display strings. */
function isToday(value: string): boolean {
  return value.startsWith("Today");
}

/* ----------------------------------------------------------- customers --- */

/**
 * Customer totals are DERIVED from the mock orders rather than stored, so the
 * customer screens can never disagree with the order screens.
 */
export function getCustomers(): Customer[] {
  return mockCustomers
    .map((seed) => {
      const orders = mockOrders
        .filter((order) => order.customerId === seed.id)
        .sort((a, b) => b.placedOrder - a.placedOrder);

      // Cancelled orders are not money the customer spent.
      const paidOrders = orders.filter((order) => order.status === "completed");

      return {
        id: seed.id,
        name: seed.name,
        phone: seed.phone,
        email: seed.email,
        addresses: seed.addresses,
        orderCount: orders.length,
        totalSpend: paidOrders.reduce((sum, order) => sum + order.total, 0),
        lastOrderAt: orders[0]?.placedAt ?? "",
        lastOrderId: orders[0]?.id ?? "",
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export function getCustomer(id: string): Customer | undefined {
  return getCustomers().find((customer) => customer.id === id);
}

export function getCustomerOrders(customerId: string): Order[] {
  return mockOrders
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => b.placedOrder - a.placedOrder);
}

/* --------------------------------------------------------------- zones --- */

export function getZones(): DeliveryZone[] {
  return [...mockZones].sort((a, b) => a.sortPriority - b.sortPriority);
}

/* ------------------------------------------------------------- website --- */

export function getWebsiteContent(): WebsiteContent {
  return mockWebsiteContent;
}

/* ------------------------------------------------------------ products --- */

/** Why a product is not on the website, in plain language. */
export type ProductBlockReason = "missing_image" | "price_needs_checking" | "other";

export interface AdminProduct {
  product: Product;
  brandName: string;
  categoryName: string;
  stock: StockReading;
  /** Is a customer able to see and buy this right now? */
  onWebsite: boolean;
  blockReasons: ProductBlockReason[];
  lowStock: boolean;
  outOfStock: boolean;
  missingImage: boolean;
  syncIssue: boolean;
  /** Editable lifecycle. Everything is Active until an admin changes it. */
  lifecycle: ProductAdminStatus;
}

const BLOCK_REASON_LABEL: Record<ProductBlockReason, string> = {
  missing_image: "No approved photo",
  price_needs_checking: "Price needs checking",
  other: "Not ready for the website",
};

export function blockReasonLabel(reason: ProductBlockReason): string {
  return BLOCK_REASON_LABEL[reason];
}

function toAdminProduct(product: Product): AdminProduct {
  const stock = stockFor(product);
  const missingImage = product.flags.includes("MISSING_APPROVED_IMAGE");
  const priceFlagged =
    product.flags.includes("PRICE_IMPLAUSIBLE") || product.flags.includes("PRICE_MISSING");

  const blockReasons: ProductBlockReason[] = [];
  if (missingImage) blockReasons.push("missing_image");
  if (priceFlagged) blockReasons.push("price_needs_checking");
  if (!product.publishable && blockReasons.length === 0) blockReasons.push("other");

  return {
    product,
    brandName: getBrand(product.brandId)?.name ?? "",
    categoryName: getCategories().find((c) => c.id === product.categoryId)?.name ?? "",
    stock,
    onWebsite: product.publishable,
    blockReasons,
    lowStock: isLowStock(product),
    outOfStock: isOutOfStock(product),
    missingImage,
    syncIssue: hasSyncIssue(product),
    lifecycle: "active",
  };
}

/**
 * Every master row, not just the publishable ones — the admin has to be able to
 * see and fix the 106 products that have no approved photo yet.
 */
export function getAdminProducts(): AdminProduct[] {
  return getAllProductRecords().map(toAdminProduct);
}

export function getAdminProduct(sku: string): AdminProduct | undefined {
  const product = getAllProductRecords().find(
    (p) => p.sku.toLowerCase() === sku.toLowerCase(),
  );
  return product ? toAdminProduct(product) : undefined;
}

/** Name, SKU, barcode or brand — the four things staff have to hand. */
export function searchAdminProducts(list: AdminProduct[], term: string): AdminProduct[] {
  const q = term.trim().toLowerCase();
  if (!q) return list;
  return list.filter((entry) => {
    const { product } = entry;
    const haystack = [
      product.family,
      product.variant,
      product.packSize,
      product.sku,
      product.barcode,
      entry.brandName,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/* ----------------------------------------------------------- dashboard --- */

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  hint: string;
  href: string;
  tone: "attention" | "progress" | "problem";
}

export interface Dashboard {
  todaySales: number;
  todayOrders: number;
  averageOrderValue: number;
  attention: AttentionItem[];
  recentOrders: Order[];
}

export function getDashboard(): Dashboard {
  const orders = getOrders();
  const products = getAdminProducts();

  const placedToday = orders.filter((order) => isToday(order.placedAt));
  const completedToday = orders.filter(
    (order) =>
      order.status === "completed" &&
      order.timeline.some((event) => event.kind === "completed" && isToday(event.at)),
  );

  const todaySales = completedToday.reduce((sum, order) => sum + order.total, 0);
  const averageOrderValue =
    completedToday.length > 0 ? Math.round(todaySales / completedToday.length) : 0;

  const count = (predicate: (order: Order) => boolean) => orders.filter(predicate).length;

  const lowStock = products.filter((p) => p.lowStock).length;
  const outOfStock = products.filter((p) => p.outOfStock).length;
  const syncIssues =
    products.filter((p) => p.syncIssue).length +
    orders.filter((order) => order.syncState === "issue").length;

  const attention: AttentionItem[] = [
    {
      key: "new",
      label: "New Orders",
      count: count((o) => o.status === "new"),
      hint: "Nobody has looked at these yet",
      href: "/admin/orders?filter=new",
      tone: "attention",
    },
    {
      key: "confirm",
      label: "Awaiting Confirmation",
      count: count((o) => o.status === "awaiting_confirmation"),
      hint: "Waiting for the customer to reply",
      href: "/admin/orders?filter=confirm",
      tone: "attention",
    },
    {
      key: "preparing",
      label: "Preparing",
      count: count((o) => o.status === "confirmed" || o.status === "preparing"),
      hint: "Being packed now",
      href: "/admin/orders?filter=preparing",
      tone: "progress",
    },
    {
      key: "low-stock",
      label: "Low Stock",
      count: lowStock,
      hint: "Running out soon",
      href: "/admin/products?filter=low-stock",
      tone: "attention",
    },
    {
      key: "out-of-stock",
      label: "Out of Stock",
      count: outOfStock,
      hint: "Cannot be sold right now",
      href: "/admin/products?filter=out-of-stock",
      tone: "problem",
    },
    {
      key: "sync",
      label: "Sync Issues",
      count: syncIssues,
      hint: "Changes that have not saved everywhere",
      href: "/admin/products?filter=sync-issue",
      tone: "problem",
    },
  ];

  return {
    todaySales,
    todayOrders: placedToday.length,
    averageOrderValue,
    attention,
    recentOrders: orders.slice(0, 5),
  };
}
