/**
 * Inventory arithmetic.
 *
 * Two numbers per SKU:
 *
 *   onHand    physically in the store
 *   reserved  physically present, already promised to an order
 *
 * available = onHand - reserved, always derived, never stored by a caller. The
 * database says the same thing: `inventory.available` is a stored generated
 * column and `reserved <= on_hand` is a CHECK constraint.
 *
 * Every change is a MOVEMENT, and movements are append-only. A mistake is
 * corrected by writing a compensating movement, not by editing history.
 *
 *   receipt              +onHand            stock arrived
 *   stock_count          ±onHand            a physical count, needs a reason
 *   correction           ±onHand            a human correction, needs a reason
 *   reservation                  +reserved  committed to an order
 *   reservation_release          -reserved  given back
 *   sale                 -onHand  -reserved order completed and left the store
 *   returned_delivery    +onHand            a failed delivery came back
 *   damage_loss          -onHand            breakage, spillage, expiry
 *
 * The functions here are PURE. They compute what a movement would do and refuse
 * the impossible. They do not talk to the database: applying a reservation
 * safely under concurrent checkouts needs a real transaction and real
 * concurrency testing, which is Build 06's job.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";

export const INVENTORY_MOVEMENT_KINDS = [
  "receipt",
  "stock_count",
  "correction",
  "reservation",
  "reservation_release",
  "sale",
  "returned_delivery",
  "damage_loss",
] as const;

export type InventoryMovementKind = (typeof INVENTORY_MOVEMENT_KINDS)[number];

/** Quantities are whole units. 999 matches the order-line CHECK constraint. */
export const MAX_LINE_QUANTITY = 999;

export const quantitySchema = z
  .number({ message: "Enter a quantity." })
  .int({ message: "Quantities are whole units." })
  .min(1, { message: "Quantity must be at least 1." })
  .max(MAX_LINE_QUANTITY, { message: `A single line cannot exceed ${MAX_LINE_QUANTITY} units.` });

/**
 * A stock movement is not an order line: a delivery from a supplier or an
 * annual count can legitimately move far more than 999 units. The ceiling
 * exists only to catch a mistyped figure.
 */
export const MAX_MOVEMENT_QUANTITY = 1_000_000;

export const movementQuantitySchema = z
  .number({ message: "Enter a number of units." })
  .int({ message: "Stock is counted in whole units." })
  .min(1, { message: "Enter at least 1 unit." })
  .max(MAX_MOVEMENT_QUANTITY, { message: "That is more units than the store could hold." });

export interface StockLevel {
  readonly onHand: number;
  readonly reserved: number;
}

export interface Movement {
  readonly kind: InventoryMovementKind;
  readonly onHandDelta: number;
  readonly reservedDelta: number;
  /** Required for corrections, counts and losses — see `reasonRequired`. */
  readonly reason?: string;
  /** Required for anything tied to an order. */
  readonly orderId?: string;
}

/** Kinds a human must explain. Mirrors inventory_movements_reason_required. */
const REASON_REQUIRED: ReadonlySet<InventoryMovementKind> = new Set([
  "correction",
  "stock_count",
  "damage_loss",
]);

/** Kinds that only exist because of an order. Mirrors the SQL constraint. */
const ORDER_REQUIRED: ReadonlySet<InventoryMovementKind> = new Set([
  "reservation",
  "reservation_release",
  "sale",
  "returned_delivery",
]);

/**
 * The shape each kind is allowed to have. This is the TypeScript twin of the
 * `inventory_movements_kind_shape` CHECK constraint, and the tests assert both
 * lists cover exactly the same kinds.
 */
const SHAPE: Record<InventoryMovementKind, (m: Movement) => boolean> = {
  receipt: (m) => m.onHandDelta > 0 && m.reservedDelta === 0,
  returned_delivery: (m) => m.onHandDelta > 0 && m.reservedDelta === 0,
  damage_loss: (m) => m.onHandDelta < 0 && m.reservedDelta === 0,
  stock_count: (m) => m.reservedDelta === 0,
  correction: (m) => m.reservedDelta === 0,
  reservation: (m) => m.onHandDelta === 0 && m.reservedDelta > 0,
  reservation_release: (m) => m.onHandDelta === 0 && m.reservedDelta < 0,
  sale: (m) => m.onHandDelta < 0 && m.reservedDelta < 0,
};

export function availableStock(level: StockLevel): number {
  return level.onHand - level.reserved;
}

export function isLowStock(level: StockLevel, threshold: number): boolean {
  const available = availableStock(level);
  return available > 0 && available <= threshold;
}

export function isInStock(level: StockLevel): boolean {
  return availableStock(level) > 0;
}

/** A stock level is only coherent if neither number is negative and a promise
 *  is never larger than the physical stock backing it. */
export function isValidStockLevel(level: StockLevel): boolean {
  return (
    Number.isInteger(level.onHand) &&
    Number.isInteger(level.reserved) &&
    level.onHand >= 0 &&
    level.reserved >= 0 &&
    level.reserved <= level.onHand
  );
}

/** Is this movement well-formed on its own, before considering stock levels? */
export function validateMovement(movement: Movement): Result<Movement> {
  if (!Number.isInteger(movement.onHandDelta) || !Number.isInteger(movement.reservedDelta)) {
    return err("invalid_movement", "Stock changes are whole units.");
  }
  if (movement.onHandDelta === 0 && movement.reservedDelta === 0) {
    return err("invalid_movement", "This stock change does nothing.");
  }
  if (!SHAPE[movement.kind](movement)) {
    return err("invalid_movement", "That stock change does not match what it claims to be.");
  }
  if (REASON_REQUIRED.has(movement.kind) && !movement.reason?.trim()) {
    return err("reason_required", "Say why the stock is being changed.");
  }
  if (ORDER_REQUIRED.has(movement.kind) && !movement.orderId) {
    return err("invalid_movement", "This stock change must belong to an order.");
  }
  return ok(movement);
}

/**
 * What the stock level becomes after this movement — or why it cannot happen.
 * Refuses every state the database would also refuse, so the admin sees a
 * sentence instead of a constraint violation.
 */
export function applyMovement(level: StockLevel, movement: Movement): Result<StockLevel> {
  if (!isValidStockLevel(level)) {
    return err("invalid_movement", "The current stock figures are not valid.");
  }
  const valid = validateMovement(movement);
  if (!valid.ok) return valid;

  const next: StockLevel = {
    onHand: level.onHand + movement.onHandDelta,
    reserved: level.reserved + movement.reservedDelta,
  };

  if (next.onHand < 0) {
    return err("insufficient_stock", "There is not enough stock in the store for that.");
  }
  if (next.reserved < 0) {
    return err("invalid_movement", "That would release more stock than is reserved.");
  }
  if (next.reserved > next.onHand) {
    return err(
      "insufficient_stock",
      "That would promise more stock than the store physically has.",
    );
  }
  return ok(next);
}

/** Replay a whole ledger. This is how `inventory` and the ledger are proved to
 *  agree — the same comparison the `inventory_ledger_check` view makes. */
export function replayMovements(movements: readonly Movement[]): Result<StockLevel> {
  let level: StockLevel = { onHand: 0, reserved: 0 };
  for (const movement of movements) {
    const next = applyMovement(level, movement);
    if (!next.ok) return next;
    level = next.value;
  }
  return ok(level);
}

/* ------------------------------------------------------------ constructors */

export function receipt(quantity: number, reference?: string): Result<Movement> {
  return buildMovement({ kind: "receipt", onHandDelta: quantity, reservedDelta: 0, reason: reference });
}

export function reserveForOrder(quantity: number, orderId: string): Result<Movement> {
  return buildMovement({ kind: "reservation", onHandDelta: 0, reservedDelta: quantity, orderId });
}

export function releaseReservation(quantity: number, orderId: string): Result<Movement> {
  return buildMovement({
    kind: "reservation_release",
    onHandDelta: 0,
    reservedDelta: -quantity,
    orderId,
  });
}

/** An order that left the store: the reservation clears and the stock goes. */
export function completeSale(quantity: number, orderId: string): Result<Movement> {
  return buildMovement({ kind: "sale", onHandDelta: -quantity, reservedDelta: -quantity, orderId });
}

export function returnFromFailedDelivery(quantity: number, orderId: string): Result<Movement> {
  return buildMovement({
    kind: "returned_delivery",
    onHandDelta: quantity,
    reservedDelta: 0,
    orderId,
  });
}

export function recordLoss(quantity: number, reason: string): Result<Movement> {
  return buildMovement({ kind: "damage_loss", onHandDelta: -quantity, reservedDelta: 0, reason });
}

/**
 * A physical count sets `onHand` to what was actually found, so the movement is
 * the difference. Counting the same figure that is already recorded is not a
 * movement at all, and says so.
 */
export function stockCount(level: StockLevel, countedOnHand: number, reason: string): Result<Movement> {
  if (!Number.isInteger(countedOnHand) || countedOnHand < 0) {
    return err("invalid_quantity", "Enter the number of units counted.");
  }
  const delta = countedOnHand - level.onHand;
  if (delta === 0) {
    return err("invalid_movement", "The count matches what is already recorded.");
  }
  return buildMovement({ kind: "stock_count", onHandDelta: delta, reservedDelta: 0, reason });
}

export function correction(delta: number, reason: string): Result<Movement> {
  if (!Number.isInteger(delta) || delta === 0) {
    return err("invalid_quantity", "Enter how many units to add or remove.");
  }
  return buildMovement({ kind: "correction", onHandDelta: delta, reservedDelta: 0, reason });
}

function buildMovement(movement: Movement): Result<Movement> {
  const magnitude = Math.abs(movement.onHandDelta || movement.reservedDelta);
  const quantity = movementQuantitySchema.safeParse(magnitude);
  if (!quantity.success) {
    return err("invalid_quantity", quantity.error.issues[0]?.message ?? "That quantity is not valid.");
  }
  return validateMovement(movement);
}
