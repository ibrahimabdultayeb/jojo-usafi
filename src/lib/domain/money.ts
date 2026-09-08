/**
 * Money.
 *
 * Every amount in Jojo Usafi is an INTEGER number of Tanzanian shillings.
 * There are no cents in TZS pricing here, and floating point would eventually
 * put "TSh 33,999.999999" on an order. The database enforces the same thing:
 * every money column is `integer` and constrained non-negative.
 *
 * Display lives in `src/lib/format.ts` (`formatPrice`). This module owns
 * validation and arithmetic only, so there is one definition of each.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";

/** PostgreSQL `integer`. Exceeding it is a data error, not a large order. */
export const MAX_MONEY_TZS = 2_147_483_647;

/** The currency Jojo Usafi trades in. Tanzania only, for now and by decision. */
export const CURRENCY_CODE = "TZS" as const;

export const moneyTzsSchema = z
  .number({ message: "Enter an amount in shillings." })
  .int({ message: "Amounts are whole shillings — no decimals." })
  .min(0, { message: "An amount cannot be negative." })
  .max(MAX_MONEY_TZS, { message: "That amount is too large to be real." });

export type MoneyTzs = number;

export function isMoneyTzs(value: unknown): value is MoneyTzs {
  return moneyTzsSchema.safeParse(value).success;
}

export function parseMoneyTzs(value: unknown): Result<MoneyTzs> {
  const parsed = moneyTzsSchema.safeParse(value);
  if (!parsed.success) {
    return err("invalid_money", parsed.error.issues[0]?.message ?? "That is not a valid amount.");
  }
  return ok(parsed.data);
}

/**
 * Read an amount a human typed: "34,000", " 34000 ", "TSh 34,000".
 * Rejects decimals rather than rounding them, because silently turning 34000.5
 * into 34001 is how a price becomes wrong.
 */
export function parseMoneyInput(input: string): Result<MoneyTzs> {
  const cleaned = input.replace(/[\s,]/g, "").replace(/^(TSh|TZS)/i, "");
  if (cleaned === "") return err("invalid_money", "Enter an amount in shillings.");
  if (!/^-?\d+$/.test(cleaned)) {
    return err("invalid_money", "Amounts are whole shillings — no decimals or symbols.");
  }
  return parseMoneyTzs(Number(cleaned));
}

/** quantity x unit price, with the overflow guard the database also applies. */
export function lineTotalTzs(unitPriceTzs: MoneyTzs, quantity: number): Result<MoneyTzs> {
  const price = parseMoneyTzs(unitPriceTzs);
  if (!price.ok) return price;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return err("invalid_quantity", "Quantity must be at least 1.");
  }
  return parseMoneyTzs(price.value * quantity);
}

export interface OrderTotalsInput {
  readonly subtotalTzs: MoneyTzs;
  readonly discountTzs: MoneyTzs;
  readonly deliveryFeeTzs: MoneyTzs;
}

/**
 * The one definition of an order total:
 *
 *     total = subtotal - discount + delivery fee
 *
 * The same arithmetic is a CHECK constraint on `orders`, so a total that
 * disagrees with its parts cannot be stored even by a direct SQL write.
 */
export function orderTotalTzs(input: OrderTotalsInput): Result<MoneyTzs> {
  for (const amount of [input.subtotalTzs, input.discountTzs, input.deliveryFeeTzs]) {
    const parsed = parseMoneyTzs(amount);
    if (!parsed.ok) return parsed;
  }
  if (input.discountTzs > input.subtotalTzs) {
    return err("invalid_money", "A discount cannot be larger than the order itself.");
  }
  return parseMoneyTzs(input.subtotalTzs - input.discountTzs + input.deliveryFeeTzs);
}

/** Sum of line totals. Returns 0 for an empty cart, which is a valid subtotal. */
export function subtotalTzs(lineTotals: readonly MoneyTzs[]): Result<MoneyTzs> {
  let total = 0;
  for (const line of lineTotals) {
    const parsed = parseMoneyTzs(line);
    if (!parsed.ok) return parsed;
    total += parsed.value;
  }
  return parseMoneyTzs(total);
}

/**
 * What the customer actually pays for one unit: the offer price when there is
 * one, otherwise the price. An offer must be strictly below the price, which is
 * also a CHECK constraint on `products`.
 */
export function effectivePriceTzs(priceTzs: MoneyTzs, offerPriceTzs: MoneyTzs | null): Result<MoneyTzs> {
  const price = parseMoneyTzs(priceTzs);
  if (!price.ok) return price;
  if (offerPriceTzs === null || offerPriceTzs === undefined) return price;

  const offer = parseMoneyTzs(offerPriceTzs);
  if (!offer.ok) return offer;
  if (offer.value >= price.value) {
    return err("invalid_money", "An offer price must be lower than the normal price.");
  }
  return offer;
}
