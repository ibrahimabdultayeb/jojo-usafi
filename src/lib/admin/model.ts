/**
 * The admin dashboard's shared vocabulary and view-model.
 *
 * Everything here used to live in `src/mocks/admin/data.ts`, next to invented
 * orders and invented customers, because the screens were a prototype and there
 * was nothing else for them to read. Build 08C wired every operational screen
 * to the real database, so the invented rows are gone and what remains is not
 * mock at all: it is the shape the screens read and the words they say.
 *
 * Two rules hold this file together.
 *
 * ONE VOCABULARY. `state` in the database is `out_for_delivery`; an operator is
 * shown "Out for delivery". That translation happens once, here, so a stage
 * cannot be labelled one way on the orders list and another on the order.
 *
 * NO ARITHMETIC THAT THE DATABASE ALSO DOES. `orderTotals` re-adds the lines
 * for display, and that is the limit of it. Prices, delivery fees, reservation
 * maths and transition legality are decided by SQL functions and read back —
 * never recomputed here, because a second implementation is a second answer.
 */

/* ---------------------------------------------------------------- stages */

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

/**
 * The single obvious thing to do next, per stage. Terminal stages have none.
 *
 * This decides what the big green button SAYS. It does not decide whether the
 * move is allowed — `jojo_advance_order` does, and it refuses an illegal
 * transition whatever this table claims.
 */
export const NEXT_ACTION: Partial<Record<OrderStage, { label: string; becomes: OrderStage }>> = {
  new: { label: "Confirm order", becomes: "confirmed" },
  awaiting_confirmation: { label: "Confirm order", becomes: "confirmed" },
  confirmed: { label: "Start preparing", becomes: "preparing" },
  preparing: { label: "Send out for delivery", becomes: "out_for_delivery" },
  out_for_delivery: { label: "Complete order", becomes: "completed" },
};

/* --------------------------------------------------------------- reasons */

/**
 * Why an order ended badly. Offered as a fixed list rather than a text box so
 * the shop can count them later — free text cannot be counted, and a rider
 * standing in the rain will not type a sentence.
 */
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

/* ------------------------------------------------------------ view-model */

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

/** One order, in the shape every admin screen reads. Built in `orders.ts`. */
export interface AdminOrder {
  id: string;
  number: string;
  stage: OrderStage;
  placed: string;
  customer: { id: string; name: string; phone: string };
  delivery: { zone: string; address: string; fee: number; freeDelivery: boolean };
  lines: OrderLine[];
  payment: {
    preference: "Cash on delivery" | "Pay digitally on delivery";
    received: null | { method: string; reference?: string; amount: number };
  };
  note?: string;
}

/** The totals as displayed. The order's own `total_tzs` remains the record. */
export const orderTotals = (order: AdminOrder) => {
  const subtotal = order.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const delivery = order.delivery.freeDelivery ? 0 : order.delivery.fee;
  return {
    subtotal,
    delivery,
    total: subtotal + delivery,
    items: order.lines.reduce((n, l) => n + l.quantity, 0),
  };
};

/* -------------------------------------------------------- delivery zones */

/** The fee a brand-new zone starts on, until somebody changes it. */
export const DEFAULT_ZONE_FEE = 4000;

/* -------------------------------------------------------------- products */

/**
 * The admin product shape is the real catalogue row, not a copy of it.
 * Re-exported under the name the screens have always used.
 */
export type { AdminCatalogueProduct as AdminProduct } from "@/lib/catalogue/admin";
