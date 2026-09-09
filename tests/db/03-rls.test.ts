/**
 * Row Level Security: the authorization boundary, exercised as four callers.
 *
 * `docs/DATA_MODEL.md` has claimed since Build 05 that "admin access is scoped
 * by role — Owner / Manager / Order Staff". Until this file ran, that was an
 * intention. Every test here signs in as a real Supabase Auth user holding a
 * real session token and asks the real PostgREST endpoint, so a pass means the
 * database refused, not that a React component declined to render a button.
 *
 * Two different kinds of "no" appear throughout, and the difference matters:
 *
 *   42501, an ERROR      the GRANT refused. The role may not touch that table,
 *                        that column, or with that verb, at all — the request
 *                        dies before any row is looked at.
 *
 *   [], an EMPTY RESULT  the POLICY refused. The role may read the table; no
 *                        row in it is theirs. This is what a SELECT denial
 *                        looks like, and asserting an error instead would be
 *                        asserting the wrong thing.
 *
 * An UPDATE the policy refuses is likewise not an error: it changes zero rows.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { anonClient, errorOf, PG, serviceClient, signIn } from "./support";
import { ANALYTICS_SESSION, EMAIL, ID, SKU, ensureOwnerProfile } from "./fixtures";

type Client = SupabaseClient<Database>;

const db = serviceClient();
const anon = anonClient();

let nobody: Client;
let staff: Client;
let manager: Client;
let owner: Client;

beforeAll(async () => {
  await ensureOwnerProfile();
  [nobody, staff, manager, owner] = await Promise.all([
    signIn(EMAIL.nobody),
    signIn(EMAIL.staff),
    signIn(EMAIL.manager),
    signIn(EMAIL.owner),
  ]);
}, 120_000);

/** The ZZTEST rows of a table, so unrelated data cannot affect the count. */
const zzProducts = (client: Client) => client.from("products").select("sku").like("sku", "ZZTEST%");

describe("a shopper who has not signed in", () => {
  it("sees the shelf", async () => {
    const { data, error } = await anon
      .from("product_shelf")
      .select("sku, display_name, effective_price_tzs, in_stock")
      .like("sku", "ZZTEST%");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ sku: SKU.public, in_stock: true });
  });

  it("sees active, visible products and nothing else", async () => {
    const { data, error } = await zzProducts(anon);
    expect(error).toBeNull();
    expect(data!.map((row) => row.sku).sort()).toEqual([SKU.public, SKU.noPhoto].sort());
  });

  it("sees a photograph only because a public product uses it", async () => {
    const { data, error } = await anon
      .from("media_assets")
      .select("storage_path")
      .like("storage_path", "zztest/%");

    expect(error).toBeNull();
    expect(data!.map((row) => row.storage_path)).toEqual(["zztest/zztest-p1-primary-1.webp"]);
  });

  it("sees only active brands", async () => {
    const { data } = await anon.from("brands").select("code").like("code", "ZZTEST%");
    expect(data!.map((row) => row.code)).toEqual(["ZZTEST-BR"]);
  });

  it("sees active delivery zones, because checkout must price delivery", async () => {
    const { data, error } = await anon.from("delivery_zones").select("name, fee_tzs").eq("id", ID.zone);
    expect(error).toBeNull();
    expect(data![0]).toMatchObject({ name: "ZZTEST Zone", fee_tzs: 4000 });
  });

  it("may learn that stock is available, but not how the shop's stock breaks down", async () => {
    const allowed = await anon
      .from("inventory")
      .select("product_id, available")
      .eq("product_id", ID.productPublic);
    expect(allowed.error).toBeNull();
    expect(allowed.data![0]).toMatchObject({ available: 7 });

    const refused = errorOf(
      await anon.from("inventory").select("on_hand, reserved").eq("product_id", ID.productPublic),
    );
    expect(refused.code).toBe(PG.insufficientPrivilege);
  });

  it("cannot so much as name the tables that are none of its business", async () => {
    const closed = [
      "suppliers",
      "customers",
      "customer_addresses",
      "orders",
      "order_items",
      "order_events",
      "inventory_movements",
      "admin_profiles",
      "audit_events",
      "sync_jobs",
      "sync_events",
      "sync_state",
      "sync_conflicts",
    ] as const;

    for (const table of closed) {
      const error = errorOf(await anon.from(table).select("*").limit(1));
      expect(error.code, `expected anon to be refused ${table}`).toBe(PG.insufficientPrivilege);
    }
  });

  it("cannot ask whether the shop's stock figures reconcile", async () => {
    const error = errorOf(await anon.from("inventory_ledger_check").select("*").limit(1));
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("cannot write to the catalogue", async () => {
    const inserted = errorOf(
      await anon.from("products").insert({
        sku: "ZZTEST-HACK",
        slug: "zztest-hack",
        family_id: ID.family,
        brand_id: ID.brand,
        category_id: ID.category,
        display_name: "ZZTEST Injected",
        price_tzs: 1,
      }),
    );
    expect(inserted.code).toBe(PG.insufficientPrivilege);

    const updated = errorOf(
      await anon.from("products").update({ price_tzs: 1 }).eq("id", ID.productPublic),
    );
    expect(updated.code).toBe(PG.insufficientPrivilege);
  });

  it("cannot read the roster of staff identity functions", async () => {
    for (const fn of ["jojo_admin_role", "jojo_is_staff", "jojo_manages_catalogue"] as const) {
      const error = errorOf(await anon.rpc(fn));
      expect(error.code, `expected anon to be refused ${fn}`).toBe(PG.insufficientPrivilege);
    }
  });

  it("cannot burn order numbers off the shop's sequence", async () => {
    const error = errorOf(await anon.rpc("next_order_number"));
    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

describe("storefront measurement is the one thing a browser writes", () => {
  it("accepts a browsing event", async () => {
    const { error } = await anon.from("analytics_events").insert({
      kind: "product_view",
      session_id: ANALYTICS_SESSION,
      sku: SKU.public,
      path: "/products/zztest-p1",
    });
    expect(error).toBeNull();
  });

  it("refuses an event that claims the shop completed an order", async () => {
    for (const kind of ["order_created", "order_completed", "order_confirmed"] as const) {
      const error = errorOf(
        await anon.from("analytics_events").insert({ kind, session_id: ANALYTICS_SESSION }),
      );
      expect(error.code, `expected ${kind} to be refused`).toBe(PG.insufficientPrivilege);
    }
  });

  it("refuses an event that attaches itself to a customer or an order", async () => {
    const withOrder = errorOf(
      await anon.from("analytics_events").insert({
        kind: "product_view",
        session_id: ANALYTICS_SESSION,
        order_id: ID.order,
      }),
    );
    expect(withOrder.code).toBe(PG.insufficientPrivilege);

    const withCustomer = errorOf(
      await anon.from("analytics_events").insert({
        kind: "product_view",
        session_id: ANALYTICS_SESSION,
        customer_id: ID.customer,
      }),
    );
    expect(withCustomer.code).toBe(PG.insufficientPrivilege);
  });

  it("is write-only: the browser cannot read the measurement stream back", async () => {
    const error = errorOf(await anon.from("analytics_events").select("kind").limit(1));
    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

describe("a signed-in account that is neither staff nor a customer", () => {
  it("sees the same shelf as a stranger and no more", async () => {
    const { data, error } = await zzProducts(nobody);
    expect(error).toBeNull();
    expect(data!.map((row) => row.sku).sort()).toEqual([SKU.public, SKU.noPhoto].sort());
  });

  it("is allowed to ask about orders, customers and staff, and is told nothing", async () => {
    for (const table of ["orders", "customers", "admin_profiles", "suppliers", "audit_events"] as const) {
      const { data, error } = await nobody.from(table).select("*").limit(5);
      expect(error, `${table} should be readable-but-empty, not an error`).toBeNull();
      expect(data, `expected no rows from ${table}`).toEqual([]);
    }
  });

  it("cannot create a product", async () => {
    const error = errorOf(
      await nobody.from("products").insert({
        sku: "ZZTEST-NOBODY",
        slug: "zztest-nobody",
        family_id: ID.family,
        brand_id: ID.brand,
        category_id: ID.category,
        display_name: "ZZTEST Nobody",
        price_tzs: 1,
      }),
    );
    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

describe("Order staff: advance orders, change nothing else", () => {
  it("sees every product, including the ones no shopper can", async () => {
    const { data, error } = await zzProducts(staff);
    expect(error).toBeNull();
    expect(data!.map((row) => row.sku).sort()).toEqual([SKU.public, SKU.hidden, SKU.noPhoto].sort());
  });

  it("sees orders, their lines and their history", async () => {
    const order = await staff.from("orders").select("id, state").eq("id", ID.order).single();
    expect(order.error).toBeNull();
    expect(order.data?.id).toBe(ID.order);

    const items = await staff.from("order_items").select("sku").eq("order_id", ID.order);
    expect(items.data!.map((row) => row.sku)).toContain(SKU.public);

    const events = await staff.from("order_events").select("kind").eq("order_id", ID.order);
    expect(events.data!.length).toBeGreaterThan(0);
  });

  it("sees customers, so an order can be chased by telephone", async () => {
    const { data, error } = await staff.from("customers").select("full_name").eq("id", ID.customer);
    expect(error).toBeNull();
    expect(data![0]?.full_name).toBe("ZZTEST Customer");
  });

  it("advances an order", async () => {
    const { data, error } = await staff
      .from("orders")
      .update({ state: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", ID.order)
      .select("state");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].state).toBe("confirmed");

    await db.from("orders").update({ state: "new", confirmed_at: null }).eq("id", ID.order);
  });

  it("cannot rewrite what the order cost", async () => {
    for (const patch of [
      { total_tzs: 1 },
      { subtotal_tzs: 1 },
      { delivery_fee_tzs: 0 },
      { discount_tzs: 999 },
      { customer_phone_e164: "+255700000009" },
    ]) {
      const error = errorOf(await staff.from("orders").update(patch).eq("id", ID.order));
      expect(error.code, `expected ${JSON.stringify(patch)} to be refused`).toBe(
        PG.insufficientPrivilege,
      );
    }

    const unchanged = await db
      .from("orders")
      .select("total_tzs, subtotal_tzs, delivery_fee_tzs")
      .eq("id", ID.order)
      .single();
    expect(unchanged.data).toMatchObject({
      total_tzs: 24_000,
      subtotal_tzs: 20_000,
      delivery_fee_tzs: 4000,
    });
  });

  it("cannot change a price, a delivery fee or a customer record", async () => {
    const price = await staff
      .from("products")
      .update({ price_tzs: 1 })
      .eq("id", ID.productPublic)
      .select("id");
    expect(price.error).toBeNull();
    expect(price.data, "the policy should change no rows").toEqual([]);

    const zone = await staff.from("delivery_zones").update({ fee_tzs: 0 }).eq("id", ID.zone).select("id");
    expect(zone.data).toEqual([]);

    const customer = await staff
      .from("customers")
      .update({ full_name: "Renamed" })
      .eq("id", ID.customer)
      .select("id");
    expect(customer.data).toEqual([]);
  });

  it("cannot see supplier terms, the audit trail, the sync log or the analytics", async () => {
    for (const table of ["suppliers", "audit_events", "sync_jobs", "sync_conflicts", "analytics_events"] as const) {
      const { data, error } = await staff.from(table).select("*").limit(5);
      expect(error, `${table}`).toBeNull();
      expect(data, `expected Order staff to see nothing in ${table}`).toEqual([]);
    }
  });

  it("cannot manage staff", async () => {
    const error = errorOf(
      await staff.from("admin_profiles").insert({
        full_name: "ZZTEST Self Promoted",
        email: "zztest-self@jojo-usafi.test",
        role: "owner",
      }),
    );
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("cannot delete anything at all", async () => {
    for (const table of ["orders", "products", "customers"] as const) {
      const error = errorOf(await staff.from(table).delete().eq("id", ID.order));
      expect(error.code, `expected DELETE on ${table} to be refused`).toBe(PG.insufficientPrivilege);
    }
  });

  it("adds to an order's history, signed as itself", async () => {
    const { data: adminId } = await staff.rpc("jojo_admin_id");

    const written = await staff
      .from("order_events")
      .insert({
        order_id: ID.order,
        kind: "note_added",
        actor_type: "staff",
        actor_admin_id: adminId,
        summary: "ZZTEST rang the customer",
      })
      .select("id");

    expect(written.error).toBeNull();
    expect(written.data).toHaveLength(1);
  });

  it("cannot sign an order event as somebody else", async () => {
    const error = errorOf(
      await staff.from("order_events").insert({
        order_id: ID.order,
        kind: "note_added",
        actor_type: "staff",
        actor_admin_id: ID.profileManager,
        summary: "ZZTEST forged",
      }),
    );
    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

describe("Manager: runs the shop, does not run the staff", () => {
  it("changes a price", async () => {
    const { data, error } = await manager
      .from("products")
      .update({ price_tzs: 11_000 })
      .eq("id", ID.productPublic)
      .select("price_tzs");

    expect(error).toBeNull();
    expect(data![0].price_tzs).toBe(11_000);

    await db.from("products").update({ price_tzs: 10_000 }).eq("id", ID.productPublic);
  });

  it("changes a delivery zone and a customer record", async () => {
    const zone = await manager
      .from("delivery_zones")
      .update({ fee_tzs: 5000 })
      .eq("id", ID.zone)
      .select("fee_tzs");
    expect(zone.error).toBeNull();
    expect(zone.data![0].fee_tzs).toBe(5000);
    await db.from("delivery_zones").update({ fee_tzs: 4000 }).eq("id", ID.zone);

    const customer = await manager
      .from("customers")
      .update({ notes: "ZZTEST prefers mornings" })
      .eq("id", ID.customer)
      .select("id");
    expect(customer.data).toHaveLength(1);
  });

  it("writes the stock movements a human performs", async () => {
    const { data, error } = await manager
      .from("inventory_movements")
      .insert({
        product_id: ID.productPublic,
        location_code: "main",
        kind: "receipt",
        on_hand_delta: 5,
        reserved_delta: 0,
        reference: "ZZTEST delivery note",
      })
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    await manager.from("inventory_movements").insert({
      product_id: ID.productPublic,
      location_code: "main",
      kind: "correction",
      on_hand_delta: -5,
      reserved_delta: 0,
      reason: "ZZTEST undo the test receipt",
    });
  });

  it("cannot write the movements that belong to an order", async () => {
    for (const kind of ["reservation", "sale", "reservation_release"] as const) {
      const error = errorOf(
        await manager.from("inventory_movements").insert({
          product_id: ID.productPublic,
          location_code: "main",
          kind,
          on_hand_delta: kind === "sale" ? -1 : 0,
          reserved_delta: kind === "reservation_release" || kind === "sale" ? -1 : 1,
          order_id: ID.order,
        }),
      );
      expect(error.code, `expected ${kind} to be refused`).toBe(PG.insufficientPrivilege);
    }
  });

  it("reads supplier terms, the audit trail, the sync log and the analytics", async () => {
    for (const table of ["suppliers", "audit_events", "sync_jobs", "analytics_events"] as const) {
      const { error } = await manager.from(table).select("*").limit(1);
      expect(error, `${table} should be readable by a Manager`).toBeNull();
    }

    const suppliers = await manager.from("suppliers").select("code").like("code", "ZZTEST%");
    expect(suppliers.data!.map((row) => row.code)).toEqual(["ZZTEST-SUP"]);
  });

  it("cannot add or change staff", async () => {
    const inserted = errorOf(
      await manager.from("admin_profiles").insert({
        full_name: "ZZTEST Manager's Friend",
        email: "zztest-friend@jojo-usafi.test",
        role: "manager",
      }),
    );
    expect(inserted.code).toBe(PG.insufficientPrivilege);

    const promoted = await manager
      .from("admin_profiles")
      .update({ role: "owner" })
      .eq("id", ID.profileManager)
      .select("id");
    expect(promoted.error).toBeNull();
    expect(promoted.data, "a Manager must not be able to promote themselves").toEqual([]);
  });
});

describe("Owner: the only one who manages staff", () => {
  it("adds a staff member", async () => {
    const { data, error } = await owner
      .from("admin_profiles")
      .insert({
        full_name: "ZZTEST New Staff",
        email: "zztest-new@jojo-usafi.test",
        role: "order_staff",
      })
      .select("id, role");

    expect(error).toBeNull();
    expect(data![0].role).toBe("order_staff");

    await db.from("admin_profiles").delete().eq("id", data![0].id);
  });

  it("changes a staff member's role", async () => {
    const promoted = await owner
      .from("admin_profiles")
      .update({ role: "manager" })
      .eq("id", ID.profileStaff)
      .select("role");

    expect(promoted.error).toBeNull();
    expect(promoted.data![0].role).toBe("manager");

    await db.from("admin_profiles").update({ role: "order_staff" }).eq("id", ID.profileStaff);
  });

  it("still cannot delete through the API — deactivation is the way", async () => {
    const error = errorOf(await owner.from("admin_profiles").delete().eq("id", ID.profileStaff));
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("reads the reconciliation view that no shopper can", async () => {
    const { data, error } = await owner
      .from("inventory_ledger_check")
      .select("product_id, matches")
      .eq("product_id", ID.productPublic);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
