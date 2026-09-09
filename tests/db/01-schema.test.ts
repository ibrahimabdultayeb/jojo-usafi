/**
 * Does PostgreSQL actually enforce the schema?
 *
 * Build 05 could only assert this statically. Every test here is a claim that
 * `docs/DATA_MODEL.md` makes and that nothing had ever checked: that the CHECK
 * constraints refuse, the append-only triggers refuse, `inventory.available`
 * really is computed by the database, and the two views mean what they say.
 *
 * Each one has a counterpart in `src/lib/domain/`, where the same rule is a
 * pure function with its own unit test. That duplication is the design: the
 * application refuses politely, the database refuses absolutely, and neither
 * one is trusted to be the only guard.
 */

import { describe, expect, it } from "vitest";
import type { TablesInsert } from "@/lib/supabase/types";
import { errorOf, isRefusedByTrigger, PG, serviceClient } from "./support";
import { ID, SKU, TEST_PHONE } from "./fixtures";

const db = serviceClient();

/**
 * A row that is valid apart from whatever the test breaks.
 *
 * Both are typed as the generated Insert shape rather than left to inference,
 * so a test that misspells a column or invents an enum member fails at
 * `npm run typecheck` instead of at 3am against Mumbai.
 */
function validProduct(overrides: Partial<TablesInsert<"products">> = {}): TablesInsert<"products"> {
  return {
    sku: "ZZTEST-TMP",
    slug: "zztest-tmp",
    family_id: ID.family,
    brand_id: ID.brand,
    category_id: ID.category,
    display_name: "ZZTEST Temporary",
    price_tzs: 5000,
    ...overrides,
  };
}

function validOrder(overrides: Partial<TablesInsert<"orders">> = {}): TablesInsert<"orders"> {
  return {
    customer_name: "ZZTEST Constraint",
    customer_phone_e164: TEST_PHONE,
    delivery_zone_name: "ZZTEST Zone",
    delivery_address: "ZZTEST address",
    delivery_fee_tzs: 4000,
    subtotal_tzs: 10_000,
    discount_tzs: 0,
    total_tzs: 14_000,
    payment_preference: "cash_on_delivery",
    ...overrides,
  };
}

describe("money is integer shillings, and the arithmetic is a constraint", () => {
  it("refuses a negative price", async () => {
    const error = errorOf(await db.from("products").insert(validProduct({ price_tzs: -1 })));
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses an offer price that is not below the price", async () => {
    const error = errorOf(
      await db.from("products").insert(validProduct({ price_tzs: 5000, offer_price_tzs: 5000 })),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("products_offer_below_price");
  });

  it("refuses an order total that is not subtotal - discount + delivery", async () => {
    const error = errorOf(await db.from("orders").insert(validOrder({ total_tzs: 13_999 })));
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("orders_total_is_derived");
  });

  it("refuses a discount larger than the subtotal", async () => {
    const error = errorOf(
      await db.from("orders").insert(
        validOrder({ subtotal_tzs: 10_000, discount_tzs: 12_000, total_tzs: 2000 }),
      ),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses a line total that is not unit price x quantity", async () => {
    const error = errorOf(
      await db.from("order_items").insert({
        order_id: ID.order,
        sku: SKU.noPhoto,
        product_name: "ZZTEST wrong arithmetic",
        quantity: 3,
        unit_price_tzs: 1000,
        line_total_tzs: 2999,
      }),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("order_items_line_total_is_derived");
  });
});

describe("SKU is the identity key", () => {
  it("refuses a SKU that does not match the pattern", async () => {
    const error = errorOf(
      await db.from("products").insert(validProduct({ sku: "zz test", slug: "zztest-bad-sku" })),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses a duplicate SKU", async () => {
    const error = errorOf(
      await db.from("products").insert(validProduct({ sku: SKU.public, slug: "zztest-dupe" })),
    );
    expect(error.code).toBe(PG.uniqueViolation);
  });

  it("refuses to rewrite a SKU that has been used on an order", async () => {
    const error = errorOf(
      await db.from("products").update({ sku: "ZZTEST-P1-RENAMED" }).eq("id", ID.productPublic),
    );
    expect(isRefusedByTrigger(error)).toBe(true);
    expect(error.message).toContain("cannot be changed");
  });

  it("allows a SKU that has never been ordered to be corrected", async () => {
    const renamed = await db
      .from("products")
      .update({ sku: "ZZTEST-P3B" })
      .eq("id", ID.productNoPhoto)
      .select("sku")
      .single();
    expect(renamed.error).toBeNull();
    expect(renamed.data?.sku).toBe("ZZTEST-P3B");

    const restored = await db
      .from("products")
      .update({ sku: SKU.noPhoto })
      .eq("id", ID.productNoPhoto)
      .select("sku")
      .single();
    expect(restored.error).toBeNull();
    expect(restored.data?.sku).toBe(SKU.noPhoto);
  });
});

describe("order payment consistency", () => {
  it("refuses paid without a method", async () => {
    const error = errorOf(
      await db.from("orders").insert(validOrder({ payment_status: "paid" })),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses a digital payment with no transaction reference", async () => {
    const error = errorOf(
      await db.from("orders").insert(
        validOrder({
          payment_status: "paid",
          payment_method: "digital",
          paid_at: new Date().toISOString(),
        }),
      ),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("orders_digital_needs_reference");
  });

  it("accepts a cash payment with no reference", async () => {
    const created = await db
      .from("orders")
      .insert(
        validOrder({
          payment_status: "paid",
          payment_method: "cash",
          paid_at: new Date().toISOString(),
        }),
      )
      .select("id, payment_status")
      .single();

    expect(created.error).toBeNull();
    expect(created.data?.payment_status).toBe("paid");
  });

  it("refuses to complete an order that has not been paid", async () => {
    const error = errorOf(
      await db.from("orders").insert(
        validOrder({ state: "completed", completed_at: new Date().toISOString() }),
      ),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses a cancellation with no reason", async () => {
    const error = errorOf(await db.from("orders").insert(validOrder({ state: "cancelled" })));
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("orders_cancelled_needs_reason");
  });

  it("refuses a delivery failure with no reason", async () => {
    const error = errorOf(
      await db.from("orders").insert(validOrder({ state: "delivery_failed" })),
    );
    expect(error.code).toBe(PG.checkViolation);
  });
});

describe("customers and delivery zones", () => {
  it("refuses a phone number that is not a Tanzanian mobile in E.164", async () => {
    for (const phone of ["0712345678", "+254712345678", "+255222110000", "+255712345"]) {
      const error = errorOf(
        await db.from("customers").insert({
          phone_e164: phone,
          full_name: "ZZTEST Bad Phone",
        }),
      );
      expect(error.code, `expected ${phone} to be refused`).toBe(PG.checkViolation);
    }
  });

  it("refuses a free delivery zone that still charges a fee", async () => {
    const error = errorOf(
      await db.from("delivery_zones").insert({
        slug: "zztest-zone-contradiction",
        name: "ZZTEST Contradiction",
        fee_tzs: 4000,
        free_delivery: true,
      }),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("delivery_zones_free_is_free");
  });

  it("defaults a new zone's fee to the approved TSh 4,000", async () => {
    const created = await db
      .from("delivery_zones")
      .insert({ slug: "zztest-zone-default", name: "ZZTEST Default Fee" })
      .select("fee_tzs, free_delivery")
      .single();

    expect(created.error).toBeNull();
    expect(created.data?.fee_tzs).toBe(4000);
    expect(created.data?.free_delivery).toBe(false);
  });
});

describe("inventory: available is computed by the database", () => {
  it("stores available as on_hand - reserved", async () => {
    const { data, error } = await db
      .from("inventory")
      .select("on_hand, reserved, available")
      .eq("product_id", ID.productPublic)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ on_hand: 10, reserved: 3, available: 7 });
  });

  it("recomputes available when on_hand changes, without being told to", async () => {
    const updated = await db
      .from("inventory")
      .update({ on_hand: 12 })
      .eq("product_id", ID.productPublic)
      .select("on_hand, reserved, available")
      .single();

    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({ on_hand: 12, reserved: 3, available: 9 });

    await db.from("inventory").update({ on_hand: 10 }).eq("product_id", ID.productPublic);
  });

  it("refuses to write available directly — it is generated, not stored by callers", async () => {
    // Worth knowing: `supabase gen types` does NOT mark a GENERATED ALWAYS
    // column as read-only, so `available` appears in the generated Insert and
    // Update types and this line compiles. The database is the thing that says
    // no — 428C9, generated_always — which is exactly why this test exists.
    const error = errorOf(
      await db.from("inventory").update({ available: 999 }).eq("product_id", ID.productPublic),
    );
    expect(error.code).toBe("428C9");
    expect(error.message).toContain("available");
  });

  it("refuses to reserve more stock than is physically present", async () => {
    const error = errorOf(
      await db.from("inventory").update({ reserved: 99 }).eq("product_id", ID.productPublic),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("inventory_reserved_within_on_hand");
  });

  it("refuses negative stock", async () => {
    const error = errorOf(
      await db.from("inventory").update({ on_hand: -1 }).eq("product_id", ID.productHidden),
    );
    expect(error.code).toBe(PG.checkViolation);
  });
});

describe("the stock ledger only moves stock in the direction each kind claims", () => {
  type MovementInsert = TablesInsert<"inventory_movements">;
  const movement = (
    overrides: Pick<MovementInsert, "kind"> & Partial<MovementInsert>,
  ): MovementInsert => ({
    product_id: ID.productPublic,
    location_code: "main",
    on_hand_delta: 0,
    reserved_delta: 0,
    ...overrides,
  });

  it("refuses a receipt that removes stock", async () => {
    const error = errorOf(
      await db.from("inventory_movements").insert(movement({ kind: "receipt", on_hand_delta: -5 })),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("inventory_movements_kind_shape");
  });

  it("refuses a reservation that touches on_hand", async () => {
    const error = errorOf(
      await db
        .from("inventory_movements")
        .insert(movement({ kind: "reservation", on_hand_delta: -1, reserved_delta: 1, order_id: ID.order })),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("refuses a movement that changes nothing", async () => {
    const error = errorOf(
      await db.from("inventory_movements").insert(movement({ kind: "stock_count", reason: "ZZTEST" })),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("inventory_movements_not_empty");
  });

  it("requires a reason for a correction, a count and a loss", async () => {
    for (const kind of ["correction", "stock_count", "damage_loss"] as const) {
      const error = errorOf(
        await db.from("inventory_movements").insert(movement({ kind, on_hand_delta: -1 })),
      );
      expect(error.code, `expected ${kind} to require a reason`).toBe(PG.checkViolation);
      expect(error.message).toContain("inventory_movements_reason_required");
    }
  });

  it("requires an order for the four order-driven kinds", async () => {
    const error = errorOf(
      await db.from("inventory_movements").insert(movement({ kind: "reservation", reserved_delta: 1 })),
    );
    expect(error.code).toBe(PG.checkViolation);
    expect(error.message).toContain("inventory_movements_order_required");
  });

  it("accepts a well-formed correction, and a compensating one to undo it", async () => {
    const created = await db
      .from("inventory_movements")
      .insert(
        movement({ kind: "correction", on_hand_delta: 1, reason: "ZZTEST recount after breakage" }),
      )
      .select("id, kind")
      .single();

    expect(created.error).toBeNull();
    expect(created.data?.kind).toBe("correction");

    // The ledger cannot be edited, so a movement is undone by writing its
    // opposite — the pattern docs/DATA_MODEL.md describes. It also leaves the
    // ledger summing to the same total the running figures hold, which the
    // reconciliation test below depends on.
    const undone = await db
      .from("inventory_movements")
      .insert(movement({ kind: "correction", on_hand_delta: -1, reason: "ZZTEST undo recount" }))
      .select("id")
      .single();

    expect(undone.error).toBeNull();
  });
});

describe("history is append-only, for everyone including the service role", () => {
  it("refuses to edit an order event", async () => {
    const error = errorOf(
      await db.from("order_events").update({ summary: "rewritten" }).eq("id", ID.orderEvent),
    );
    expect(isRefusedByTrigger(error)).toBe(true);
    expect(error.message).toContain("append-only");
  });

  it("refuses to delete an order event", async () => {
    const error = errorOf(await db.from("order_events").delete().eq("id", ID.orderEvent));
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("refuses to delete a stock movement", async () => {
    const error = errorOf(
      await db.from("inventory_movements").delete().eq("product_id", ID.productPublic),
    );
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("refuses to delete an analytics event", async () => {
    const inserted = await db
      .from("analytics_events")
      .insert({ kind: "page_view", session_id: "zztest-append-only", path: "/" })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const error = errorOf(await db.from("analytics_events").delete().eq("id", inserted.data!.id));
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("refuses to delete an audit event", async () => {
    const inserted = await db
      .from("audit_events")
      .insert({ action: "zztest.append_only", entity_table: "products", entity_key: "zztest" })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const error = errorOf(await db.from("audit_events").delete().eq("id", inserted.data!.id));
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("therefore refuses to delete an order that has history, even by cascade", async () => {
    // order_events cascades from orders, and then the append-only trigger
    // refuses the cascade. An order that has happened cannot be unhappened.
    const error = errorOf(await db.from("orders").delete().eq("id", ID.order));
    expect(isRefusedByTrigger(error)).toBe(true);
  });
});

describe("updated_at is maintained by the database", () => {
  it("moves forward on update without the caller setting it", async () => {
    const before = await db
      .from("delivery_zones")
      .select("updated_at")
      .eq("id", ID.zone)
      .single();
    expect(before.error).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const after = await db
      .from("delivery_zones")
      .update({ notes: `ZZTEST touch ${Date.now()}` })
      .eq("id", ID.zone)
      .select("updated_at")
      .single();

    expect(after.error).toBeNull();
    expect(new Date(after.data!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.data!.updated_at).getTime(),
    );
  });
});

describe("product_shelf is the one definition of what a shopper may see", () => {
  it("carries the product that is active, visible and photographed", async () => {
    const { data, error } = await db
      .from("product_shelf")
      .select("sku, effective_price_tzs, available, in_stock, low_stock, image_path, brand_name")
      .eq("sku", SKU.public)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      sku: SKU.public,
      effective_price_tzs: 10_000,
      available: 7,
      in_stock: true,
      low_stock: false,
      brand_name: "ZZTEST Brand",
    });
    expect(data?.image_path).toBe("zztest/zztest-p1-primary-1.webp");
  });

  it("excludes a product that is switched off for the storefront", async () => {
    const { data } = await db.from("product_shelf").select("sku").eq("sku", SKU.hidden);
    expect(data).toEqual([]);
  });

  it("excludes a product with no approved photograph, however visible it is", async () => {
    const { data } = await db.from("product_shelf").select("sku").eq("sku", SKU.noPhoto);
    expect(data).toEqual([]);
  });

  it("prefers the offer price when there is one", async () => {
    await db.from("products").update({ offer_price_tzs: 7500 }).eq("id", ID.productPublic);

    const { data } = await db
      .from("product_shelf")
      .select("price_tzs, offer_price_tzs, effective_price_tzs")
      .eq("sku", SKU.public)
      .single();

    expect(data).toMatchObject({
      price_tzs: 10_000,
      offer_price_tzs: 7500,
      effective_price_tzs: 7500,
    });

    await db.from("products").update({ offer_price_tzs: null }).eq("id", ID.productPublic);
  });

  it("reports low stock against the product's own threshold", async () => {
    await db.from("inventory").update({ on_hand: 5, reserved: 4 }).eq("product_id", ID.productPublic);

    const { data } = await db
      .from("product_shelf")
      .select("available, in_stock, low_stock")
      .eq("sku", SKU.public)
      .single();

    expect(data).toMatchObject({ available: 1, in_stock: true, low_stock: true });

    await db.from("inventory").update({ on_hand: 10, reserved: 3 }).eq("product_id", ID.productPublic);
  });
});

describe("inventory_ledger_check proves the running total against the ledger", () => {
  it("agrees where every change was written as a movement", async () => {
    const { data, error } = await db
      .from("inventory_ledger_check")
      .select("on_hand, reserved, ledger_on_hand, ledger_reserved, matches")
      .eq("product_id", ID.productPublic)
      .single();

    expect(error).toBeNull();
    // 10 received and 3 reserved, plus a correction and its compensating
    // opposite, which cancel: the ledger still sums to the running totals.
    expect(data).toMatchObject({
      on_hand: 10,
      reserved: 3,
      ledger_on_hand: 10,
      ledger_reserved: 3,
      matches: true,
    });
  });

  it("disagrees where stock was set without writing a movement", async () => {
    const { data, error } = await db
      .from("inventory_ledger_check")
      .select("on_hand, ledger_on_hand, matches")
      .eq("product_id", ID.productHidden)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ on_hand: 5, ledger_on_hand: 0, matches: false });
  });
});
