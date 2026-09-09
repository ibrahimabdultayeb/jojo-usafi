/**
 * An order's whole life, and what it does to the stock at each step.
 *
 * The arithmetic this file defends:
 *
 *   placed      reserved += n     promised, still on the shelf
 *   completed   on_hand  -= n     gone, and the promise with it
 *               reserved -= n
 *
 * Nothing leaves `on_hand` before completion, because until the customer has
 * it, the shop still has it. That is why cancelling earlier is a pure release
 * and needs no compensating receipt — and why a failed delivery has to ask
 * where the goods physically are before it can touch a number.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "./support";
import type { OrderStateValue } from "@/lib/supabase/types";
import { ID, NAMES, SKU, TEST_PHONE } from "./fixtures";

const db = serviceClient();
const anon = anonClient();

const ZONE = NAMES.slug("zone");

async function setStock(onHand: number): Promise<void> {
  await db.from("inventory").update({ reserved: 0 }).eq("product_id", ID.productPublic);
  await db.from("inventory").update({ on_hand: onHand }).eq("product_id", ID.productPublic);
}

async function stock() {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved, available")
    .eq("product_id", ID.productPublic)
    .single();
  return data as { on_hand: number; reserved: number; available: number };
}

async function place(quantity = 2): Promise<{ order_id: string; order_number: string }> {
  const { data, error } = await db.rpc("jojo_place_order", {
    p_items: [{ sku: SKU.public, quantity }],
    p_customer_name: "Fixture Journey",
    p_customer_phone_e164: TEST_PHONE,
    p_zone_slug: ZONE,
    p_delivery_address: "Fixture address, plot 2",
    p_payment_preference: "cash_on_delivery",
  });
  expect(error).toBeNull();
  return data as { order_id: string; order_number: string };
}

const advance = (orderId: string, to: OrderStateValue, extra: Record<string, unknown> = {}) =>
  db.rpc("jojo_advance_order", { p_order_id: orderId, p_to_state: to, ...extra });

beforeEach(async () => {
  await setStock(20);
});

describe("the whole journey, from basket to paid", () => {
  it("walks new → confirmed → preparing → out for delivery → completed", async () => {
    const before = await stock();
    const order = await place(2);

    expect((await stock()).reserved).toBe(before.reserved + 2);

    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      const { data, error } = await advance(order.order_id, step);
      expect(error, step).toBeNull();
      expect((data as { state: string }).state).toBe(step);

      // Still nothing has left the shop.
      const now = await stock();
      expect(now.on_hand, `on_hand after ${step}`).toBe(before.on_hand);
      expect(now.reserved, `reserved after ${step}`).toBe(before.reserved + 2);
    }

    const completed = await advance(order.order_id, "completed", {
      p_payment_method: "cash",
    });
    expect(completed.error).toBeNull();
    expect(completed.data).toMatchObject({ state: "completed", sold: 2 });

    // NOW the goods are gone, and the promise with them.
    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand - 2);
    expect(after.reserved).toBe(before.reserved);

    const { data: row } = await db
      .from("orders")
      .select("state, payment_status, payment_method, paid_at, completed_at")
      .eq("id", order.order_id)
      .single();
    expect(row).toMatchObject({ state: "completed", payment_status: "paid", payment_method: "cash" });
    expect(row!.paid_at).not.toBeNull();

    const { data: movements } = await db
      .from("inventory_movements")
      .select("kind")
      .eq("order_id", order.order_id);
    expect(movements!.map((m) => m.kind).sort()).toEqual(["reservation", "sale"]);

    const { data: events } = await db
      .from("order_events")
      .select("kind")
      .eq("order_id", order.order_id);
    expect(events!.map((e) => e.kind)).toContain("payment_recorded");
  }, 60_000);

  it("is visible to the customer at every step, in friendly words", async () => {
    const order = await place(1);
    await advance(order.order_id, "confirmed");

    const { data } = await anon.rpc("jojo_track_order", {
      p_order_number: order.order_number,
      p_phone_e164: TEST_PHONE,
    });
    expect((data as { state: string }).state).toBe("confirmed");
  });
});

describe("completing an order requires the money", () => {
  it("refuses completion with no payment method", async () => {
    const order = await place(1);
    await advance(order.order_id, "confirmed");
    await advance(order.order_id, "preparing");
    await advance(order.order_id, "out_for_delivery");

    const { error } = await advance(order.order_id, "completed");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Record the payment");

    // And nothing moved.
    expect((await stock()).on_hand).toBe(20);
  });

  it("refuses a digital payment with no transaction reference", async () => {
    const order = await place(1);
    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await advance(order.order_id, step);
    }

    const { error } = await advance(order.order_id, "completed", { p_payment_method: "digital" });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("transaction reference");
  });

  it("accepts a digital payment that has one", async () => {
    const order = await place(1);
    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await advance(order.order_id, step);
    }

    const { data, error } = await advance(order.order_id, "completed", {
      p_payment_method: "digital",
      p_payment_reference: "MPESA-FIXTURE-001",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ state: "completed" });
  });
});

describe("illegal moves are refused by the database, not only by the buttons", () => {
  it("will not send a brand-new order straight out for delivery", async () => {
    const order = await place(1);
    const { error } = await advance(order.order_id, "out_for_delivery");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("cannot become");
  });

  it("will not move a completed order at all", async () => {
    const order = await place(1);
    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await advance(order.order_id, step);
    }
    await advance(order.order_id, "completed", { p_payment_method: "cash" });

    const { error } = await advance(order.order_id, "preparing");
    expect(error).not.toBeNull();
  });

  it("sends cancellation and delivery failure to their own functions", async () => {
    const order = await place(1);

    const cancel = await advance(order.order_id, "cancelled");
    expect(cancel.error!.message).toContain("jojo_cancel_order");

    await advance(order.order_id, "confirmed");
    await advance(order.order_id, "preparing");
    await advance(order.order_id, "out_for_delivery");

    const failed = await advance(order.order_id, "delivery_failed");
    expect(failed.error!.message).toContain("jojo_fail_delivery");
  });

  it("treats asking for the state it is already in as a no-op", async () => {
    const order = await place(1);
    await advance(order.order_id, "confirmed");
    const again = await advance(order.order_id, "confirmed");
    expect(again.error).toBeNull();
    expect(again.data).toMatchObject({ already: true, sold: 0 });
  });
});

describe("a delivery that did not arrive", () => {
  async function outForDelivery(quantity = 2) {
    const order = await place(quantity);
    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await advance(order.order_id, step);
    }
    return order;
  }

  it("keeps the stock when the items came back", async () => {
    const order = await outForDelivery(2);
    const before = await stock();

    const { data, error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: true,
      p_reason: "Customer was not at home",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ state: "delivery_failed", lost: 0, items_returned: true });

    // The goods are back on the shelf and still promised to this order, which
    // can be sent out again — so nothing moves.
    expect(await stock()).toMatchObject({
      on_hand: before.on_hand,
      reserved: before.reserved,
    });
  });

  it("writes the loss off when the items did not", async () => {
    const order = await outForDelivery(2);
    const before = await stock();

    const { data, error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: false,
      p_reason: "Rider could not recover the goods",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ state: "delivery_failed", lost: 2, items_returned: false });

    // The goods are not in the shop: on_hand falls and the promise is released.
    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand - 2);
    expect(after.reserved).toBe(before.reserved - 2);

    const { data: movements } = await db
      .from("inventory_movements")
      .select("kind, on_hand_delta, reserved_delta, reason")
      .eq("order_id", order.order_id);

    const kinds = movements!.map((m) => m.kind).sort();
    expect(kinds).toEqual(["damage_loss", "reservation", "reservation_release"]);

    const loss = movements!.find((m) => m.kind === "damage_loss")!;
    expect(loss.on_hand_delta).toBe(-2);
    expect(loss.reserved_delta, "damage_loss may only move on_hand").toBe(0);
    expect(loss.reason).toContain("not returned");
  });

  it("insists on an answer about the items", async () => {
    const order = await outForDelivery(1);
    const { error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      // Deliberately absent: the function must refuse rather than guess.
      p_items_returned: null as unknown as boolean,
      p_reason: "Unknown",
    });
    expect(error).not.toBeNull();
  });

  it("only applies to an order that is actually out for delivery", async () => {
    const order = await place(1);
    const { error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: true,
      p_reason: "Too early",
    });
    expect(error!.message).toContain("out for delivery");
  });

  it("can be sent out again after the items came back", async () => {
    const order = await outForDelivery(1);
    await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: true,
      p_reason: "Nobody home",
    });

    const { data, error } = await advance(order.order_id, "out_for_delivery");
    expect(error).toBeNull();
    expect(data).toMatchObject({ state: "out_for_delivery" });
  });
});

describe("order operations are closed to the browser", () => {
  it("refuses an anonymous caller both functions", async () => {
    const advanceAttempt = await anon.rpc("jojo_advance_order", {
      p_order_id: ID.order,
      p_to_state: "completed",
    });
    expect(advanceAttempt.error?.code).toBe("42501");

    const failAttempt = await anon.rpc("jojo_fail_delivery", {
      p_order_id: ID.order,
      p_items_returned: false,
      p_reason: "not allowed",
    });
    expect(failAttempt.error?.code).toBe("42501");
  });
});
