/**
 * The real catalogue, as a shopper's browser actually receives it.
 *
 * Everything here reads with the ANON key — no session, no service role — so a
 * pass means Row Level Security and the Storage policies produced this, not
 * that a query was written carefully. If a withheld product could reach the
 * shelf, these tests would see it, because they are looking through exactly the
 * same window the storefront looks through.
 *
 * These assertions are about the REAL rows, not this run's fixtures, so they
 * exclude anything carrying the run token.
 */

import { describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "./support";
import { NAMES } from "./fixtures";

const anon = anonClient();
const db = serviceClient();

/** The real shelf: everything the anon key can see that this run did not create. */
async function realShelf() {
  const { data, error } = await anon
    .from("product_shelf")
    .select("sku, slug, display_name, price_tzs, effective_price_tzs, image_bucket, image_path, brand_name, category_name, available, in_stock")
    .not("sku", "like", `${NAMES.skuPrefix}%`);

  expect(error).toBeNull();
  return data ?? [];
}

describe("the real catalogue reached the database", () => {
  it("puts 95 products on the public shelf", async () => {
    const shelf = await realShelf();
    expect(shelf).toHaveLength(95);
  });

  it("keeps all 201 master rows, with 106 withheld", async () => {
    // Counted with the service role, because a shopper is not allowed to know
    // how many products the shop is holding back — which is the point.
    const all = await db.from("products").select("sku", { count: "exact", head: true }).not("sku", "like", `${NAMES.skuPrefix}%`);
    expect(all.count).toBe(201);

    const hidden = await db
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("storefront_visible", false)
      .not("sku", "like", `${NAMES.skuPrefix}%`);
    expect(hidden.count).toBe(106);
  });

  it("gives every shelf product a photograph filed under its own SKU", async () => {
    const shelf = await realShelf();
    const wrong = shelf.filter((row) => !row.image_path?.startsWith(`${row.sku}/`));
    expect(wrong.map((row) => `${row.sku} -> ${row.image_path}`)).toEqual([]);
    expect(shelf.every((row) => row.image_bucket === "product-media")).toBe(true);
  });

  it("keeps EP01-A01 off the shelf, at its unchanged suspicious price", async () => {
    const shelf = await realShelf();
    expect(shelf.find((row) => row.sku === "EP01-A01")).toBeUndefined();

    const { data } = await db
      .from("products")
      .select("price_tzs, storefront_visible, lifecycle")
      .eq("sku", "EP01-A01")
      .single();

    // Imported exactly as the master states it. Never corrected by inference.
    expect(data).toMatchObject({ price_tzs: 128, storefront_visible: false, lifecycle: "active" });
  });

  it("never invented a product for the orphan photograph EP23-A02", async () => {
    const { count } = await db
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("sku", "EP23-A02");
    expect(count).toBe(0);
  });

  it("gives every shelf product a brand, a category and a price", async () => {
    const shelf = await realShelf();
    for (const row of shelf) {
      expect(row.brand_name, row.sku!).toBeTruthy();
      expect(row.category_name, row.sku!).toBeTruthy();
      expect(row.price_tzs, row.sku!).toBeGreaterThan(0);
      expect(row.effective_price_tzs, row.sku!).toBeGreaterThan(0);
    }
  });
});

describe("the photographs are really in Storage and really fetchable", () => {
  it("holds one object per shelf product, under its SKU", async () => {
    const shelf = await realShelf();
    const { data, error } = await db.storage.from("product-media").list("", { limit: 1000 });
    expect(error).toBeNull();

    const folders = new Set((data ?? []).filter((entry) => entry.id === null).map((e) => e.name));
    const missing = shelf.filter((row) => !folders.has(row.sku!)).map((row) => row.sku);
    expect(missing).toEqual([]);
  });

  it("serves them publicly, as images, without a session", async () => {
    const shelf = await realShelf();
    // A sample rather than all 95: this is a network assertion about the policy,
    // not about each file, and the SKU↔path mapping is checked above for all.
    const sample = [shelf[0], shelf[Math.floor(shelf.length / 2)], shelf[shelf.length - 1]];

    for (const row of sample) {
      const url = anon.storage.from(row.image_bucket!).getPublicUrl(row.image_path!).data.publicUrl;
      const response = await fetch(url);
      expect(response.status, `${row.sku} at ${url}`).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/webp");
    }
  }, 60_000);
});

describe("importing it did not open anything up", () => {
  it("still refuses a shopper the supplier list and the stock breakdown", async () => {
    const suppliers = await anon.from("suppliers").select("code").limit(1);
    expect(suppliers.error?.code).toBe("42501");

    const stock = await anon.from("inventory").select("on_hand").limit(1);
    expect(stock.error?.code).toBe("42501");

    // ...but availability, which the shelf needs, is readable.
    const available = await anon.from("inventory").select("product_id, available").limit(1);
    expect(available.error).toBeNull();
  });

  it("still refuses a shopper the import audit trail", async () => {
    const audit = await anon.from("audit_events").select("action").limit(1);
    expect(audit.error?.code).toBe("42501");

    const { count } = await db
      .from("audit_events")
      .select("action", { count: "exact", head: true })
      .eq("action", "catalogue.imported");
    expect(count, "the import recorded itself").toBeGreaterThan(0);
  });

  it("cannot be written to by a shopper", async () => {
    const update = await anon.from("products").update({ price_tzs: 1 }).eq("sku", "EP01-A02");
    expect(update.error?.code).toBe("42501");

    const upload = await anon.storage
      .from("product-media")
      .upload("EP01-A02/hijacked.webp", new Blob([new Uint8Array([1])], { type: "image/webp" }));
    expect(upload.error).not.toBeNull();
  });
});

describe("stock was initialised from the master, and adds up", () => {
  it("has an inventory row for every product, with nothing reserved", async () => {
    const { data, error } = await db
      .from("inventory")
      .select("product_id, on_hand, reserved, available, products!inner(sku)")
      .not("products.sku", "like", `${NAMES.skuPrefix}%`);

    expect(error).toBeNull();
    expect(data).toHaveLength(201);
    expect(data!.every((row) => row.reserved === 0)).toBe(true);
    expect(data!.every((row) => row.available === row.on_hand)).toBe(true);
  });

  it("agrees with its own ledger", async () => {
    // This run's fixtures include a product whose running total deliberately
    // does NOT match its ledger — that is how `inventory_ledger_check` is
    // proved to be capable of saying "no" (see 01-schema.test.ts). It must not
    // be counted against the real catalogue.
    const fixtures = await db
      .from("products")
      .select("id")
      .like("sku", `${NAMES.skuPrefix}%`);
    const fixtureIds = new Set((fixtures.data ?? []).map((row) => row.id));

    const { data, error } = await db
      .from("inventory_ledger_check")
      .select("product_id, matches, on_hand, ledger_on_hand");

    expect(error).toBeNull();
    const disagreeing = (data ?? []).filter(
      (row) => row.matches === false && !fixtureIds.has(row.product_id!),
    );
    expect(disagreeing).toEqual([]);
  });

  it("explains every opening balance with a receipt movement", async () => {
    const { data, error } = await db
      .from("inventory_movements")
      .select("kind, reference, products!inner(sku)")
      .eq("kind", "receipt")
      .not("products.sku", "like", `${NAMES.skuPrefix}%`);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(
      data!.every((row) => (row.reference ?? "").startsWith("Initial catalogue import")),
      "opening stock must say where it came from",
    ).toBe(true);
  });
});
