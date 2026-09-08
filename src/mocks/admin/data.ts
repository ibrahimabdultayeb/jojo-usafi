import { getAllProductRecords, getProducts } from "@/lib/catalogue/queries";

/**
 * MOCK ADMIN DATA.
 *
 * Nothing here is real and nothing is written anywhere. It exists so the admin
 * prototype can be judged on how it *works* — is the next action obvious, does
 * an order card scan in two seconds on a phone — before it is wired to
 * a real backend later. No backend exists yet.
 *
 * Products are the exception: those come from the real generated catalogue, so
 * the product screens are exercised against the genuine 95-product shelf.
 */

/* -------------------------------------------------------------- orders */

export type OrderStage =
  | "new"
  | "awaiting_confirmation"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "delivery_failed";

/** Friendly labels. The internal stage name is never shown to an operator. */
export const STAGE_LABEL: Record<OrderStage, string> = {
  new: "New order",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  delivery_failed: "Delivery failed",
};

export const STAGE_TONE: Record<OrderStage, string> = {
  new: "bg-brand-50 text-brand-800 ring-brand-200",
  awaiting_confirmation: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-800 ring-sky-200",
  preparing: "bg-violet-50 text-violet-800 ring-violet-200",
  out_for_delivery: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  cancelled: "bg-rose-50 text-rose-800 ring-rose-200",
  delivery_failed: "bg-rose-50 text-rose-800 ring-rose-200",
};

/** The single obvious thing to do next, per stage. Terminal stages have none. */
export const NEXT_ACTION: Partial<Record<OrderStage, { label: string; becomes: OrderStage }>> = {
  new: { label: "Confirm order", becomes: "confirmed" },
  awaiting_confirmation: { label: "Confirm order", becomes: "confirmed" },
  confirmed: { label: "Start preparing", becomes: "preparing" },
  preparing: { label: "Send out for delivery", becomes: "out_for_delivery" },
  out_for_delivery: { label: "Complete order", becomes: "completed" },
};

export const CANCELLATION_REASONS = [
  "Customer changed mind",
  "Customer unreachable",
  "Out of stock",
  "Outside delivery area",
  "Duplicate order",
  "Pricing error",
  "Suspected fraud",
  "Other",
];

export const DELIVERY_FAILURE_REASONS = [
  "Nobody at the address",
  "Customer postponed",
  "Wrong or unclear address",
  "Customer refused the order",
  "Other",
];

export interface OrderLine {
  sku: string;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface TimelineEntry {
  label: string;
  at: string;
  by: string;
  done: boolean;
}

export interface AdminOrder {
  id: string;
  number: string;
  stage: OrderStage;
  placed: string;
  customer: { id: string; name: string; phone: string };
  delivery: { zone: string; address: string; fee: number; freeDelivery: boolean };
  lines: OrderLine[];
  payment: { preference: "Cash on delivery" | "Pay digitally on delivery"; received: null | { method: string; reference?: string; amount: number } };
  note?: string;
}

const line = (sku: string, name: string, size: string, quantity: number, unitPrice: number): OrderLine => ({
  sku, name, size, quantity, unitPrice,
});

export const orders: AdminOrder[] = [
  {
    id: "1",
    number: "JU-000128",
    stage: "new",
    placed: "Today, 09:12",
    customer: { id: "c1", name: "Hassan Ali", phone: "+255 712 884 210" },
    delivery: { zone: "Upanga", address: "Ocean Road, near Aga Khan Hospital", fee: 4000, freeDelivery: false },
    lines: [
      line("EP01-A02", "Multix Multipurpose Detergent Lemon Fresh", "5LT", 1, 34000),
      line("EP09-A07", "Softi Handwash Aloevera", "500ML", 2, 4000),
    ],
    payment: { preference: "Cash on delivery", received: null },
  },
  {
    id: "2",
    number: "JU-000127",
    stage: "awaiting_confirmation",
    placed: "Today, 08:40",
    customer: { id: "c2", name: "Neema Mushi", phone: "+255 754 220 118" },
    delivery: { zone: "Mikocheni", address: "Mikocheni B, Plot 44, blue gate", fee: 0, freeDelivery: true },
    lines: [
      line("EP10-C02", "Bubbles Shower Gel Aqua Splash", "5LT", 1, 32200),
      line("EP01-A06", "Multix Multipurpose Detergent Lemon Fresh", "750ML", 3, 11400),
    ],
    payment: { preference: "Pay digitally on delivery", received: null },
    note: "Customer asked us to call before arriving.",
  },
  {
    id: "3",
    number: "JU-000126",
    stage: "confirmed",
    placed: "Today, 07:55",
    customer: { id: "c3", name: "Joseph Mwakalinga", phone: "+255 682 771 903" },
    delivery: { zone: "Masaki", address: "Chole Road, Apartment 3B", fee: 5000, freeDelivery: false },
    lines: [line("EP06-D03", "Ozone Fabric Softener Enchanted Rose", "1500ML", 4, 9500)],
    payment: { preference: "Cash on delivery", received: null },
  },
  {
    id: "4",
    number: "JU-000125",
    stage: "preparing",
    placed: "Yesterday, 17:20",
    customer: { id: "c4", name: "Amina Juma", phone: "+255 745 118 662" },
    delivery: { zone: "Kariakoo", address: "Msimbazi Street, above the pharmacy", fee: 3500, freeDelivery: false },
    lines: [
      line("EP03-C02", "Quack Floor Disinfectant Rose", "5LT", 2, 24000),
      line("EP21-A07", "Softi Body Lotion", "500ML", 1, 7500),
    ],
    payment: { preference: "Pay digitally on delivery", received: null },
  },
  {
    id: "5",
    number: "JU-000124",
    stage: "out_for_delivery",
    placed: "Yesterday, 15:05",
    customer: { id: "c5", name: "Grace Kimaro", phone: "+255 767 903 441" },
    delivery: { zone: "Upanga", address: "United Nations Road, house 12", fee: 4000, freeDelivery: false },
    lines: [line("EP01-B02", "Multix Multipurpose Detergent Lime Fresh", "5LT", 1, 34000)],
    payment: { preference: "Cash on delivery", received: null },
  },
  {
    id: "6",
    number: "JU-000123",
    stage: "completed",
    placed: "Yesterday, 11:32",
    customer: { id: "c1", name: "Hassan Ali", phone: "+255 712 884 210" },
    delivery: { zone: "Upanga", address: "Ocean Road, near Aga Khan Hospital", fee: 4000, freeDelivery: false },
    lines: [
      line("EP01-A02", "Multix Multipurpose Detergent Lemon Fresh", "5LT", 1, 34000),
      line("EP10-C02", "Bubbles Shower Gel Aqua Splash", "5LT", 1, 32200),
    ],
    payment: { preference: "Pay digitally on delivery", received: { method: "Digital", reference: "M-Pesa QK4RT77J21", amount: 70200 } },
  },
  {
    id: "7",
    number: "JU-000122",
    stage: "delivery_failed",
    placed: "2 days ago, 14:10",
    customer: { id: "c6", name: "Peter Shirima", phone: "+255 715 442 087" },
    delivery: { zone: "Masaki", address: "Haile Selassie Road, gate 7", fee: 5000, freeDelivery: false },
    lines: [line("EP01-C02", "Multix Multipurpose Detergent Orange Fresh", "5LT", 1, 34000)],
    payment: { preference: "Cash on delivery", received: null },
    note: "Nobody at the address. Items returned to the shop.",
  },
  {
    id: "8",
    number: "JU-000121",
    stage: "cancelled",
    placed: "2 days ago, 09:47",
    customer: { id: "c7", name: "Fatma Rashid", phone: "+255 786 330 512" },
    delivery: { zone: "Mikocheni", address: "Mwai Kibaki Road, opposite the school", fee: 0, freeDelivery: true },
    lines: [line("EP09-A07", "Softi Handwash Aloevera", "500ML", 4, 4000)],
    payment: { preference: "Cash on delivery", received: null },
    note: "Cancelled — customer changed mind.",
  },
];

export const orderTotals = (order: AdminOrder) => {
  const subtotal = order.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const delivery = order.delivery.freeDelivery ? 0 : order.delivery.fee;
  return { subtotal, delivery, total: subtotal + delivery, items: order.lines.reduce((n, l) => n + l.quantity, 0) };
};

export const timelineFor = (order: AdminOrder): TimelineEntry[] => {
  const order_of: OrderStage[] = ["new", "confirmed", "preparing", "out_for_delivery", "completed"];
  const reached = order_of.indexOf(order.stage === "awaiting_confirmation" ? "new" : order.stage);
  const labels = ["Order received", "Confirmed", "Preparing", "Out for delivery", "Delivered and paid"];
  const times = [order.placed, "Today, 09:20", "Today, 09:44", "Today, 11:02", "Today, 12:15"];
  return labels.map((label, i) => ({
    label,
    at: i <= reached ? times[i] : "",
    by: i === 0 ? "Customer" : "Ibrahim",
    done: i <= reached,
  }));
};

/* ----------------------------------------------------------- customers */

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses: { zone: string; line: string }[];
  orderCount: number;
  totalSpend: number;
  lastOrder: string;
}

export const customers: AdminCustomer[] = [
  { id: "c1", name: "Hassan Ali", phone: "+255 712 884 210", email: "hassan.ali@example.com", addresses: [{ zone: "Upanga", line: "Ocean Road, near Aga Khan Hospital" }], orderCount: 6, totalSpend: 284500, lastOrder: "Today" },
  { id: "c2", name: "Neema Mushi", phone: "+255 754 220 118", addresses: [{ zone: "Mikocheni", line: "Mikocheni B, Plot 44, blue gate" }], orderCount: 4, totalSpend: 168400, lastOrder: "Today" },
  { id: "c3", name: "Joseph Mwakalinga", phone: "+255 682 771 903", addresses: [{ zone: "Masaki", line: "Chole Road, Apartment 3B" }], orderCount: 2, totalSpend: 81000, lastOrder: "Today" },
  { id: "c4", name: "Amina Juma", phone: "+255 745 118 662", email: "amina.j@example.com", addresses: [{ zone: "Kariakoo", line: "Msimbazi Street, above the pharmacy" }], orderCount: 9, totalSpend: 412300, lastOrder: "Yesterday" },
  { id: "c5", name: "Grace Kimaro", phone: "+255 767 903 441", addresses: [{ zone: "Upanga", line: "United Nations Road, house 12" }], orderCount: 1, totalSpend: 38000, lastOrder: "Yesterday" },
  { id: "c6", name: "Peter Shirima", phone: "+255 715 442 087", addresses: [{ zone: "Masaki", line: "Haile Selassie Road, gate 7" }], orderCount: 3, totalSpend: 96500, lastOrder: "2 days ago" },
  { id: "c7", name: "Fatma Rashid", phone: "+255 786 330 512", addresses: [{ zone: "Mikocheni", line: "Mwai Kibaki Road, opposite the school" }], orderCount: 2, totalSpend: 32000, lastOrder: "2 days ago" },
];

/* ------------------------------------------------------ delivery zones */

export interface AdminZone {
  id: string;
  name: string;
  fee: number;
  freeDelivery: boolean;
  active: boolean;
  priority: number;
}

/** The fee a brand-new zone starts on. */
export const DEFAULT_ZONE_FEE = 4000;

export const zones: AdminZone[] = [
  { id: "z1", name: "Upanga", fee: 4000, freeDelivery: false, active: true, priority: 1 },
  { id: "z2", name: "Masaki", fee: 5000, freeDelivery: false, active: true, priority: 2 },
  { id: "z3", name: "Mikocheni", fee: 4000, freeDelivery: true, active: true, priority: 3 },
  { id: "z4", name: "Kariakoo", fee: 3500, freeDelivery: false, active: true, priority: 4 },
  { id: "z5", name: "Mbezi Beach", fee: 6000, freeDelivery: false, active: false, priority: 5 },
];

/* --------------------------------------------------------------- home */

export const todayStats = {
  sales: 186400,
  orders: 7,
  averageOrderValue: 26629,
};

export interface AttentionItem {
  label: string;
  count: number;
  href: string;
  tone: "urgent" | "warn" | "calm";
  hint: string;
}

/**
 * Missing-image is a real figure from the catalogue report, not a mock one:
 * it is the number of master rows the pipeline withheld for having no approved
 * photograph or flagged data.
 */
export const attention: AttentionItem[] = [
  { label: "New orders", count: 1, href: "/admin/orders?stage=new", tone: "urgent", hint: "Waiting to be confirmed" },
  { label: "Awaiting confirmation", count: 1, href: "/admin/orders?stage=awaiting_confirmation", tone: "urgent", hint: "Customer contacted, not confirmed" },
  { label: "Preparing", count: 1, href: "/admin/orders?stage=preparing", tone: "calm", hint: "Being packed now" },
  { label: "Out for delivery", count: 1, href: "/admin/orders?stage=out_for_delivery", tone: "calm", hint: "On the way to the customer" },
  { label: "Out of stock", count: 0, href: "/admin/products?filter=out-of-stock", tone: "warn", hint: "Cannot be ordered" },
  { label: "Low stock", count: 3, href: "/admin/products?filter=low-stock", tone: "warn", hint: "Running out soon" },
  { label: "Missing image", count: withheldCount(), href: "/admin/products?filter=missing-image", tone: "warn", hint: "Held back from the website" },
  { label: "Sync issues", count: 0, href: "/admin/more", tone: "calm", hint: "Product sheet and website agree" },
];

export const activity = [
  { at: "09:44", text: "Order JU-000126 confirmed", by: "Ibrahim" },
  { at: "09:12", text: "Order JU-000128 received from Hassan Ali", by: "Website" },
  { at: "08:40", text: "Order JU-000127 received from Neema Mushi", by: "Website" },
  { at: "08:05", text: "Price updated for Multix Multipurpose Detergent Lemon Fresh 5LT", by: "Ibrahim" },
  { at: "07:30", text: "Product sheet synced — 95 products up to date", by: "System" },
];

/* ------------------------------------------------------------ website */

export interface ContentSection {
  id: string;
  label: string;
  visible: boolean;
  description: string;
}

export const homepageSections: ContentSection[] = [
  { id: "categories", label: "Shop by category", visible: true, description: "The row of category tiles under the banner" },
  { id: "best-sellers", label: "Best sellers", visible: true, description: "Products marked Best seller" },
  { id: "category-grids", label: "Category product grids", visible: true, description: "One product row per category" },
  { id: "trust", label: "Why shop with us", visible: true, description: "The three promises band" },
  { id: "delivery", label: "Delivery area banner", visible: true, description: "The green banner about where you deliver" },
  { id: "brands", label: "Brands we stock", visible: true, description: "The brand tiles" },
  { id: "how", label: "How ordering works", visible: true, description: "The three-step dark band" },
];

export const contentDraft = {
  announcementEn: "Delivery across selected Dar es Salaam areas",
  announcementSw: "Tunafikisha katika maeneo teule ya Dar es Salaam",
  heroHeadlineEn: "A cleaner home. Without the trip.",
  heroHeadlineSw: "Nyumba safi. Bila kutoka nje.",
  heroSubEn: "Household essentials brought to your door across Dar es Salaam.",
  heroSubSw: "Bidhaa za nyumbani zinafikishwa mlangoni kwako Dar es Salaam.",
  bannerEn: "Free delivery in Mikocheni this week",
  bannerSw: "Usafirishaji bure Mikocheni wiki hii",
  bannerVisible: false,
};

/* ----------------------------------------------------------- products */

/**
 * The publishable shelf, wrapped with the operational state an admin needs.
 *
 * The catalogue fields are real — SKU, name, price, size, photograph — and come
 * from the generated Product Master. Stock, visibility, offer price and sync
 * state are mock: the master has no such columns, and inventing them in the
 * catalogue itself would be inventing business data. They live only here.
 */
export function adminProducts() {
  return getProducts().map((product, i) => {
    const stock = [0, 3, 4, 48, 120, 260, 15, 7][i % 8];
    return {
      ...product,
      /** Mock: the Product Master carries no offer-price column. */
      offerPrice: null as number | null,
      stock,
      lowStockThreshold: 10,
      hidden: i % 17 === 5,
      syncIssue: i % 29 === 7,
    };
  });
}

/**
 * Products the catalogue withheld — no approved photograph, or flagged data.
 * A real figure from the real report, not a mock number.
 */
export function withheldCount(): number {
  return getAllProductRecords().filter((product) => !product.publishable).length;
}

export type AdminProduct = ReturnType<typeof adminProducts>[number];
