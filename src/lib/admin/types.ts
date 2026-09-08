/**
 * Admin domain types.
 *
 * These describe the shapes the admin UI works with. They are deliberately
 * close to the tables Supabase will hold, so the prototype's screens survive
 * the backend landing — but nothing here talks to a backend today.
 *
 * Raw status values NEVER reach the screen. Every one of them is translated
 * through `orderStatusLabel()` before a member of staff sees it.
 */

/** Where an order is in its life. Internal vocabulary only. */
export type OrderStatus =
  | "new"
  | "awaiting_confirmation"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "delivery_failed";

export type PaymentMethod = "cash" | "digital";

/** How the customer said they intend to pay when they ordered. */
export type PaymentPreference = PaymentMethod;

/**
 * What was actually taken, recorded when an order is completed. An order cannot
 * be completed without one — see the payment gate in `NextActionPanel`.
 */
export interface RecordedPayment {
  method: PaymentMethod;
  /** Required for digital payments. Never required for cash. */
  reference?: string;
  recordedAt: string;
}

export type CancellationReason =
  | "customer_changed_mind"
  | "customer_unreachable"
  | "out_of_stock"
  | "outside_delivery_area"
  | "duplicate_order"
  | "pricing_error"
  | "suspected_fraud"
  | "other";

export interface OrderLine {
  sku: string;
  name: string;
  packSize: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type OrderEventKind =
  | "received"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "delivery_failed";

export interface OrderEvent {
  kind: OrderEventKind;
  /** Already formatted for display — the prototype holds no live clock. */
  at: string;
  /** Optional plain-language detail, e.g. who did it or why. */
  note?: string;
}

/**
 * A UI state only. There is no synchronisation running anywhere in this build;
 * these show what the eventual Google Sheet ↔ Supabase sync will report.
 */
export type SyncState = "saved" | "syncing" | "pending" | "issue";

export interface Order {
  /** The customer-facing order number, e.g. "JU-000123". */
  id: string;
  placedAt: string;
  /** Sortable key. The prototype has no live clock, so ordering is explicit. */
  placedOrder: number;

  customerId: string;
  customerName: string;
  customerPhone: string;

  zoneId: string;
  zoneName: string;
  address: string;
  landmark: string;
  deliveryFee: number;

  lines: OrderLine[];
  subtotal: number;
  discount: number;
  total: number;

  paymentPreference: PaymentPreference;
  recordedPayment: RecordedPayment | null;

  status: OrderStatus;
  cancellationReason?: CancellationReason;
  cancellationNote?: string;
  /**
   * Answer to "Were the items returned?" after a failed delivery. `null` means
   * the question has not been answered — there is deliberately no default.
   */
  itemsReturned: boolean | null;

  timeline: OrderEvent[];
  syncState: SyncState;
}

export interface CustomerAddress {
  label: string;
  zoneName: string;
  line: string;
  landmark: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses: CustomerAddress[];
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string;
  lastOrderId: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  /** TZS. Ignored while `freeDelivery` is on. */
  fee: number;
  freeDelivery: boolean;
  active: boolean;
  /** Lower sorts first in the customer's zone picker. */
  sortPriority: number;
}

/** How a product looks to operations, as opposed to how it looks to a shopper. */
export type ProductAdminStatus = "active" | "hidden" | "archived";

export interface ProductAdminFlags {
  lowStock: boolean;
  outOfStock: boolean;
  hidden: boolean;
  missingImage: boolean;
  syncIssue: boolean;
}

/** Editable homepage content. Customer-facing strings carry both languages. */
export interface LocalisedText {
  en: string;
  sw: string;
}

export interface WebsiteContent {
  announcements: LocalisedText[];
  heroTitle: LocalisedText;
  heroSubtitle: LocalisedText;
  promoBanner: {
    enabled: boolean;
    text: LocalisedText;
  };
  featuredSkus: string[];
  bestSellerSkus: string[];
  categoryOrder: string[];
  sections: { id: string; label: string; visible: boolean }[];
}
