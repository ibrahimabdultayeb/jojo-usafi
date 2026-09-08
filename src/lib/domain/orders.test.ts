import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  NEXT_ACTION,
  ORDER_STATES,
  STATE_LABEL,
  applyTransition,
  canTransition,
  computeOrderTotals,
  isOrderNumber,
  isTerminal,
  parseOrderDraft,
  recordPayment,
  unpaid,
  validatePaymentState,
  type OrderDraft,
  type OrderState,
  type PaymentState,
} from "./orders";
import { unwrap } from "./result";

const PAID_CASH: PaymentState = {
  preference: "cash_on_delivery",
  status: "paid",
  method: "cash",
  reference: null,
  paidAt: "2026-09-09T10:00:00.000Z",
};

const UNPAID = unpaid("cash_on_delivery");

describe("order states", () => {
  it("has a label for every state, and never shows the internal name", () => {
    for (const state of ORDER_STATES) {
      expect(STATE_LABEL[state]).toBeTruthy();
      expect(STATE_LABEL[state]).not.toContain("_");
    }
  });

  it("has a transition list for every state", () => {
    for (const state of ORDER_STATES) {
      expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("never points anywhere that is not a real state", () => {
    for (const state of ORDER_STATES) {
      for (const target of ALLOWED_TRANSITIONS[state]) {
        expect(ORDER_STATES).toContain(target);
      }
    }
  });

  it("never offers a state as its own next step", () => {
    for (const state of ORDER_STATES) {
      expect(ALLOWED_TRANSITIONS[state]).not.toContain(state);
    }
  });

  it("closes completed and cancelled orders for good", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(ALLOWED_TRANSITIONS.completed).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it("leaves a failed delivery live, because it is usually retried", () => {
    expect(isTerminal("delivery_failed")).toBe(false);
    expect(canTransition("delivery_failed", "out_for_delivery")).toBe(true);
  });

  it("walks the ordinary path a real order takes", () => {
    const path: OrderState[] = ["new", "confirmed", "preparing", "out_for_delivery", "completed"];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it("refuses to skip the shop", () => {
    expect(canTransition("new", "out_for_delivery")).toBe(false);
    expect(canTransition("confirmed", "completed")).toBe(false);
    expect(canTransition("new", "completed")).toBe(false);
  });

  it("refuses to go backwards", () => {
    expect(canTransition("out_for_delivery", "preparing")).toBe(false);
    expect(canTransition("completed", "preparing")).toBe(false);
  });

  it("only suggests a next action that is actually allowed", () => {
    for (const [state, action] of Object.entries(NEXT_ACTION)) {
      if (!action) continue;
      expect(canTransition(state as OrderState, action.becomes), state).toBe(true);
    }
  });

  it("suggests nothing where the answer is a genuine question", () => {
    expect(NEXT_ACTION.out_for_delivery).toBeUndefined();
    expect(NEXT_ACTION.completed).toBeUndefined();
    expect(NEXT_ACTION.cancelled).toBeUndefined();
  });
});

describe("transitions", () => {
  it("moves an order and describes what happened", () => {
    const result = applyTransition({ from: "new", to: "confirmed", payment: UNPAID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("confirmed");
    expect(result.value.event.kind).toBe("state_changed");
    expect(result.value.event.summary).toBe("New order → Confirmed");
  });

  it("refuses an impossible move in plain language", () => {
    const result = applyTransition({ from: "new", to: "completed", payment: PAID_CASH });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("invalid_transition");
    expect(result.ok === false && result.reason).toMatch(/cannot go from new order to completed/i);
  });

  it("refuses to change an order that is already finished", () => {
    const result = applyTransition({ from: "completed", to: "preparing", payment: PAID_CASH });
    expect(result.ok === false && result.reason).toMatch(/cannot be changed/i);
  });

  it("says so when nothing would change", () => {
    const result = applyTransition({ from: "preparing", to: "preparing", payment: UNPAID });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/already/i);
  });

  it("will not complete an order that has not been paid for", () => {
    const result = applyTransition({ from: "out_for_delivery", to: "completed", payment: UNPAID });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("payment_required");
  });

  it("completes an order once the money is recorded", () => {
    const result = applyTransition({ from: "out_for_delivery", to: "completed", payment: PAID_CASH });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.consumesStock).toBe(true);
  });

  it("insists on a reason before cancelling", () => {
    const without = applyTransition({ from: "confirmed", to: "cancelled", payment: UNPAID });
    expect(without.ok).toBe(false);
    expect(without.ok === false && without.code).toBe("reason_required");

    const with_ = applyTransition({
      from: "confirmed",
      to: "cancelled",
      payment: UNPAID,
      reason: "Customer changed mind",
    });
    expect(with_.ok).toBe(true);
    expect(with_.ok && with_.value.releasesStock).toBe(true);
    expect(with_.ok && with_.value.event.summary).toBe("Cancelled — Customer changed mind");
  });

  it("insists on a reason before recording a failed delivery", () => {
    expect(applyTransition({ from: "out_for_delivery", to: "delivery_failed", payment: UNPAID }).ok).toBe(false);
    const result = applyTransition({
      from: "out_for_delivery",
      to: "delivery_failed",
      payment: UNPAID,
      reason: "Nobody at the address",
    });
    expect(result.ok).toBe(true);
    // The goods come back to the store, but the order is still live, so nothing
    // is released until somebody actually cancels it.
    expect(result.ok && result.value.releasesStock).toBe(false);
  });

  it("treats whitespace as no reason at all", () => {
    const result = applyTransition({ from: "confirmed", to: "cancelled", payment: UNPAID, reason: "   " });
    expect(result.ok).toBe(false);
  });
});

describe("payment", () => {
  it("accepts an untouched unpaid order", () => {
    expect(validatePaymentState(UNPAID).ok).toBe(true);
  });

  it("refuses an unpaid order carrying payment details", () => {
    const result = validatePaymentState({ ...UNPAID, method: "cash" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("payment_invalid");
  });

  it("refuses a paid order that does not say how", () => {
    expect(validatePaymentState({ ...PAID_CASH, method: null }).ok).toBe(false);
  });

  it("refuses a paid order that does not say when", () => {
    expect(validatePaymentState({ ...PAID_CASH, paidAt: null }).ok).toBe(false);
  });

  it("insists a digital payment has a transaction reference", () => {
    const result = validatePaymentState({ ...PAID_CASH, method: "digital", reference: null });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/transaction reference/i);
    expect(validatePaymentState({ ...PAID_CASH, method: "digital", reference: "  " }).ok).toBe(false);
    expect(
      validatePaymentState({ ...PAID_CASH, method: "digital", reference: "M-Pesa QK4RT77J21" }).ok,
    ).toBe(true);
  });

  it("asks nothing extra of a cash payment", () => {
    expect(validatePaymentState(PAID_CASH).ok).toBe(true);
  });

  it("lets a customer pay differently from how they said they would", () => {
    const preferred = unpaid("cash_on_delivery");
    const paid = recordPayment(preferred, {
      method: "digital",
      reference: "M-Pesa QK4RT77J21",
      at: "2026-09-09T10:00:00.000Z",
    });
    expect(paid.ok).toBe(true);
    // The preference is history and is not rewritten to match.
    expect(paid.ok && paid.value.preference).toBe("cash_on_delivery");
    expect(paid.ok && paid.value.method).toBe("digital");
  });

  it("refuses a digital payment recorded without its reference", () => {
    const result = recordPayment(unpaid("digital_on_delivery"), {
      method: "digital",
      at: "2026-09-09T10:00:00.000Z",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses to record payment twice", () => {
    const result = recordPayment(PAID_CASH, { method: "cash", at: "2026-09-09T11:00:00.000Z" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/already/i);
  });
});

/* ------------------------------------------------------------- order drafts */

const draft = (overrides: Partial<OrderDraft> = {}): unknown => ({
  customerName: "Hassan Ali",
  customerPhone: "0712 884 210",
  customerEmail: null,
  deliveryZoneName: "Upanga",
  deliveryAddress: "Ocean Road, near Aga Khan Hospital",
  deliveryLandmark: null,
  deliveryFeeTzs: 4000,
  discountTzs: 0,
  paymentPreference: "cash_on_delivery",
  locale: "en",
  customerNote: null,
  lines: [
    {
      sku: "EP01-A02",
      productName: "Multix Multipurpose Detergent Lemon Fresh",
      variantLabel: null,
      packSizeLabel: "5LT",
      quantity: 1,
      unitPriceTzs: 34000,
      lineTotalTzs: 34000,
    },
    {
      sku: "EP09-A07",
      productName: "Softi Handwash Aloevera",
      variantLabel: null,
      packSizeLabel: "500ML",
      quantity: 2,
      unitPriceTzs: 4000,
      lineTotalTzs: 8000,
    },
  ],
  ...overrides,
});

describe("order drafts", () => {
  it("accepts a real checkout and normalises the phone number on the way through", () => {
    const parsed = parseOrderDraft(draft());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.draft.customerPhone).toBe("+255712884210");
    expect(parsed.value.totals).toEqual({
      subtotalTzs: 42000,
      discountTzs: 0,
      deliveryFeeTzs: 4000,
      totalTzs: 46000,
    });
  });

  it("recomputes the money instead of trusting the browser", () => {
    const tampered = draft({
      lines: [
        {
          sku: "EP01-A02",
          productName: "Multix Multipurpose Detergent Lemon Fresh",
          variantLabel: null,
          packSizeLabel: "5LT",
          quantity: 2,
          unitPriceTzs: 34000,
          lineTotalTzs: 1, // what a tampered client would send
        },
      ],
    } as Partial<OrderDraft>);
    const parsed = parseOrderDraft(tampered);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.reason).toMatch(/EP01-A02/);
  });

  it("refuses an empty cart", () => {
    expect(parseOrderDraft(draft({ lines: [] } as Partial<OrderDraft>)).ok).toBe(false);
  });

  it("refuses a checkout with no usable phone number", () => {
    expect(parseOrderDraft(draft({ customerPhone: "0812884210" } as Partial<OrderDraft>)).ok).toBe(false);
  });

  it("refuses a checkout with no address", () => {
    expect(parseOrderDraft(draft({ deliveryAddress: "" } as Partial<OrderDraft>)).ok).toBe(false);
  });

  it("carries a free-delivery zone through as a zero fee", () => {
    const parsed = parseOrderDraft(draft({ deliveryFeeTzs: 0 } as Partial<OrderDraft>));
    expect(parsed.ok && parsed.value.totals.totalTzs).toBe(42000);
  });

  it("subtracts a discount before adding delivery", () => {
    const parsed = parseOrderDraft(draft({ discountTzs: 2000 } as Partial<OrderDraft>));
    expect(parsed.ok && parsed.value.totals.totalTzs).toBe(44000);
  });

  it("computes the same totals when handed an already-valid draft", () => {
    const parsed = parseOrderDraft(draft());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(unwrap(computeOrderTotals(parsed.value.draft))).toEqual(parsed.value.totals);
  });
});

describe("public order numbers", () => {
  it("recognises the form customers quote", () => {
    expect(isOrderNumber("JU-000128")).toBe(true);
    expect(isOrderNumber("JU-1000128")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["000128", "JU-128", "ju-000128", "JU_000128", ""]) {
      expect(isOrderNumber(bad), bad).toBe(false);
    }
  });
});
