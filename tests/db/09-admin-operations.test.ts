/**
 * The admin dashboard's operations, run as the people who use it.
 *
 * Build 08 proved the engine with the service-role key: the arithmetic is
 * right, the reservations are safe, the ledgers balance. That is a different
 * claim from the one this file makes, which is that a REAL SIGNED-IN STAFF
 * TOKEN can do exactly what the dashboard offers that person and nothing more.
 *
 * The distinction matters because the two halves of the dashboard reach the
 * database differently:
 *
 *   products, stock, zones   the CALLER'S session. RLS is the enforcement, and
 *                            a policy mistake shows up here as a refusal.
 *   order operations         the service role, behind `authorize()`, because
 *                            one transaction spans orders, inventory and two
 *                            ledgers. The gate is proved separately in
 *                            `src/lib/admin/permissions.test.ts`; what is
 *                            proved here is that the operations themselves do
 *                            the right thing to the shop.
 *
 * Every row is this run's fixture, and the real Owner is never read, written or
 * relied upon — `05-real-data-untouched.test.ts` proves that afterwards.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { anonClient, errorOf, PG, serviceClient, signIn } from "./support";
import { EMAIL, ID, NAMES, SKU, TEST_PHONE, ensureOwnerProfile } from "./fixtures";

type Client = SupabaseClient<Database>;

const db = serviceClient();
const anon = anonClient();
const ZONE = NAMES.slug("zone");

let staff: Client;
let manager: Client;

beforeAll(async () => {
  await ensureOwnerProfile();
  [staff, manager] = await Promise.all([signIn(EMAIL.staff), signIn(EMAIL.manager)]);
}, 120_000);

async function stock() {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved, available")
    .eq("product_id", ID.productPublic)
    .single();
  return data as { on_hand: number; reserved: number; available: number };
}

async function setStock(onHand: number): Promise<void> {
  await db.from("inventory").update({ reserved: 0 }).eq("product_id", ID.productPublic);
  await db.from("inventory").update({ on_hand: onHand }).eq("product_id", ID.productPublic);
}

async function place(quantity = 2) {
  const { data, error } = await db.rpc("jojo_place_order", {
    p_items: [{ sku: SKU.public, quantity }],
    p_customer_name: "Fixture Operations",
    p_customer_phone_e164: TEST_PHONE,
    p_zone_slug: ZONE,
    p_delivery_address: "Fixture address, plot 9",
    p_payment_preference: "cash_on_delivery",
  });
  expect(error).toBeNull();
  return data as { order_id: string; order_number: string };
}

/** The admin profile id the dashboard would pass as the actor. */
async function adminIdFor(email: string): Promise<string> {
  const { data } = await db.from("admin_profiles").select("id").eq("email", email).single();
  return (data as { id: string }).id;
}

beforeEach(async () => {
  await setStock(30);
});

/* ------------------------------------------------------------- pricing */

describe("what an Order staff member is refused", () => {
  it("cannot change a price", async () => {
    const before = await db.from("products").select("price_tzs").eq("id", ID.productPublic).single();

    const { data } = await staff
      .from("products")
      .update({ price_tzs: 999_999 })
      .eq("id", ID.productPublic)
      .select("id");

    // The policy admits no row, so the UPDATE changes nothing. That is what a
    // row-level refusal looks like: not an error, an empty result.
    expect(data ?? []).toHaveLength(0);

    const after = await db.from("products").select("price_tzs").eq("id", ID.productPublic).single();
    expect(after.data!.price_tzs).toBe(before.data!.price_tzs);
  });

  it("cannot take a product off the website", async () => {
    const { data } = await staff
      .from("products")
      .update({ storefront_visible: false })
      .eq("id", ID.productPublic)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const after = await db
      .from("products")
      .select("storefront_visible")
      .eq("id", ID.productPublic)
      .single();
    expect(after.data!.storefront_visible).toBe(true);
  });

  it("cannot add stock", async () => {
    const before = await stock();
    const { error } = await staff.rpc("jojo_add_stock", {
      p_product_id: ID.productPublic,
      p_quantity: 5,
      p_reference: "should not happen",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Owner or a Manager/i);
    expect((await stock()).on_hand).toBe(before.on_hand);
  });

  it("cannot record a stock count", async () => {
    const before = await stock();
    const { error } = await staff.rpc("jojo_count_stock", {
      p_product_id: ID.productPublic,
      p_counted: 1,
      p_reason: "should not happen",
    });

    expect(error).not.toBeNull();
    expect((await stock()).on_hand).toBe(before.on_hand);
  });

  it("cannot change a delivery area or its fee", async () => {
    const { data } = await staff
      .from("delivery_zones")
      .update({ fee_tzs: 1 })
      .eq("slug", ZONE)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const after = await db.from("delivery_zones").select("fee_tzs").eq("slug", ZONE).single();
    expect(after.data!.fee_tzs).not.toBe(1);
  });

  it("cannot promote itself to Owner", async () => {
    const id = await adminIdFor(EMAIL.staff);
    const { data } = await staff
      .from("admin_profiles")
      .update({ role: "owner" })
      .eq("id", id)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const after = await db.from("admin_profiles").select("role").eq("id", id).single();
    expect(after.data!.role).toBe("order_staff");
  });
});

/* -------------------------------------------------------------- manager */

describe("what a Manager may do", () => {
  it("changes a price, and the shelf shows it", async () => {
    const { data, error } = await manager
      .from("products")
      .update({ price_tzs: 7_500, offer_price_tzs: 6_000 })
      .eq("id", ID.productPublic)
      .select("price_tzs, offer_price_tzs")
      .single();

    expect(error).toBeNull();
    expect(data!.price_tzs).toBe(7_500);

    // `product_shelf` is what the storefront reads, and the offer price is what
    // a shopper is charged — so the change has to arrive there, not just in the
    // products table.
    const shelf = await anon
      .from("product_shelf")
      .select("effective_price_tzs")
      .eq("sku", SKU.public)
      .single();
    expect(shelf.data!.effective_price_tzs).toBe(6_000);
  });

  it("refuses an offer price that is not a discount", async () => {
    const { error } = await manager
      .from("products")
      .update({ price_tzs: 5_000, offer_price_tzs: 5_000 })
      .eq("id", ID.productPublic);

    expect(errorOf({ error }).code).toBe(PG.checkViolation);
  });

  it("adds stock through the ledger, never by overwriting a number", async () => {
    const before = await stock();

    const { data, error } = await manager.rpc("jojo_add_stock", {
      p_product_id: ID.productPublic,
      p_quantity: 12,
      p_reference: `${NAMES.token} delivery note`,
    });

    expect(error).toBeNull();
    expect((data as { available: number }).available).toBe(before.available + 12);
    expect((await stock()).on_hand).toBe(before.on_hand + 12);

    // The movement exists, is signed, and says where the goods came from.
    const { data: movement } = await db
      .from("inventory_movements")
      .select("kind, on_hand_delta, actor_admin_id, reference")
      .eq("product_id", ID.productPublic)
      .eq("reference", `${NAMES.token} delivery note`)
      .single();

    expect(movement!.kind).toBe("receipt");
    expect(movement!.on_hand_delta).toBe(12);
    expect(movement!.actor_admin_id).toBe(await adminIdFor(EMAIL.manager));
  });

  it("records a stock count as the difference, with a reason", async () => {
    const before = await stock();
    const counted = before.on_hand - 4;

    const { data, error } = await manager.rpc("jojo_count_stock", {
      p_product_id: ID.productPublic,
      p_counted: counted,
      p_reason: `${NAMES.token} stock take — four bottles damaged`,
    });

    expect(error).toBeNull();
    const result = data as { delta: number; changed: boolean; available: number };
    expect(result.changed).toBe(true);
    expect(result.delta).toBe(-4);
    expect((await stock()).on_hand).toBe(counted);
  });

  it("says nothing happened when the count already matches", async () => {
    const before = await stock();
    const { data, error } = await manager.rpc("jojo_count_stock", {
      p_product_id: ID.productPublic,
      p_counted: before.on_hand,
      p_reason: `${NAMES.token} stock take — all correct`,
    });

    expect(error).toBeNull();
    expect((data as { changed: boolean }).changed).toBe(false);
  });

  it("refuses a stock count with no reason", async () => {
    const { error } = await manager.rpc("jojo_count_stock", {
      p_product_id: ID.productPublic,
      p_counted: 3,
      p_reason: "   ",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/what was counted and why/i);
  });

  it("changes a delivery fee, and checkout quotes the new one", async () => {
    const { error } = await manager
      .from("delivery_zones")
      .update({ fee_tzs: 4_500, free_delivery: false })
      .eq("slug", ZONE);
    expect(error).toBeNull();

    const { data: quote } = await anon.rpc("jojo_quote_order", {
      p_items: [{ sku: SKU.public, quantity: 1 }],
      p_zone_slug: ZONE,
    });
    expect((quote as { delivery_fee_tzs: number }).delivery_fee_tzs).toBe(4_500);
  });

  it("cannot promote itself to Owner", async () => {
    const id = await adminIdFor(EMAIL.manager);
    const { data } = await manager
      .from("admin_profiles")
      .update({ role: "owner" })
      .eq("id", id)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const after = await db.from("admin_profiles").select("role").eq("id", id).single();
    expect(after.data!.role).toBe("manager");
  });

  it("cannot rewrite what an order was sold for", async () => {
    const order = await place(1);
    // `total_tzs` is not in the column grant on `orders`, so the request dies
    // before any policy is consulted.
    const { error } = await manager.from("orders").update({ total_tzs: 1 }).eq("id", order.order_id);
    expect(errorOf({ error }).code).toBe(PG.insufficientPrivilege);
  });
});

/* -------------------------------------------------- the dashboard journey */

describe("a staff member working an order to completion", () => {
  it("confirms, prepares, sends out and completes with cash", async () => {
    const before = await stock();
    const order = await place(3);
    const actor = await adminIdFor(EMAIL.staff);

    expect((await stock()).reserved).toBe(before.reserved + 3);

    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      const { data, error } = await db.rpc("jojo_advance_order", {
        p_order_id: order.order_id,
        p_to_state: step,
        p_actor_admin_id: actor,
      });
      expect(error, step).toBeNull();
      expect((data as { state: string }).state).toBe(step);
    }

    const { data: done, error } = await db.rpc("jojo_advance_order", {
      p_order_id: order.order_id,
      p_to_state: "completed",
      p_actor_admin_id: actor,
      p_payment_method: "cash",
    });

    expect(error).toBeNull();
    expect((done as { sold: number }).sold).toBe(3);

    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand - 3);
    expect(after.reserved).toBe(before.reserved);

    // Every step is on the record, and each one names who did it.
    const { data: events } = await db
      .from("order_events")
      .select("kind, actor_admin_id")
      .eq("order_id", order.order_id);
    expect(events!.length).toBeGreaterThanOrEqual(4);
    expect(events!.some((event) => event.actor_admin_id === actor)).toBe(true);
  });

  it("completes a digital payment with the reference the staff member typed", async () => {
    const order = await place(1);
    const actor = await adminIdFor(EMAIL.staff);

    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await db.rpc("jojo_advance_order", {
        p_order_id: order.order_id,
        p_to_state: step,
        p_actor_admin_id: actor,
      });
    }

    const { error } = await db.rpc("jojo_advance_order", {
      p_order_id: order.order_id,
      p_to_state: "completed",
      p_actor_admin_id: actor,
      p_payment_method: "digital",
      p_payment_reference: `${NAMES.token}-QK4RT77J21`,
    });
    expect(error).toBeNull();

    const { data } = await db
      .from("orders")
      .select("payment_status, payment_method, payment_reference, paid_at")
      .eq("id", order.order_id)
      .single();

    expect(data!.payment_status).toBe("paid");
    expect(data!.payment_method).toBe("digital");
    expect(data!.payment_reference).toBe(`${NAMES.token}-QK4RT77J21`);
    expect(data!.paid_at).not.toBeNull();
  });

  it("puts the stock back when the order is cancelled", async () => {
    const before = await stock();
    const order = await place(4);
    expect((await stock()).reserved).toBe(before.reserved + 4);

    const { data, error } = await db.rpc("jojo_cancel_order", {
      p_order_id: order.order_id,
      p_reason: "Customer changed mind",
      p_actor_admin_id: await adminIdFor(EMAIL.staff),
      p_actor_label: `ZZ${NAMES.token} Order Staff`,
    });

    expect(error).toBeNull();
    expect((data as { released: number }).released).toBe(4);

    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand);
    expect(after.reserved).toBe(before.reserved);
  });

  it("leaves the stock alone when a failed delivery comes back", async () => {
    const baseline = await stock();
    const order = await place(2);
    const actor = await adminIdFor(EMAIL.staff);

    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await db.rpc("jojo_advance_order", { p_order_id: order.order_id, p_to_state: step, p_actor_admin_id: actor });
    }
    const before = await stock();

    const { data, error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: true,
      p_reason: "Nobody at the address",
      p_actor_admin_id: actor,
    });

    expect(error).toBeNull();
    expect((data as { lost: number }).lost).toBe(0);

    // Nothing moves: the goods are back on the shelf and still promised to
    // this order, which can be sent out again. Releasing the promise here would
    // let the same units be sold twice over.
    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand);
    expect(after.reserved).toBe(before.reserved);
    expect(after.reserved).toBe(baseline.reserved + 2);
  });

  it("writes the stock off when a failed delivery does not come back", async () => {
    const before = await stock();
    const order = await place(2);
    const actor = await adminIdFor(EMAIL.staff);

    for (const step of ["confirmed", "preparing", "out_for_delivery"] as const) {
      await db.rpc("jojo_advance_order", { p_order_id: order.order_id, p_to_state: step, p_actor_admin_id: actor });
    }

    const { data, error } = await db.rpc("jojo_fail_delivery", {
      p_order_id: order.order_id,
      p_items_returned: false,
      p_reason: "Customer refused the order",
      p_actor_admin_id: actor,
    });

    expect(error).toBeNull();
    expect((data as { lost: number }).lost).toBe(2);

    const after = await stock();
    expect(after.on_hand).toBe(before.on_hand - 2);
    expect(after.reserved).toBe(before.reserved);
  });
});

/* ------------------------------------------------------ what the screens read */

describe("what the dashboard screens can read", () => {
  it("shows staff the orders, and shows a stranger none", async () => {
    await place(1);
    const { data: zone } = await db.from("delivery_zones").select("name").eq("slug", ZONE).single();
    const zoneName = (zone as { name: string }).name;

    const asStaff = await staff.from("orders").select("id").eq("delivery_zone_name", zoneName);
    expect(asStaff.error).toBeNull();
    expect(asStaff.data!.length).toBeGreaterThan(0);

    // `orders` is not in anon's grant list at all, so this dies on the grant.
    const asStranger = await anon.from("orders").select("id");
    expect(errorOf(asStranger).code).toBe(PG.insufficientPrivilege);
  });

  it("shows staff the customers, and shows a stranger none", async () => {
    const asStaff = await staff.from("customers").select("id, full_name").eq("phone_e164", TEST_PHONE);
    expect(asStaff.error).toBeNull();
    expect(asStaff.data!.length).toBeGreaterThan(0);

    const asStranger = await anon.from("customers").select("id");
    expect(errorOf(asStranger).code).toBe(PG.insufficientPrivilege);
  });

  it("shows staff the real stock breakdown and a stranger only what is available", async () => {
    const asStaff = await staff
      .from("inventory")
      .select("on_hand, reserved, available")
      .eq("product_id", ID.productPublic)
      .single();
    expect(asStaff.error).toBeNull();
    expect(asStaff.data!.on_hand).toBeGreaterThan(0);

    // The column grant, not a policy: a stranger may not so much as name
    // `on_hand`, which is why `getAdminCatalogue()` asks who is reading first.
    const asStranger = await anon.from("inventory").select("on_hand").eq("product_id", ID.productPublic);
    expect(errorOf(asStranger).code).toBe(PG.insufficientPrivilege);
  });

  it("gives an Order staff member no audit trail to read", async () => {
    const { data, error } = await staff.from("audit_events").select("id").limit(5);
    // Readable table, no rows admitted: the policy is Owner and Manager only.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
