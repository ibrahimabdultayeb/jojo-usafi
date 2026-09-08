/**
 * Order states, transitions and payment rules.
 *
 * The eight approved states are internal vocabulary. Staff never see them —
 * `STATE_LABEL` is what appears on screen, and the admin dashboard shows one
 * obvious next action rather than a dropdown of raw values.
 *
 * The transition table is the single definition of "what can happen next". The
 * database enforces the facts that must never be wrong regardless of which code
 * path wrote the row (a completed order is paid, a cancellation has a reason);
 * the sequencing lives here, because a sequence needs to know where the order
 * came from and the current row does not remember that.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";
import { lineTotalTzs, orderTotalTzs, subtotalTzs, type MoneyTzs } from "./money";
import { skuSchema } from "./sku";
import { tanzanianPhoneSchema } from "./phone";
import { quantitySchema } from "./inventory";

/* ------------------------------------------------------------------ states */

export const ORDER_STATES = [
  "new",
  "awaiting_confirmation",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
  "delivery_failed",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const orderStateSchema = z.enum(ORDER_STATES);

/** Plain language. The internal name is never shown to an operator. */
export const STATE_LABEL: Record<OrderState, string> = {
  new: "New order",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  delivery_failed: "Delivery failed",
};

/** No further movement is possible. */
export const TERMINAL_STATES: readonly OrderState[] = ["completed", "cancelled"];

export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * What may follow what.
 *
 * `delivery_failed` is not terminal: a failed delivery is usually retried, and
 * the order goes back out. That, and the choice to allow cancellation at every
 * stage before dispatch, are the two judgement calls in this table — both are
 * recorded in docs/BUSINESS_RULES.md for Ibrahim to confirm.
 */
export const ALLOWED_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  new: ["awaiting_confirmation", "confirmed", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["completed", "delivery_failed"],
  delivery_failed: ["out_for_delivery", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * The single obvious thing to do next, for the big button on an order card.
 * States with a genuine choice (out for delivery: did it arrive or not?) have
 * none, so the dashboard asks rather than guessing.
 */
export const NEXT_ACTION: Partial<Record<OrderState, { label: string; becomes: OrderState }>> = {
  new: { label: "Confirm order", becomes: "confirmed" },
  awaiting_confirmation: { label: "Confirm order", becomes: "confirmed" },
  confirmed: { label: "Start preparing", becomes: "preparing" },
  preparing: { label: "Send out for delivery", becomes: "out_for_delivery" },
  delivery_failed: { label: "Send out again", becomes: "out_for_delivery" },
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/* ----------------------------------------------------------------- payment */

export const PAYMENT_PREFERENCES = ["cash_on_delivery", "digital_on_delivery"] as const;
export type PaymentPreference = (typeof PAYMENT_PREFERENCES)[number];

export const PAYMENT_METHODS = ["cash", "digital"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PREFERENCE_LABEL: Record<PaymentPreference, string> = {
  cash_on_delivery: "Cash on delivery",
  digital_on_delivery: "Pay digitally on delivery",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  digital: "Digital",
};

/**
 * What the customer intends, and separately what actually happened. A customer
 * may choose cash and then pay by mobile money at the door; recording the truth
 * must not require pretending the preference was different.
 */
export interface PaymentState {
  readonly preference: PaymentPreference;
  readonly status: PaymentStatus;
  readonly method: PaymentMethod | null;
  readonly reference: string | null;
  readonly paidAt: string | null;
}

/**
 * The TypeScript twin of the four payment CHECK constraints on `orders`.
 * Kept in one function so the schema and the application cannot drift.
 */
export function validatePaymentState(payment: PaymentState): Result<PaymentState> {
  if (payment.status === "unpaid") {
    if (payment.method !== null || payment.reference !== null || payment.paidAt !== null) {
      return err("payment_invalid", "This order is marked unpaid but has payment details recorded.");
    }
    return ok(payment);
  }

  if (payment.method === null) {
    return err("payment_invalid", "Say how the payment was received — cash or digital.");
  }
  if (payment.paidAt === null) {
    return err("payment_invalid", "Record when the payment was received.");
  }
  if (payment.method === "digital" && !payment.reference?.trim()) {
    return err("payment_invalid", "A digital payment needs its transaction reference.");
  }
  return ok(payment);
}

export function unpaid(preference: PaymentPreference): PaymentState {
  return { preference, status: "unpaid", method: null, reference: null, paidAt: null };
}

/**
 * Record money received. Cash needs no reference; digital does, because without
 * one there is nothing to check against the mobile money statement.
 */
export function recordPayment(
  payment: PaymentState,
  received: { method: PaymentMethod; reference?: string | null; at: string },
): Result<PaymentState> {
  if (payment.status === "paid") {
    return err("payment_invalid", "Payment has already been recorded for this order.");
  }
  const next: PaymentState = {
    preference: payment.preference,
    status: "paid",
    method: received.method,
    reference: received.reference?.trim() ? received.reference.trim() : null,
    paidAt: received.at,
  };
  return validatePaymentState(next);
}

export function isPaid(payment: PaymentState): boolean {
  return payment.status === "paid";
}

/* -------------------------------------------------------------- transitions */

export interface TransitionInput {
  readonly from: OrderState;
  readonly to: OrderState;
  readonly payment: PaymentState;
  /** Required when cancelling or recording a failed delivery. */
  readonly reason?: string | null;
  readonly at?: string;
}

export interface TransitionOutcome {
  readonly state: OrderState;
  /** The append-only row this transition must also write. */
  readonly event: {
    readonly kind: "state_changed" | "cancelled" | "delivery_failed";
    readonly fromState: OrderState;
    readonly toState: OrderState;
    readonly summary: string;
  };
  /** True when stock reserved for this order should be released. */
  readonly releasesStock: boolean;
  /** True when the reserved stock has now physically left the store. */
  readonly consumesStock: boolean;
}

/**
 * May this order move, and what else must happen if it does.
 *
 * The stock consequences are returned rather than performed: reserving and
 * releasing under concurrent checkouts is a transaction, and transactions are
 * Build 06's job. This function decides; that build acts.
 */
export function applyTransition(input: TransitionInput): Result<TransitionOutcome> {
  const { from, to } = input;

  if (from === to) {
    return err("invalid_transition", `This order is already ${STATE_LABEL[to].toLowerCase()}.`);
  }
  if (isTerminal(from)) {
    return err(
      "invalid_transition",
      `A ${STATE_LABEL[from].toLowerCase()} order cannot be changed.`,
    );
  }
  if (!canTransition(from, to)) {
    return err(
      "invalid_transition",
      `An order cannot go from ${STATE_LABEL[from].toLowerCase()} to ${STATE_LABEL[to].toLowerCase()}.`,
    );
  }

  const reason = input.reason?.trim() ?? "";

  if (to === "cancelled" && reason === "") {
    return err("reason_required", "Choose why the order is being cancelled.");
  }
  if (to === "delivery_failed" && reason === "") {
    return err("reason_required", "Choose why the delivery did not succeed.");
  }

  // The rule the database also enforces: money first, completion second.
  if (to === "completed" && !isPaid(input.payment)) {
    return err("payment_required", "Record the payment before completing this order.");
  }
  if (to === "completed") {
    const valid = validatePaymentState(input.payment);
    if (!valid.ok) return valid;
  }

  const kind =
    to === "cancelled" ? "cancelled" : to === "delivery_failed" ? "delivery_failed" : "state_changed";

  return ok({
    state: to,
    event: {
      kind,
      fromState: from,
      toState: to,
      summary:
        kind === "state_changed"
          ? `${STATE_LABEL[from]} → ${STATE_LABEL[to]}`
          : `${STATE_LABEL[to]} — ${reason}`,
    },
    // Cancelling frees whatever was promised; a failed delivery brings the goods
    // back into the store but the order is still live, so nothing is released.
    releasesStock: to === "cancelled",
    consumesStock: to === "completed",
  });
}

/** Which states an operator may move this order to right now. */
export function availableTransitions(state: OrderState): readonly OrderState[] {
  return ALLOWED_TRANSITIONS[state];
}

/* ---------------------------------------------------------------- an order */

/**
 * What checkout must produce. Everything customer-visible is snapshotted, so
 * the order still reads correctly after the catalogue changes.
 */
export const orderLineSchema = z.object({
  sku: skuSchema,
  productName: z.string().trim().min(1, { message: "An order line needs a product name." }),
  variantLabel: z.string().trim().nullable().default(null),
  packSizeLabel: z.string().trim().nullable().default(null),
  quantity: quantitySchema,
  unitPriceTzs: z.number().int().min(0),
  lineTotalTzs: z.number().int().min(0),
});

export type OrderLineInput = z.infer<typeof orderLineSchema>;

export const orderDraftSchema = z.object({
  customerName: z
    .string({ message: "Enter the customer's name." })
    .trim()
    .min(2, { message: "Enter the customer's name." })
    .max(120, { message: "That name is too long." }),
  customerPhone: tanzanianPhoneSchema,
  customerEmail: z
    .string()
    .trim()
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: "That email address does not look right." })
    .nullable()
    .default(null),
  deliveryZoneName: z.string().trim().min(1, { message: "Choose a delivery area." }),
  deliveryAddress: z
    .string({ message: "Enter the delivery address." })
    .trim()
    .min(4, { message: "Enter the delivery address." }),
  deliveryLandmark: z.string().trim().nullable().default(null),
  deliveryFeeTzs: z.number().int().min(0),
  discountTzs: z.number().int().min(0).default(0),
  paymentPreference: z.enum(PAYMENT_PREFERENCES),
  locale: z.string().regex(/^[a-z]{2}$/),
  customerNote: z.string().trim().max(500).nullable().default(null),
  lines: z.array(orderLineSchema).min(1, { message: "The cart is empty." }),
});

export type OrderDraft = z.infer<typeof orderDraftSchema>;

export interface OrderTotals {
  readonly subtotalTzs: MoneyTzs;
  readonly discountTzs: MoneyTzs;
  readonly deliveryFeeTzs: MoneyTzs;
  readonly totalTzs: MoneyTzs;
}

/**
 * Recompute the money on a draft from its lines rather than trusting whatever
 * the browser sent. Line totals are recomputed too: a tampered `lineTotalTzs`
 * is exactly the kind of thing a checkout must not accept.
 */
export function computeOrderTotals(draft: OrderDraft): Result<OrderTotals> {
  const lineTotals: number[] = [];
  for (const line of draft.lines) {
    const total = lineTotalTzs(line.unitPriceTzs, line.quantity);
    if (!total.ok) return total;
    if (total.value !== line.lineTotalTzs) {
      return err("invalid_money", `The total for ${line.sku} does not match its price and quantity.`);
    }
    lineTotals.push(total.value);
  }

  const subtotal = subtotalTzs(lineTotals);
  if (!subtotal.ok) return subtotal;

  const total = orderTotalTzs({
    subtotalTzs: subtotal.value,
    discountTzs: draft.discountTzs,
    deliveryFeeTzs: draft.deliveryFeeTzs,
  });
  if (!total.ok) return total;

  return ok({
    subtotalTzs: subtotal.value,
    discountTzs: draft.discountTzs,
    deliveryFeeTzs: draft.deliveryFeeTzs,
    totalTzs: total.value,
  });
}

/** Validate a submitted checkout and return the draft with its money recomputed. */
export function parseOrderDraft(input: unknown): Result<{ draft: OrderDraft; totals: OrderTotals }> {
  const parsed = orderDraftSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err("invalid_order", issue?.message ?? "This order is not complete.");
  }
  const totals = computeOrderTotals(parsed.data);
  if (!totals.ok) return totals;
  return ok({ draft: parsed.data, totals: totals.value });
}

/** "JU-000128". Generated by the database; validated here when read back. */
export const ORDER_NUMBER_PATTERN = /^JU-\d{6,}$/;

export function isOrderNumber(value: unknown): value is string {
  return typeof value === "string" && ORDER_NUMBER_PATTERN.test(value);
}
