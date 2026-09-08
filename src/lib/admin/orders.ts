import type {
  CancellationReason,
  Order,
  OrderEventKind,
  OrderStatus,
  PaymentMethod,
} from "./types";

/**
 * The order workflow, expressed the way staff experience it.
 *
 * CONFIRMED RULE: staff are never shown a status dropdown, and never see a raw
 * status value. They see where the order is in plain language, and exactly one
 * obvious next action. Everything in this file exists to keep that promise.
 */

/** What a member of staff reads. Never the raw value. */
const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New order",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  delivery_failed: "Delivery failed",
};

/** One line of context under the status, so the label is never ambiguous. */
const STATUS_HINT: Record<OrderStatus, string> = {
  new: "Nobody has looked at this order yet.",
  awaiting_confirmation: "We have contacted the customer and are waiting for them.",
  confirmed: "The customer confirmed. It has not been packed yet.",
  preparing: "Someone is packing this order now.",
  out_for_delivery: "On the way to the customer.",
  completed: "Delivered and paid.",
  cancelled: "This order will not be delivered.",
  delivery_failed: "Delivery was attempted and did not succeed.",
};

export type StatusTone = "attention" | "progress" | "done" | "problem";

const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  new: "attention",
  awaiting_confirmation: "attention",
  confirmed: "progress",
  preparing: "progress",
  out_for_delivery: "progress",
  completed: "done",
  cancelled: "problem",
  delivery_failed: "problem",
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

export function orderStatusHint(status: OrderStatus): string {
  return STATUS_HINT[status];
}

export function orderStatusTone(status: OrderStatus): StatusTone {
  return STATUS_TONE[status];
}

/**
 * The single next action for an order, or `null` when the order is finished and
 * nothing more should be done to it.
 */
export interface NextAction {
  /** The button label. This is the ONLY primary action shown. */
  label: string;
  /** What it will do, in plain language. */
  explanation: string;
  /** The status the order moves to. Internal — never rendered. */
  to: OrderStatus;
  /** Completing an order requires a payment to be recorded first. */
  requiresPayment: boolean;
}

export function nextAction(order: Order): NextAction | null {
  switch (order.status) {
    case "new":
    case "awaiting_confirmation":
      return {
        label: "Confirm Order",
        explanation: "The customer has agreed to the order and the delivery details.",
        to: "confirmed",
        requiresPayment: false,
      };
    case "confirmed":
      return {
        label: "Start Preparing",
        explanation: "Someone is packing the items now.",
        to: "preparing",
        requiresPayment: false,
      };
    case "preparing":
      return {
        label: "Send Out for Delivery",
        explanation: "The order has left the shop and is on its way.",
        to: "out_for_delivery",
        requiresPayment: false,
      };
    case "out_for_delivery":
      return {
        label: "Complete Order",
        explanation: "The customer has the order. You will record the payment first.",
        to: "completed",
        requiresPayment: true,
      };
    default:
      return null;
  }
}

/** A failed delivery only makes sense once the order has left the shop. */
export function canMarkDeliveryFailed(order: Order): boolean {
  return order.status === "out_for_delivery";
}

/** Cancelling is possible until the order is finished one way or another. */
export function canCancel(order: Order): boolean {
  return !["completed", "cancelled", "delivery_failed"].includes(order.status);
}

export const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: "customer_changed_mind", label: "Customer changed mind" },
  { value: "customer_unreachable", label: "Customer unreachable" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "outside_delivery_area", label: "Outside delivery area" },
  { value: "duplicate_order", label: "Duplicate order" },
  { value: "pricing_error", label: "Pricing error" },
  { value: "suspected_fraud", label: "Suspected fraud" },
  { value: "other", label: "Other" },
];

export function cancellationReasonLabel(reason: CancellationReason): string {
  return CANCELLATION_REASONS.find((r) => r.value === reason)?.label ?? "Other";
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  digital: "Digital",
};

/**
 * A digital payment must carry a reference. This is the whole payment gate, in
 * one place, so the rule cannot drift between screens.
 */
export function paymentIsComplete(method: PaymentMethod | null, reference: string): boolean {
  if (method === null) return false;
  if (method === "cash") return true;
  return reference.trim().length > 0;
}

/** The stages every order walks through, for the timeline. */
export const TIMELINE_STAGES: { kind: OrderEventKind; label: string }[] = [
  { kind: "received", label: "Order received" },
  { kind: "confirmed", label: "Confirmed" },
  { kind: "preparing", label: "Preparing" },
  { kind: "out_for_delivery", label: "Out for delivery" },
  { kind: "completed", label: "Completed" },
];

/** Filters offered above the orders list, in the order staff think about them. */
export type OrderFilter = "all" | "new" | "confirm" | "preparing" | "delivery" | "completed" | "issues";

export const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "confirm", label: "Confirm" },
  { value: "preparing", label: "Preparing" },
  { value: "delivery", label: "Delivery" },
  { value: "completed", label: "Completed" },
  { value: "issues", label: "Issues" },
];

const FILTER_STATUSES: Record<OrderFilter, OrderStatus[] | null> = {
  all: null,
  new: ["new"],
  confirm: ["awaiting_confirmation"],
  preparing: ["confirmed", "preparing"],
  delivery: ["out_for_delivery"],
  completed: ["completed"],
  issues: ["cancelled", "delivery_failed"],
};

export function matchesFilter(order: Order, filter: OrderFilter): boolean {
  const statuses = FILTER_STATUSES[filter];
  return statuses === null || statuses.includes(order.status);
}

/** Order number, customer name or phone. Digits are compared loosely. */
export function matchesSearch(order: Order, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const phoneDigits = order.customerPhone.replace(/\D/g, "");
  return (
    order.id.toLowerCase().includes(q) ||
    order.customerName.toLowerCase().includes(q) ||
    (digits.length >= 3 && phoneDigits.includes(digits))
  );
}

export function itemCount(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}
