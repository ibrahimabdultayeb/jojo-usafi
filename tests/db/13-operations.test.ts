/**
 * Build 10's three operations, against the real database.
 *
 *   creating a product from a Sheet row   — internal only, never public
 *   amending an order before dispatch      — one transaction, never oversells
 *   expiring an unconfirmed reservation    — nothing while it is unconfigured
 *
 * Every fixture carries this run's token and is removed by the teardown that
 * already exists. Nothing here touches a real product, a real order or the real
 * Owner; `05-real-data-untouched.test.ts` proves that afterwards.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "./support";
import { ID, NAMES, SKU, TEST_PHONE } from "./fixtures";
import { createNewProducts } from "@/lib/sheets/create";
import type { CatalogueFields } from "@/lib/sheets/columns";
import type { NewProduct } from "@/lib/sheets/plan";

const db = serviceClient();
const anon = anonClient();
const ZONE = NAMES.slug("zone");

/** SKUs this file creates, deleted by exact value at the end. */
const created: string[] = [];

const BASE_FIELDS: CatalogueFields = {
  displayName: `ZZ${NAMES.token} Brand New Thing`,
  variantLabel: null,
  packSizeLabel: "1LT",
  categoryName: `ZZ${NAMES.token} Category`,
  brandName: `ZZ${NAMES.token} Brand`,
  ean: null,
  itf14: null,
  priceTzs: 9_000,
  offerPriceTzs: null,
  storefrontVisible: true,
  featured: false,
  bestSeller: false,
  lifecycle: "active",
  lowStockThreshold: 2,
  sortPriority: 0,
  slug: NAMES.slug("brand-new-thing"),
  description: null,
};

function candidate(over: Partial<CatalogueFields> = {}, sku = NAMES.sku("NEW1")): NewProduct {
  return {
    sku,
    row: 500,
    fields: { ...BASE_FIELDS, ...over },
    reference: { familyCode: NAMES.code("FAM"), supplierName: `ZZ${NAMES.token} Supplier` },
  };
}

async function stock(productId = ID.productPublic) {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved, available")
    .eq("product_id", productId)
    .single();
  return data as { on_hand: number; reserved: number; available: number };
}

async function setStock(onHand: number): Promise<void> {
  await db.from("inventory").update({ reserved: 0 }).eq("product_id", ID.productPublic);
  await db.from("inventory").update({ on_hand: onHand }).eq("product_id", ID.productPublic);
}

async function place(quantity = 2, sku = SKU.public) {
  const { data, error } = await db.rpc("jojo_place_order", {
    p_items: [{ sku, quantity }],
    p_customer_name: "Fixture Amendment",
    p_customer_phone_e164: TEST_PHONE,
    p_zone_slug: ZONE,
    p_delivery_address: "Fixture address, plot 12",
    p_payment_preference: "cash_on_delivery",
  });
  expect(error).toBeNull();
  return data as { order_id: string; order_number: string };
}

const amend = (orderId: string, items: { sku: string; quantity: number }[], reason = "Customer called") =>
  db.rpc("jojo_amend_order", { p_order_id: orderId, p_items: items, p_reason: reason });

beforeEach(async () => {
  await setStock(30);
});

afterAll(async () => {
  // Exactly the SKUs this file made, by value. Never "everything that looks new".
  for (const sku of created) {
    const { data } = await db.from("products").select("id").eq("sku", sku).maybeSingle();
    if (!data) continue;
    await db.from("product_content").delete().eq("product_id", data.id);
    await db.from("inventory").delete().eq("product_id", data.id);
    await db.from("products").delete().eq("id", data.id);
  }
}, 120_000);

/* ------------------------------------------------ new products from a row */

describe("a Sheet row the shop has never seen", () => {
  it("becomes an internal draft that no shopper can reach", async () => {
    const sku = NAMES.sku("NEW1");
    created.push(sku);

    const [outcome] = await createNewProducts(db, [candidate({}, sku)]);
    expect(outcome.ok, "ok" in outcome && !outcome.ok ? outcome.problem : "").toBe(true);

    const { data } = await db
      .from("products")
      .select("lifecycle, storefront_visible, price_tzs, family_id, brand_id, category_id, supplier_id")
      .eq("sku", sku)
      .single();

    // The sheet said active and Show. It is a draft and switched off, because
    // nobody has looked at it yet.
    expect(data!.lifecycle).toBe("draft");
    expect(data!.storefront_visible).toBe(false);
    expect(data!.price_tzs).toBe(9_000);
    expect(data!.family_id).toBe(ID.family);
    expect(data!.brand_id).toBe(ID.brand);
    expect(data!.category_id).toBe(ID.category);
    expect(data!.supplier_id).toBe(ID.supplier);

    // And it is nowhere a customer can see.
    const { data: shelf } = await anon.from("product_shelf").select("sku").eq("sku", sku).maybeSingle();
    expect(shelf, "a new product must not reach the shelf").toBeNull();
  });

  it("gets an inventory row at zero, because the sync cannot know what is in the store", async () => {
    const sku = NAMES.sku("NEW2");
    created.push(sku);

    await createNewProducts(db, [candidate({ slug: NAMES.slug("new-two") }, sku)]);
    const { data: product } = await db.from("products").select("id").eq("sku", sku).single();
    const inventory = await stock(product!.id);

    expect(inventory.on_hand, "opening stock is zero, never the sheet's number").toBe(0);
    expect(inventory.reserved).toBe(0);
  });

  it("stays off the shelf even once it is active and visible, while it has no photograph", async () => {
    const sku = NAMES.sku("NEW3");
    created.push(sku);

    await createNewProducts(db, [candidate({ slug: NAMES.slug("new-three") }, sku)]);
    const { data: product } = await db.from("products").select("id").eq("sku", sku).single();

    // Exactly what an Owner would do after reviewing it.
    await db
      .from("products")
      .update({ lifecycle: "active", storefront_visible: true })
      .eq("id", product!.id);

    const { data: shelf } = await anon.from("product_shelf").select("sku").eq("sku", sku).maybeSingle();
    expect(shelf, "no photograph, no shelf — whatever the flags say").toBeNull();
  });

  it("refuses a duplicate SKU", async () => {
    const [outcome] = await createNewProducts(db, [candidate({}, SKU.public)]);
    expect(outcome.ok).toBe(false);
    expect("problem" in outcome && outcome.problem).toMatch(/already exists/i);
  });

  it("refuses an implausible price rather than guessing at it", async () => {
    const [outcome] = await createNewProducts(db, [
      candidate({ priceTzs: 128 }, NAMES.sku("NEW4")),
    ]);
    expect(outcome.ok).toBe(false);
    expect("problem" in outcome && outcome.problem).toMatch(/too low/i);
  });

  it("reports an unknown brand instead of creating one", async () => {
    const [outcome] = await createNewProducts(db, [
      candidate({ brandName: "A Brand Nobody Has Heard Of" }, NAMES.sku("NEW5")),
    ]);
    expect(outcome.ok).toBe(false);
    expect("problem" in outcome && outcome.problem).toMatch(/no brand called/i);
  });

  it("reports an unknown category instead of creating one", async () => {
    const [outcome] = await createNewProducts(db, [
      candidate({ categoryName: "Nonexistent Category" }, NAMES.sku("NEW6")),
    ]);
    expect(outcome.ok).toBe(false);
    expect("problem" in outcome && outcome.problem).toMatch(/no category called/i);
  });

  it("reports an unknown family instead of creating one", async () => {
    const one = candidate({}, NAMES.sku("NEW7"));
    const [outcome] = await createNewProducts(db, [
      { ...one, reference: { ...one.reference, familyCode: "ZZNOSUCHFAMILY" } },
    ]);
    expect(outcome.ok).toBe(false);
    expect("problem" in outcome && outcome.problem).toMatch(/no product family/i);
  });

  it("matches a brand whose capitalisation and spacing differ, and only that", async () => {
    const sku = NAMES.sku("NEW8");
    created.push(sku);

    const [outcome] = await createNewProducts(db, [
      candidate(
        { brandName: `  zz${NAMES.token.toLowerCase()}   BRAND `, slug: NAMES.slug("new-eight") },
        sku,
      ),
    ]);

    expect(outcome.ok, "the same name typed carelessly is the same brand").toBe(true);

    const { count } = await db
      .from("brands")
      .select("*", { count: "exact", head: true })
      .like("name", `ZZ${NAMES.token}%`);
    expect(count, "and no near-duplicate brand was created").toBe(2); // the fixture's two
  });
});

/* ------------------------------------------------------------ amendment */

describe("amending an order before it goes out", () => {
  it("adds stock to the reservation when a quantity goes up", async () => {
    const before = await stock();
    const order = await place(2);
    expect((await stock()).reserved).toBe(before.reserved + 2);

    const { data, error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 5 }]);
    expect(error).toBeNull();

    const after = await stock();
    expect(after.reserved, "three more units are now promised").toBe(before.reserved + 5);
    expect(after.on_hand, "nothing has left the shop").toBe(before.on_hand);
    expect((data as { changed: number }).changed).toBe(1);
  });

  it("gives stock back when a quantity goes down", async () => {
    const before = await stock();
    const order = await place(5);

    const { error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 2 }]);
    expect(error).toBeNull();
    expect((await stock()).reserved).toBe(before.reserved + 2);
  });

  it("gives all of it back when a line is removed, and refuses an empty order", async () => {
    const before = await stock();
    const order = await place(3);

    // An order with nothing in it is not an amendment, it is a cancellation —
    // and cancelling has its own function, with its own rules.
    const { error } = await amend(order.order_id, []);
    expect(error).not.toBeNull();
    expect((await stock()).reserved, "the refusal changed nothing").toBe(before.reserved + 3);
  });

  it("recomputes the total from the catalogue, not from the caller", async () => {
    const order = await place(2);
    const { data: priceRow } = await db
      .from("products")
      .select("price_tzs, offer_price_tzs")
      .eq("id", ID.productPublic)
      .single();
    const unit = priceRow!.offer_price_tzs ?? priceRow!.price_tzs;

    const { data, error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 4 }]);
    expect(error).toBeNull();

    const { data: after } = await db
      .from("orders")
      .select("subtotal_tzs, total_tzs, delivery_fee_tzs, discount_tzs")
      .eq("id", order.order_id)
      .single();

    expect(after!.subtotal_tzs).toBe(unit * 4);
    expect(after!.total_tzs).toBe(unit * 4 - after!.discount_tzs + after!.delivery_fee_tzs);
    expect((data as { total_tzs: number }).total_tzs).toBe(after!.total_tzs);
  });

  it("refuses to oversell, and changes nothing when it refuses", async () => {
    await setStock(4);
    const order = await place(2);
    const before = await stock();

    const { error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 10 }]);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/INSUFFICIENT_STOCK/);

    const after = await stock();
    expect(after).toEqual(before);

    const { data: items } = await db
      .from("order_items")
      .select("quantity")
      .eq("order_id", order.order_id);
    expect(items![0].quantity, "the order is untouched").toBe(2);
  });

  it("demands a reason", async () => {
    const order = await place(2);
    const { error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 3 }], "   ");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/why/i);
  });

  it("refuses once the order is out for delivery", async () => {
    const order = await place(2);
    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await db.rpc("jojo_advance_order", { p_order_id: order.order_id, p_to_state: step });
    }

    const { error } = await amend(order.order_id, [{ sku: SKU.public, quantity: 3 }]);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/already gone out for delivery/i);
  });

  it("keeps the history, with what it was and what it became", async () => {
    const order = await place(2);
    await amend(order.order_id, [{ sku: SKU.public, quantity: 6 }], "Customer wanted more");

    const { data: events } = await db
      .from("order_events")
      .select("kind, summary, payload")
      .eq("order_id", order.order_id)
      .eq("kind", "order_amended");

    expect(events).toHaveLength(1);
    expect(events![0].summary).toContain("Customer wanted more");

    const payload = events![0].payload as { before: { quantity: number }[]; after: { quantity: number }[] };
    expect(payload.before[0].quantity).toBe(2);
    expect(payload.after[0].quantity).toBe(6);

    // And the order's own first event is still there: amendment adds, never rewrites.
    const { count } = await db
      .from("order_events")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order.order_id)
      .eq("kind", "order_created");
    expect(count).toBe(1);
  });

  it("writes a ledger movement for the change, in the right direction", async () => {
    const order = await place(2);
    await amend(order.order_id, [{ sku: SKU.public, quantity: 5 }]);

    const { data: movements } = await db
      .from("inventory_movements")
      .select("kind, reserved_delta, on_hand_delta")
      .eq("order_id", order.order_id)
      .order("created_at");

    const amendMovement = movements!.at(-1)!;
    expect(amendMovement.kind).toBe("reservation");
    expect(amendMovement.reserved_delta).toBe(3);
    expect(amendMovement.on_hand_delta, "an amendment never moves on_hand").toBe(0);
  });
});

/* -------------------------------------------------------- concurrency */

describe("two amendments racing for the last unit", () => {
  it("lets exactly one of them have it", async () => {
    await setStock(5);

    // Two orders, each holding two units, leaving exactly one spare.
    const first = await place(2);
    const second = await place(2);
    expect((await stock()).available).toBe(1);

    const [a, b] = await Promise.all([
      amend(first.order_id, [{ sku: SKU.public, quantity: 3 }], "Race A"),
      amend(second.order_id, [{ sku: SKU.public, quantity: 3 }], "Race B"),
    ]);

    const won = [a, b].filter((r) => r.error === null).length;
    const lost = [a, b].filter((r) => r.error !== null);

    expect(won, "exactly one amendment may take the last unit").toBe(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].error!.message).toMatch(/INSUFFICIENT_STOCK/);

    const after = await stock();
    expect(after.reserved, "five promised, none over").toBe(5);
    expect(after.available).toBe(0);
    expect(after.reserved).toBeLessThanOrEqual(after.on_hand);
  });
});

/* ---------------------------------------------------------- expiry */

describe("expiring an unconfirmed reservation", () => {
  it("does nothing at all while no duration is set", async () => {
    const { data: settings } = await db
      .from("shop_settings")
      .select("reservation_expiry_minutes")
      .eq("id", true)
      .single();
    expect(settings!.reservation_expiry_minutes, "still Ibrahim's decision to make").toBeNull();

    const before = await stock();
    const order = await place(2);

    const { data, error } = await db.rpc("jojo_expire_reservations", { p_limit: 100 });
    expect(error).toBeNull();
    expect((data as { configured: boolean }).configured).toBe(false);
    expect((data as { expired: number }).expired).toBe(0);

    expect((await stock()).reserved, "nothing was released").toBe(before.reserved + 2);

    const { data: unchanged } = await db
      .from("orders")
      .select("state")
      .eq("id", order.order_id)
      .single();
    expect(unchanged!.state).toBe("new");
  });

  it("releases an order older than the configured window, and only once", async () => {
    const order = await place(3);
    const before = await stock();

    // Configure briefly, and age this order past the window. The settings row is
    // put back in the same test, so the shop leaves as it arrived: unconfigured.
    await db.from("shop_settings").update({ reservation_expiry_minutes: 30 }).eq("id", true);
    await db
      .from("orders")
      .update({ placed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("id", order.order_id);

    try {
      const { data, error } = await db.rpc("jojo_expire_reservations", { p_limit: 50 });
      expect(error).toBeNull();
      expect((data as { configured: boolean }).configured).toBe(true);
      expect((data as { expired: number }).expired).toBeGreaterThanOrEqual(1);

      const { data: after } = await db
        .from("orders")
        .select("state, cancellation_reason, reservation_released_at")
        .eq("id", order.order_id)
        .single();

      expect(after!.state).toBe("cancelled");
      expect(after!.cancellation_reason).toMatch(/not confirmed/i);
      expect(after!.reservation_released_at).not.toBeNull();
      expect((await stock()).reserved, "the stock came back").toBe(before.reserved - 3);

      // Idempotent: running again finds nothing left to do to it.
      const { data: again } = await db.rpc("jojo_expire_reservations", { p_limit: 50 });
      const releasedAgain = (again as { released: number }).released;
      expect((await stock()).reserved).toBe(before.reserved - 3);
      expect(releasedAgain, "a second pass releases nothing twice").toBe(0);
    } finally {
      await db.from("shop_settings").update({ reservation_expiry_minutes: null }).eq("id", true);
    }
  });

  it("leaves a confirmed order alone however old it is", async () => {
    const order = await place(2);
    await db.rpc("jojo_advance_order", { p_order_id: order.order_id, p_to_state: "confirmed" });
    await db
      .from("orders")
      .update({ placed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() })
      .eq("id", order.order_id);

    await db.from("shop_settings").update({ reservation_expiry_minutes: 30 }).eq("id", true);
    try {
      await db.rpc("jojo_expire_reservations", { p_limit: 50 });
      const { data } = await db.from("orders").select("state").eq("id", order.order_id).single();
      expect(data!.state, "confirmed means somebody is dealing with it").toBe("confirmed");
    } finally {
      await db.from("shop_settings").update({ reservation_expiry_minutes: null }).eq("id", true);
    }
  });
});

/* ------------------------------------------------------ shop settings */

describe("the shop's own settings", () => {
  it("start unset rather than invented", async () => {
    const { data } = await db
      .from("shop_settings")
      .select("whatsapp_e164, phone_e164, contact_email, address_line, logo_media_id")
      .eq("id", true)
      .single();

    // Nothing here may ever be a plausible-looking placeholder. A number that
    // reaches nobody is worse than a visibly missing one.
    expect(data!.whatsapp_e164).toBeNull();
    expect(data!.phone_e164).toBeNull();
    expect(data!.contact_email).toBeNull();
    expect(data!.address_line).toBeNull();
    expect(data!.logo_media_id).toBeNull();
  });

  it("refuses an expiry shorter than its warning", async () => {
    const { error } = await db
      .from("shop_settings")
      .update({ reservation_warning_minutes: 60, reservation_expiry_minutes: 30 })
      .eq("id", true);

    expect(error, "an expiry before its own warning is not a schedule").not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("refuses a phone number that is not a phone number", async () => {
    const { error } = await db
      .from("shop_settings")
      .update({ whatsapp_e164: "0700 000 000" })
      .eq("id", true);
    expect(error!.code).toBe("23514");
  });
});
