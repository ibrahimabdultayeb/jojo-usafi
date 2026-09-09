/**
 * The commerce engine: quoting, reserving, ordering, cancelling.
 *
 * The rule every test here defends:
 *
 *     available = on_hand - reserved,  and it may never go negative.
 *
 * The one that matters most is the last-unit race. Two shoppers reach the last
 * jerrycan in the same millisecond; exactly one gets it, the other is told so
 * plainly, and no stock is invented in the gap. That is not provable by reading
 * the code — it needs two real transactions arriving at one real PostgreSQL.
 *
 * Everything runs on this run's own fixtures. Nothing here touches the real
 * catalogue, the real Owner or any real order.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "./support";
import { ID, NAMES, SKU, TEST_PHONE } from "./fixtures";

const db = serviceClient();
const anon = anonClient();

const ZONE = NAMES.slug("zone");

/** Put the fixture product at a known availability. Fixture rows only. */
async function setStock(onHand: number, reserved = 0): Promise<void> {
  // `reserved` first, so `reserved <= on_hand` is never transiently violated.
  await db.from("inventory").update({ reserved: 0 }).eq("product_id", ID.productPublic);
  await db.from("inventory").update({ on_hand: onHand }).eq("product_id", ID.productPublic);
  if (reserved > 0) {
    await db.from("inventory").update({ reserved }).eq("product_id", ID.productPublic);
  }
}

async function availability(): Promise<{ on_hand: number; reserved: number; available: number }> {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved, available")
    .eq("product_id", ID.productPublic)
    .single();
  return data as { on_hand: number; reserved: number; available: number };
}

const customer = {
  p_customer_name: "Fixture Shopper",
  p_customer_phone_e164: TEST_PHONE,
  p_zone_slug: ZONE,
  p_delivery_address: "Fixture address, plot 1",
  p_payment_preference: "cash_on_delivery" as const,
};

function order(quantity: number, sku: string = SKU.public) {
  return { ...customer, p_items: [{ sku, quantity }] };
}

/** How many orders this run has placed so far. Orders cannot be deleted —
 * order_events cascades into an append-only table — so tests count deltas. */
async function orderCount(): Promise<number> {
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone_e164", TEST_PHONE);
  return count ?? 0;
}

beforeEach(async () => {
  await setStock(10, 0);
});

afterAll(async () => {
  await setStock(10, 3);
});

describe("quoting is the database's answer, not the browser's", () => {
  it("prices the cart from the current rows", async () => {
    const { data, error } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 3 }],
      p_zone_slug: ZONE,
    });

    expect(error).toBeNull();
    const quote = data as Record<string, unknown>;
    expect(quote.ok).toBe(true);
    // The fixture product is 10,000 TZS; the fixture zone charges 4,000.
    expect(quote.subtotal_tzs).toBe(30_000);
    expect(quote.delivery_fee_tzs).toBe(4000);
    expect(quote.total_tzs).toBe(34_000);
  });

  it("has nowhere for the browser to put a price", async () => {
    // A hostile request carrying its own figures changes nothing, because the
    // function reads SKU and quantity and ignores everything else.
    const { data } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 1, unit_price: 1, line_total: 1, total_tzs: 1 }],
      p_zone_slug: ZONE,
    });
    const quote = data as Record<string, unknown>;
    expect(quote.subtotal_tzs).toBe(10_000);
    expect(quote.total_tzs).toBe(14_000);
  });

  it("charges nothing to deliver to a free zone", async () => {
    const free = NAMES.slug("zone-free");
    await db.from("delivery_zones").insert({
      slug: free,
      name: `ZZ${NAMES.token} Free Zone`,
      fee_tzs: 0,
      free_delivery: true,
      active: true,
    });

    const { data } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 1 }],
      p_zone_slug: free,
    });
    const quote = data as Record<string, unknown>;
    expect(quote.delivery_fee_tzs).toBe(0);
    expect(quote.total_tzs).toBe(10_000);
  });

  it("refuses an area we do not deliver to", async () => {
    const closed = NAMES.slug("zone-closed");
    await db.from("delivery_zones").insert({
      slug: closed,
      name: `ZZ${NAMES.token} Closed Zone`,
      fee_tzs: 4000,
      active: false,
    });

    const { data } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 1 }],
      p_zone_slug: closed,
    });
    const quote = data as { ok: boolean; problems: { kind: string }[] };
    expect(quote.ok).toBe(false);
    expect(quote.problems.map((p) => p.kind)).toContain("zone_unavailable");
  });

  it("says plainly when there is not enough", async () => {
    await setStock(2, 0);
    const { data } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 5 }],
      p_zone_slug: ZONE,
    });
    const quote = data as { ok: boolean; problems: { kind: string; message: string }[] };
    expect(quote.ok).toBe(false);
    expect(quote.problems[0].kind).toBe("insufficient_stock");
    expect(quote.problems[0].message).toContain("Only 2");
  });

  it("will not sell a product that is not on the shelf", async () => {
    const { data } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.hidden, quantity: 1 }],
      p_zone_slug: ZONE,
    });
    const quote = data as { ok: boolean; problems: { kind: string }[] };
    expect(quote.ok).toBe(false);
    expect(quote.problems.map((p) => p.kind)).toContain("not_orderable");
  });
});

describe("placing an order reserves stock, all of it or none", () => {
  it("creates the order, its lines, its history and the reservation", async () => {
    const before = await availability();

    const { data, error } = await db.rpc("jojo_place_order", order(2));
    expect(error).toBeNull();

    const placed = data as { order_id: string; order_number: string; total_tzs: number; state: string };
    expect(placed.order_number).toMatch(/^JU-\d{6,}$/);
    expect(placed.state).toBe("new");
    expect(placed.total_tzs).toBe(24_000); // 2 x 10,000 + 4,000 delivery

    const after = await availability();
    expect(after.reserved).toBe(before.reserved + 2);
    expect(after.on_hand).toBe(before.on_hand); // nothing has left the shop yet
    expect(after.available).toBe(before.available - 2);

    const items = await db.from("order_items").select("sku, quantity, unit_price_tzs, line_total_tzs").eq("order_id", placed.order_id);
    expect(items.data).toHaveLength(1);
    expect(items.data![0]).toMatchObject({ sku: SKU.public, quantity: 2, unit_price_tzs: 10_000, line_total_tzs: 20_000 });

    const events = await db.from("order_events").select("kind").eq("order_id", placed.order_id);
    expect(events.data!.map((e) => e.kind).sort()).toEqual(["order_created", "stock_reserved"]);

    const movements = await db
      .from("inventory_movements")
      .select("kind, reserved_delta")
      .eq("order_id", placed.order_id);
    expect(movements.data).toHaveLength(1);
    expect(movements.data![0]).toMatchObject({ kind: "reservation", reserved_delta: 2 });
  });

  it("gives every order its own number, and never reuses one", async () => {
    const results = await Promise.all([db.rpc("jojo_place_order", order(1)), db.rpc("jojo_place_order", order(1))]);
    const numbers = results.map((r) => (r.data as { order_number: string }).order_number);
    expect(new Set(numbers).size).toBe(2);
    for (const number of numbers) expect(number).toMatch(/^JU-\d{6,}$/);
  });

  it("leaves nothing behind when it refuses", async () => {
    await setStock(1, 0);
    const ordersBefore = await orderCount();

    const { error } = await db.rpc("jojo_place_order", order(5));
    expect(error).not.toBeNull();
    expect(error!.message).toContain("left");

    // No order, no lines, no events, and the stock is exactly where it was.
    expect(await orderCount()).toBe(ordersBefore);
    expect(await availability()).toMatchObject({ on_hand: 1, reserved: 0, available: 1 });
  });

  it("reserves nothing at all when one line of several fails", async () => {
    await setStock(10, 0);
    const { error } = await db.rpc("jojo_place_order", {
      ...customer,
      p_items: [
        { sku: SKU.public, quantity: 1 },
        { sku: SKU.hidden, quantity: 1 }, // not on the shelf
      ],
    });

    expect(error).not.toBeNull();
    expect(await availability()).toMatchObject({ reserved: 0, available: 10 });
  });

  it("reuses the customer record that phone number already has", async () => {
    await db.rpc("jojo_place_order", { ...order(1), p_customer_name: "Fixture Shopper Renamed" });

    const { data } = await db.from("customers").select("id, full_name").eq("phone_e164", TEST_PHONE);
    expect(data, "phone is the identity — one row, not two").toHaveLength(1);
    expect(data![0].full_name).toBe("Fixture Shopper Renamed");
  });

  it("keeps the order's own snapshot when the customer record later changes", async () => {
    const { data } = await db.rpc("jojo_place_order", { ...order(1), p_customer_name: "Name At Order Time" });
    const placed = data as { order_id: string };

    await db.from("customers").update({ full_name: "Changed Afterwards" }).eq("phone_e164", TEST_PHONE);

    const { data: snapshot } = await db
      .from("orders")
      .select("customer_name")
      .eq("id", placed.order_id)
      .single();
    expect(snapshot!.customer_name).toBe("Name At Order Time");
  });
});

describe("the last unit cannot be sold twice", () => {
  it("lets exactly one of two simultaneous orders have it", async () => {
    await setStock(1, 0);
    const before = await orderCount();

    // Two independent clients, two independent transactions, sent together.
    const [first, second] = await Promise.all([
      serviceClient().rpc("jojo_place_order", order(1)),
      serviceClient().rpc("jojo_place_order", order(1)),
    ]);

    const succeeded = [first, second].filter((r) => r.error === null);
    const failed = [first, second].filter((r) => r.error !== null);

    expect(succeeded, "exactly one order may take the last unit").toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error!.message).toMatch(/sold out|left/i);

    const stock = await availability();
    expect(stock).toMatchObject({ on_hand: 1, reserved: 1, available: 0 });
    expect(stock.available).toBeGreaterThanOrEqual(0);
    expect(stock.reserved).toBeLessThanOrEqual(stock.on_hand);

    // One success means exactly one new order.
    expect((await orderCount()) - before).toBe(succeeded.length);
  }, 60_000);

  it("survives five at once with three in stock", async () => {
    await setStock(3, 0);
    const before = await orderCount();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => serviceClient().rpc("jojo_place_order", order(1))),
    );

    const ok = attempts.filter((a) => a.error === null);
    expect(ok).toHaveLength(3);

    const stock = await availability();
    expect(stock).toMatchObject({ on_hand: 3, reserved: 3, available: 0 });

    const numbers = ok.map((a) => (a.data as { order_number: string }).order_number);
    expect(new Set(numbers).size, "three orders, three distinct numbers").toBe(3);
    expect((await orderCount()) - before).toBe(3);
  }, 90_000);
});

describe("cancelling gives the stock back, once", () => {
  it("releases the reservation and records why", async () => {
    await setStock(5, 0);
    const { data } = await db.rpc("jojo_place_order", order(2));
    const placed = data as { order_id: string };

    expect(await availability()).toMatchObject({ reserved: 2, available: 3 });

    const cancelled = await db.rpc("jojo_cancel_order", {
      p_order_id: placed.order_id,
      p_reason: "Customer changed their mind",
    });
    expect(cancelled.error).toBeNull();
    expect(cancelled.data).toMatchObject({ state: "cancelled", released: 2, already: false });

    expect(await availability()).toMatchObject({ on_hand: 5, reserved: 0, available: 5 });

    const events = await db.from("order_events").select("kind").eq("order_id", placed.order_id);
    expect(events.data!.map((e) => e.kind)).toContain("cancelled");
    expect(events.data!.map((e) => e.kind)).toContain("stock_released");
  });

  it("is idempotent — a retry does not give the stock back twice", async () => {
    await setStock(5, 0);
    const { data } = await db.rpc("jojo_place_order", order(2));
    const placed = data as { order_id: string };

    await db.rpc("jojo_cancel_order", { p_order_id: placed.order_id, p_reason: "First call" });
    const again = await db.rpc("jojo_cancel_order", { p_order_id: placed.order_id, p_reason: "Retry" });

    expect(again.error).toBeNull();
    expect(again.data).toMatchObject({ already: true, released: 0 });
    expect(await availability()).toMatchObject({ on_hand: 5, reserved: 0, available: 5 });
  });

  it("refuses to cancel without a reason", async () => {
    await setStock(5, 0);
    const { data } = await db.rpc("jojo_place_order", order(1));
    const placed = data as { order_id: string };

    const { error } = await db.rpc("jojo_cancel_order", { p_order_id: placed.order_id, p_reason: "  " });
    expect(error).not.toBeNull();
  });
});

describe("tracking an order needs the number AND the phone", () => {
  it("returns the customer's own order", async () => {
    const { data } = await db.rpc("jojo_place_order", order(1));
    const placed = data as { order_number: string };

    const { data: tracked, error } = await anon.rpc("jojo_track_order", {
      p_order_number: placed.order_number,
      p_phone_e164: TEST_PHONE,
    });

    expect(error).toBeNull();
    const view = tracked as Record<string, unknown>;
    expect(view.order_number).toBe(placed.order_number);
    expect(view.state).toBe("new");
    expect(Array.isArray(view.items)).toBe(true);

    // Nothing internal leaks into the customer's view.
    for (const forbidden of ["staff_note", "payment_reference", "customer_id", "actor_admin_id"]) {
      expect(Object.keys(view)).not.toContain(forbidden);
    }
  });

  it("tells a stranger with the right number and the wrong phone nothing", async () => {
    const { data } = await db.rpc("jojo_place_order", order(1));
    const placed = data as { order_number: string };

    const { data: tracked } = await anon.rpc("jojo_track_order", {
      p_order_number: placed.order_number,
      p_phone_e164: "+255700000999",
    });
    expect(tracked).toBeNull();
  });
});

describe("the commerce path is closed to the browser", () => {
  it("refuses an anonymous caller the order function outright", async () => {
    const { error } = await anon.rpc("jojo_place_order", order(1));
    expect(error?.code).toBe("42501");
  });

  it("refuses an anonymous caller the cancellation function", async () => {
    const { error } = await anon.rpc("jojo_cancel_order", {
      p_order_id: ID.order,
      p_reason: "not allowed",
    });
    expect(error?.code).toBe("42501");
  });

  it("refuses an anonymous caller the stock operations", async () => {
    const add = await anon.rpc("jojo_add_stock", { p_product_id: ID.productPublic, p_quantity: 100 });
    expect(add.error?.code).toBe("42501");

    const count = await anon.rpc("jojo_count_stock", {
      p_product_id: ID.productPublic,
      p_counted: 999,
      p_reason: "not allowed",
    });
    expect(count.error?.code).toBe("42501");
  });

  it("still refuses an anonymous caller a direct write to stock or price", async () => {
    const stock = await anon.from("inventory").update({ on_hand: 9999 }).eq("product_id", ID.productPublic);
    expect(stock.error?.code).toBe("42501");

    const price = await anon.from("products").update({ price_tzs: 1 }).eq("id", ID.productPublic);
    expect(price.error?.code).toBe("42501");

    const injected = await anon.from("orders").insert({
      customer_name: "Injected",
      customer_phone_e164: TEST_PHONE,
      delivery_zone_name: "Nowhere",
      delivery_address: "Nowhere",
      delivery_fee_tzs: 0,
      subtotal_tzs: 0,
      total_tzs: 0,
      payment_preference: "cash_on_delivery",
    });
    expect(injected.error?.code).toBe("42501");
  });
});

describe("reservations can always be found again", () => {
  it("has somewhere to record how long is too long", async () => {
    const { data, error } = await db.from("shop_settings").select("*").single();
    expect(error).toBeNull();
    // Undecided, not zero — the durations are Ibrahim's to set.
    expect(data!.reservation_warning_minutes).toBeNull();
    expect(data!.reservation_expiry_minutes).toBeNull();
  });

  it("can list what would be stale, without inventing a duration", async () => {
    const { error } = await db.rpc("jojo_stale_reservations");
    expect(error, "the question must be answerable even when nothing qualifies").toBeNull();
  });
});
