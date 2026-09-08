import { describe, expect, it } from "vitest";
import {
  MAX_MONEY_TZS,
  effectivePriceTzs,
  isMoneyTzs,
  lineTotalTzs,
  orderTotalTzs,
  parseMoneyInput,
  parseMoneyTzs,
  subtotalTzs,
} from "./money";
import { unwrap } from "./result";

describe("money", () => {
  it("is whole shillings only", () => {
    expect(isMoneyTzs(34000)).toBe(true);
    expect(isMoneyTzs(0)).toBe(true);
    expect(isMoneyTzs(34000.5)).toBe(false);
    expect(isMoneyTzs(-1)).toBe(false);
    expect(isMoneyTzs("34000")).toBe(false);
    expect(isMoneyTzs(NaN)).toBe(false);
    expect(isMoneyTzs(Infinity)).toBe(false);
  });

  it("stops at what a PostgreSQL integer column can hold", () => {
    expect(isMoneyTzs(MAX_MONEY_TZS)).toBe(true);
    expect(isMoneyTzs(MAX_MONEY_TZS + 1)).toBe(false);
  });

  it("reads what a person types, including the separators they use", () => {
    expect(unwrap(parseMoneyInput("34,000"))).toBe(34000);
    expect(unwrap(parseMoneyInput(" 34000 "))).toBe(34000);
    expect(unwrap(parseMoneyInput("TSh 34,000"))).toBe(34000);
  });

  it("refuses a decimal rather than rounding it", () => {
    const parsed = parseMoneyInput("34000.50");
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.code).toBe("invalid_money");
  });

  it("refuses an empty or non-numeric amount", () => {
    expect(parseMoneyInput("").ok).toBe(false);
    expect(parseMoneyInput("free").ok).toBe(false);
    expect(parseMoneyTzs(undefined).ok).toBe(false);
  });

  it("multiplies a line the same way the database CHECK does", () => {
    expect(unwrap(lineTotalTzs(4000, 2))).toBe(8000);
    expect(unwrap(lineTotalTzs(9500, 4))).toBe(38000);
  });

  it("refuses a line with no quantity", () => {
    expect(lineTotalTzs(4000, 0).ok).toBe(false);
    expect(lineTotalTzs(4000, -1).ok).toBe(false);
    expect(lineTotalTzs(4000, 1.5).ok).toBe(false);
  });

  it("adds an order up as subtotal - discount + delivery", () => {
    const subtotal = unwrap(subtotalTzs([34000, 8000]));
    expect(subtotal).toBe(42000);
    expect(unwrap(orderTotalTzs({ subtotalTzs: subtotal, discountTzs: 0, deliveryFeeTzs: 4000 }))).toBe(46000);
    expect(unwrap(orderTotalTzs({ subtotalTzs: subtotal, discountTzs: 2000, deliveryFeeTzs: 0 }))).toBe(40000);
  });

  it("treats an empty cart as a subtotal of zero, not an error", () => {
    expect(unwrap(subtotalTzs([]))).toBe(0);
  });

  it("refuses a discount larger than the order", () => {
    const total = orderTotalTzs({ subtotalTzs: 10000, discountTzs: 12000, deliveryFeeTzs: 0 });
    expect(total.ok).toBe(false);
    expect(total.ok === false && total.reason).toMatch(/larger than the order/i);
  });

  it("charges the offer price when there is one", () => {
    expect(unwrap(effectivePriceTzs(34000, 29000))).toBe(29000);
    expect(unwrap(effectivePriceTzs(34000, null))).toBe(34000);
  });

  it("refuses an offer that is not actually an offer", () => {
    expect(effectivePriceTzs(34000, 34000).ok).toBe(false);
    expect(effectivePriceTzs(34000, 39000).ok).toBe(false);
  });
});
