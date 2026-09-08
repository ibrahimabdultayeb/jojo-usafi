import { describe, expect, it } from "vitest";
import {
  INVENTORY_MOVEMENT_KINDS,
  applyMovement,
  availableStock,
  completeSale,
  correction,
  isInStock,
  isLowStock,
  isValidStockLevel,
  receipt,
  recordLoss,
  releaseReservation,
  replayMovements,
  reserveForOrder,
  returnFromFailedDelivery,
  stockCount,
  validateMovement,
  type Movement,
  type StockLevel,
} from "./inventory";
import { unwrap } from "./result";

const ORDER = "order-1";
const level = (onHand: number, reserved: number): StockLevel => ({ onHand, reserved });

describe("available stock", () => {
  it("is on hand minus reserved, always", () => {
    expect(availableStock(level(10, 3))).toBe(7);
    expect(availableStock(level(10, 10))).toBe(0);
    expect(availableStock(level(0, 0))).toBe(0);
  });

  it("treats fully reserved stock as unavailable, not as in stock", () => {
    expect(isInStock(level(10, 10))).toBe(false);
    expect(isInStock(level(10, 9))).toBe(true);
  });

  it("warns on low stock only while there is still stock to sell", () => {
    expect(isLowStock(level(3, 0), 5)).toBe(true);
    expect(isLowStock(level(6, 0), 5)).toBe(false);
    expect(isLowStock(level(5, 5), 5)).toBe(false);
  });

  it("rejects a level that could not physically exist", () => {
    expect(isValidStockLevel(level(10, 3))).toBe(true);
    expect(isValidStockLevel(level(-1, 0))).toBe(false);
    expect(isValidStockLevel(level(10, -1))).toBe(false);
    expect(isValidStockLevel(level(3, 5))).toBe(false);
    expect(isValidStockLevel(level(1.5, 0))).toBe(false);
  });
});

describe("movements", () => {
  it("covers exactly the kinds the database enum covers", () => {
    // scripts/schema-check.mjs compares this list to the SQL enum as well; this
    // asserts every kind is actually implemented, not merely named.
    for (const kind of INVENTORY_MOVEMENT_KINDS) {
      const probe: Movement = {
        kind,
        onHandDelta: 1,
        reservedDelta: 0,
        reason: "probe",
        orderId: ORDER,
      };
      // Either it validates, or it is refused for its shape — never for being
      // an unknown kind.
      const result = validateMovement(probe);
      if (!result.ok) expect(result.code).toBe("invalid_movement");
    }
  });

  it("adds stock on a receipt", () => {
    const movement = unwrap(receipt(12, "supplier note 44"));
    expect(unwrap(applyMovement(level(0, 0), movement))).toEqual(level(12, 0));
  });

  it("reserves without touching physical stock", () => {
    const movement = unwrap(reserveForOrder(3, ORDER));
    expect(unwrap(applyMovement(level(10, 0), movement))).toEqual(level(10, 3));
  });

  it("refuses to promise stock the store does not have", () => {
    const movement = unwrap(reserveForOrder(11, ORDER));
    const result = applyMovement(level(10, 0), movement);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("insufficient_stock");
  });

  it("refuses to promise the same unit twice", () => {
    const movement = unwrap(reserveForOrder(1, ORDER));
    const result = applyMovement(level(5, 5), movement);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("insufficient_stock");
  });

  it("releases a reservation back", () => {
    const movement = unwrap(releaseReservation(3, ORDER));
    expect(unwrap(applyMovement(level(10, 3), movement))).toEqual(level(10, 0));
  });

  it("refuses to release more than is reserved", () => {
    const movement = unwrap(releaseReservation(4, ORDER));
    expect(applyMovement(level(10, 3), movement).ok).toBe(false);
  });

  it("clears the reservation and the stock together on a completed sale", () => {
    const movement = unwrap(completeSale(3, ORDER));
    expect(unwrap(applyMovement(level(10, 3), movement))).toEqual(level(7, 0));
  });

  it("puts stock back when a delivery fails", () => {
    const movement = unwrap(returnFromFailedDelivery(2, ORDER));
    expect(unwrap(applyMovement(level(7, 0), movement))).toEqual(level(9, 0));
  });

  it("never lets physical stock go negative", () => {
    const movement = unwrap(recordLoss(3, "broken in transit"));
    expect(applyMovement(level(2, 0), movement).ok).toBe(false);
    expect(unwrap(applyMovement(level(5, 0), movement))).toEqual(level(2, 0));
  });

  it("makes a physical count the difference, not an absolute write", () => {
    const movement = unwrap(stockCount(level(10, 2), 8, "monthly count"));
    expect(movement.onHandDelta).toBe(-2);
    expect(unwrap(applyMovement(level(10, 2), movement))).toEqual(level(8, 2));
  });

  it("refuses a count that would strand a reservation", () => {
    const movement = unwrap(stockCount(level(10, 6), 4, "monthly count"));
    const result = applyMovement(level(10, 6), movement);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("insufficient_stock");
  });

  it("says nothing happened when a count matches", () => {
    const result = stockCount(level(10, 0), 10, "monthly count");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/already recorded/i);
  });

  it("insists a human explains a correction, a count or a loss", () => {
    expect(correction(2, "").ok).toBe(false);
    expect(stockCount(level(10, 0), 9, "   ").ok).toBe(false);
    expect(recordLoss(1, "").ok).toBe(false);
    expect(correction(2, "found a missing carton").ok).toBe(true);
  });

  it("insists an order-driven movement names its order", () => {
    const orphan: Movement = { kind: "reservation", onHandDelta: 0, reservedDelta: 2 };
    expect(validateMovement(orphan).ok).toBe(false);
  });

  it("refuses a movement that claims to be something it is not", () => {
    const lying: Movement = { kind: "receipt", onHandDelta: -5, reservedDelta: 0 };
    expect(validateMovement(lying).ok).toBe(false);
  });

  it("refuses a movement that changes nothing", () => {
    const empty: Movement = { kind: "correction", onHandDelta: 0, reservedDelta: 0, reason: "x" };
    expect(validateMovement(empty).ok).toBe(false);
  });

  it("refuses fractional units", () => {
    const fractional: Movement = { kind: "receipt", onHandDelta: 1.5, reservedDelta: 0 };
    expect(validateMovement(fractional).ok).toBe(false);
  });
});

describe("replaying the ledger", () => {
  it("arrives at the same figures the running totals should hold", () => {
    const ledger = [
      unwrap(receipt(20, "opening")),
      unwrap(reserveForOrder(5, ORDER)),
      unwrap(completeSale(5, ORDER)),
      unwrap(reserveForOrder(2, "order-2")),
      unwrap(releaseReservation(2, "order-2")),
      unwrap(recordLoss(1, "damaged")),
    ];
    expect(unwrap(replayMovements(ledger))).toEqual(level(14, 0));
  });

  it("stops at the first movement that could not have happened", () => {
    const ledger = [unwrap(receipt(2, "opening")), unwrap(recordLoss(5, "damaged"))];
    const result = replayMovements(ledger);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("insufficient_stock");
  });
});
