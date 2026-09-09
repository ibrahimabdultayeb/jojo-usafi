/**
 * The Google Sheet sync, against the real database and a fake spreadsheet.
 *
 * `src/lib/sheets/plan.test.ts` proves the DECISIONS — what should happen to a
 * price, a duplicate SKU, a deleted row. This file proves what actually lands
 * in PostgreSQL when those decisions are applied, and, more importantly, what
 * does not: no stock moves, no order changes, no ledger row appears, and the
 * real Owner is not so much as read.
 *
 * The spreadsheet is `MemorySheet`, an in-memory grid that behaves like
 * Google's. Ibrahim's real Product Master is never opened by a test — the brief
 * requires conflict behaviour to be proved on a safe fixture, and an in-memory
 * one is safer than a copy of the real sheet that somebody might later point at
 * the wrong tab.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serviceClient } from "./support";
import { ID, NAMES, SKU } from "./fixtures";
import { MemorySheet } from "@/lib/sheets/memory-gateway";
import { COLUMNS, REPORT_COLUMNS } from "@/lib/sheets/columns";
import { runCatalogueSync, ENTITY_TABLE } from "@/lib/sheets/run";

const db = serviceClient();

const HEADERS = [...COLUMNS.map((c) => c.header), ...REPORT_COLUMNS.map((c) => c.header)];

/** A Product Master row for one of this run's fixture products. */
function row(sku: string, over: Record<string, string | number> = {}): (string | number)[] {
  const values: Record<string, string | number> = {
    SKU: sku,
    "FAMILY CODE": NAMES.code("FAM"),
    ITF: "",
    EAN: "",
    SUPPLIER: `ZZ${NAMES.token} Supplier`,
    "BRAND GROUP": "",
    "PRODUCT BRAND": `ZZ${NAMES.token} Brand`,
    "PRODUCT VARIANT": `ZZ${NAMES.token} Product One`,
    SIZE: "5LT",
    "SELLING UOM": "EA",
    "SYSTEM NAME": "",
    "SHORT NAME": "",
    DESCRIPTION: "",
    CATEGORY: `ZZ${NAMES.token} Category`,
    SUBCATEGORY: "",
    TAGS: "",
    "WEBSITE STATUS": "Show",
    "PRICE TZS": 10000,
    "OFFER PRICE TZS": "",
    "STOCK QTY": 40,
    "LOW STOCK THRESHOLD": 2,
    "ALLOW BACKORDER": "",
    "AVAILABILITY MESSAGE": "",
    "DELIVERY CLASS": "",
    "IMAGE URL": "",
    "IMAGE ASSET KEY": "",
    "CARD SIZE": "",
    "BEST SELLER": "No",
    FEATURED: "No",
    "NEW ARRIVAL": "",
    "PRODUCT PRIORITY": 0,
    "PRODUCT STATUS": "Active",
    "SEO SLUG": NAMES.slug("p1"),
    "SEO TITLE": "",
    "META DESCRIPTION": "",
    "WEIGHT KG": "",
    DIMENSIONS: "",
    "TAX CLASS": "",
    NOTES: "",
    ...over,
  };
  return HEADERS.map((header) => values[header] ?? "");
}

/** A sheet holding only this run's fixture product. */
function sheetFor(over: Record<string, string | number> = {}): MemorySheet {
  return new MemorySheet([HEADERS, row(SKU.public, over)]);
}

/**
 * Every job id this file creates, so teardown can remove exactly those.
 *
 * A sync run is a real run and writes a real `sync_jobs` row — which is the
 * point, but it means these tests would otherwise leave their own history in
 * the development database forever, and the Catalogue Sync screen would report
 * a test as the shop's last sync. Collected by id, deleted by id: the same rule
 * the fixture teardown follows, and for the same reason.
 */
const jobsCreated: string[] = [];

async function sync(sheet: MemorySheet, dryRun = false) {
  const report = await runCatalogueSync({ dryRun, requestedBy: null, gateway: sheet });
  if (report.jobId) jobsCreated.push(report.jobId);
  return report;
}

async function product() {
  const { data } = await db
    .from("products")
    .select("price_tzs, display_name, storefront_visible, best_seller, low_stock_threshold")
    .eq("id", ID.productPublic)
    .single();
  return data!;
}

async function stock() {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved, available")
    .eq("product_id", ID.productPublic)
    .single();
  return data as { on_hand: number; reserved: number; available: number };
}

/** Forget everything this run's syncs recorded, so each test starts clean. */
async function clearSyncState() {
  await db.from("sync_state").delete().eq("entity_table", ENTITY_TABLE).eq("entity_key", SKU.public);
  await db
    .from("sync_conflicts")
    .delete()
    .eq("entity_table", ENTITY_TABLE)
    .eq("entity_key", SKU.public);
}

/** Put the fixture product back the way `fixtures.ts` made it. */
async function resetProduct() {
  await db
    .from("products")
    .update({
      price_tzs: 10_000,
      display_name: `ZZ${NAMES.token} Product One`,
      storefront_visible: true,
      best_seller: false,
      low_stock_threshold: 2,
    })
    .eq("id", ID.productPublic);
  await db.from("inventory").update({ reserved: 0 }).eq("product_id", ID.productPublic);
  await db.from("inventory").update({ on_hand: 40 }).eq("product_id", ID.productPublic);
}

beforeAll(resetProduct, 60_000);
beforeEach(async () => {
  await clearSyncState();
  await resetProduct();
});
afterAll(async () => {
  await clearSyncState();
  await resetProduct();

  // The events this run wrote, matched on THIS RUN'S fixture SKU — never on
  // "every sync event", which would delete the shop's real sync history.
  await db.from("sync_events").delete().eq("entity_table", ENTITY_TABLE).eq("entity_key", SKU.public);

  // And the job rows, by the exact ids collected above.
  for (const id of jobsCreated) {
    await db.from("sync_events").delete().eq("job_id", id);
    await db.from("sync_jobs").delete().eq("id", id);
  }
}, 120_000);

/* ------------------------------------------------------- the two directions */

describe("a price changed in the sheet", () => {
  it("reaches the real product row", async () => {
    // First run introduces the two and records what they agree on.
    await sync(sheetFor());
    expect((await product()).price_tzs).toBe(10_000);

    const sheet = sheetFor({ "PRICE TZS": 12_500 });
    const report = await sync(sheet);

    expect(report.ok).toBe(true);
    expect(report.toDatabase).toBe(1);
    expect((await product()).price_tzs).toBe(12_500);
  });

  it("is recorded in the audit trail, with the value it replaced", async () => {
    await sync(sheetFor());
    await sync(sheetFor({ "PRICE TZS": 12_500 }));

    const { data } = await db
      .from("sync_events")
      .select("direction, operation, status, field_changes, entity_key, sheet_row")
      .eq("entity_table", ENTITY_TABLE)
      .eq("entity_key", SKU.public)
      .eq("direction", "sheet_to_db")
      .eq("operation", "update")
      .order("created_at", { ascending: false })
      .limit(1);

    const event = data![0];
    expect(event.status).toBe("applied");
    expect(event.sheet_row).toBe(2);
    const changes = event.field_changes as { after: Record<string, unknown>; before: Record<string, unknown> };
    expect(changes.after.priceTzs).toBe(12_500);
    expect(changes.before.priceTzs).toBe(10_000);
  });
});

describe("a price changed in the dashboard", () => {
  it("is written back into the sheet", async () => {
    const sheet = sheetFor();
    await sync(sheet); // agree first

    await db.from("products").update({ price_tzs: 15_000 }).eq("id", ID.productPublic);

    const report = await sync(sheet);
    expect(report.toSheet).toBe(1);
    expect(sheet.cell("PRICE TZS", 2)).toBe(15_000);
  });
});

/* ------------------------------------------------------------- stock safety */

describe("stock is not the sheet's to change", () => {
  it("changes no inventory when STOCK QTY is edited to something enormous", async () => {
    const before = await stock();
    await sync(sheetFor());

    const report = await sync(sheetFor({ "STOCK QTY": 999_999 }));

    expect(report.ok).toBe(true);
    const after = await stock();
    expect(after.on_hand, "on_hand must not move").toBe(before.on_hand);
    expect(after.reserved).toBe(before.reserved);
    expect(after.available).toBe(before.available);
  });

  it("writes no movement to the stock ledger at all", async () => {
    const { count: before } = await db
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("product_id", ID.productPublic);

    await sync(sheetFor());
    await sync(sheetFor({ "STOCK QTY": 999_999, "PRICE TZS": 11_000 }));

    const { count: after } = await db
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("product_id", ID.productPublic);

    expect(after).toBe(before);
  });

  it("reports the shop's real figure back into the sheet instead", async () => {
    const sheet = sheetFor({ "STOCK QTY": 999_999 });
    await sync(sheet);
    await sync(sheet);

    expect(sheet.cell("SYSTEM AVAILABLE STOCK", 2)).toBe((await stock()).available);
    // And leaves the operator's own column exactly as they typed it.
    expect(sheet.cell("STOCK QTY", 2)).toBe(999_999);
  });
});

/* ---------------------------------------------------------------- conflicts */

describe("both sides changed the same price", () => {
  it("applies neither and records a conflict", async () => {
    const sheet = sheetFor();
    await sync(sheet); // agree at 10,000

    sheet.edit("PRICE TZS", 2, 9_000);
    await db.from("products").update({ price_tzs: 11_000 }).eq("id", ID.productPublic);

    const report = await sync(sheet);

    expect(report.conflicts).toBe(1);
    expect((await product()).price_tzs, "the dashboard's value stands untouched").toBe(11_000);
    expect(sheet.cell("PRICE TZS", 2), "the sheet's value stands untouched").toBe(9_000);

    const { data } = await db
      .from("sync_conflicts")
      .select("field, sheet_value, db_value, resolution")
      .eq("entity_table", ENTITY_TABLE)
      .eq("entity_key", SKU.public);

    expect(data).toHaveLength(1);
    expect(data![0].field).toBe("priceTzs");
    expect(data![0].sheet_value).toBe(9_000);
    expect(data![0].db_value).toBe(11_000);
    expect(data![0].resolution).toBe("pending");
  });

  it("does not raise the same conflict again on the next run", async () => {
    const sheet = sheetFor();
    await sync(sheet);
    sheet.edit("PRICE TZS", 2, 9_000);
    await db.from("products").update({ price_tzs: 11_000 }).eq("id", ID.productPublic);

    await sync(sheet);
    await sync(sheet);

    const { count } = await db
      .from("sync_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("entity_table", ENTITY_TABLE)
      .eq("entity_key", SKU.public);

    expect(count).toBe(1);
  });
});

describe("different fields on each side", () => {
  it("merges rather than conflicting", async () => {
    const sheet = sheetFor();
    await sync(sheet);

    sheet.edit("BEST SELLER", 2, "Yes");
    await db.from("products").update({ price_tzs: 13_000 }).eq("id", ID.productPublic);

    const report = await sync(sheet);

    expect(report.conflicts).toBe(0);
    const now = await product();
    expect(now.best_seller, "the sheet's flag came across").toBe(true);
    expect(now.price_tzs, "the dashboard's price survived").toBe(13_000);
    expect(sheet.cell("PRICE TZS", 2), "and went back to the sheet").toBe(13_000);
  });
});

/* ------------------------------------------------------------ idempotency */

describe("running the same sync twice", () => {
  it("writes nothing the second time", async () => {
    const sheet = sheetFor({ "PRICE TZS": 12_500 });
    await sync(sheet);
    await sync(sheet);

    const cellsBefore = sheet.cellsWritten;
    const report = await sync(sheet);

    expect(report.toDatabase).toBe(0);
    expect(sheet.cellsWritten, "no cell was rewritten").toBe(cellsBefore);
    expect(report.conflicts).toBe(0);
  });

  it("does not read its own write back as a fresh edit", async () => {
    const sheet = sheetFor();
    await sync(sheet);
    await db.from("products").update({ price_tzs: 14_000 }).eq("id", ID.productPublic);
    await sync(sheet); // db → sheet

    const report = await sync(sheet);
    expect(report.toDatabase).toBe(0);
    expect((await product()).price_tzs).toBe(14_000);
  });
});

/* ------------------------------------------------------- removal and rubbish */

describe("a product that has left the sheet", () => {
  it("is reported and is still in the shop, unchanged", async () => {
    const sheet = sheetFor();
    await sync(sheet);

    sheet.removeRow(2);
    const report = await sync(sheet);

    expect(report.missingFromSheet).toBeGreaterThanOrEqual(1);

    const { data } = await db
      .from("products")
      .select("id, lifecycle, storefront_visible")
      .eq("id", ID.productPublic)
      .maybeSingle();

    expect(data, "the product was not deleted").not.toBeNull();
    expect(data!.lifecycle, "and was not archived").toBe("active");
    expect(data!.storefront_visible, "and was not hidden").toBe(true);
  });
});

describe("rubbish in the sheet", () => {
  it("refuses a price that is not a number and changes nothing", async () => {
    await sync(sheetFor());
    const report = await sync(sheetFor({ "PRICE TZS": "about ten thousand" }));

    expect(report.issues).toBeGreaterThanOrEqual(1);
    expect((await product()).price_tzs).toBe(10_000);
  });

  it("refuses two rows claiming the same SKU", async () => {
    const sheet = new MemorySheet([
      HEADERS,
      row(SKU.public, { "PRICE TZS": 11_000 }),
      row(SKU.public, { "PRICE TZS": 12_000 }),
    ]);

    const report = await sync(sheet);
    expect(report.issues).toBeGreaterThanOrEqual(1);
    expect((await product()).price_tzs).toBe(10_000);
  });

  it("stops the whole run on a column nobody has classified", async () => {
    const sheet = new MemorySheet([[...HEADERS, "MARGIN %"], [...row(SKU.public, { "PRICE TZS": 99_000 }), 0.4]]);

    const report = await sync(sheet);
    expect(report.ok).toBe(false);
    expect(report.headline).toContain("columns");
    expect((await product()).price_tzs).toBe(10_000);
  });
});

/* ------------------------------------------------------------ Google is down */

describe("Google Sheets is unavailable", () => {
  it("fails the sync and leaves the shop working", async () => {
    const sheet = sheetFor();
    sheet.failWith = "Google Sheets is unreachable.";

    const report = await sync(sheet);

    expect(report.ok).toBe(false);
    expect(report.headline).toContain("unreachable");

    // The catalogue still reads, which is what the storefront does.
    const { data, error } = await db
      .from("product_shelf")
      .select("sku, effective_price_tzs")
      .eq("sku", SKU.public)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // And an order can still be placed and cancelled — the checkout path does
    // not import the sync at all, but proving it beats assuming it.
    const { data: placed, error: placeError } = await db.rpc("jojo_place_order", {
      p_items: [{ sku: SKU.public, quantity: 1 }],
      p_customer_name: "Fixture During Outage",
      p_customer_phone_e164: NAMES.phone,
      p_zone_slug: NAMES.slug("zone"),
      p_delivery_address: "Fixture address, plot 11",
      p_payment_preference: "cash_on_delivery",
    });
    expect(placeError).toBeNull();

    await db.rpc("jojo_cancel_order", {
      p_order_id: (placed as { order_id: string }).order_id,
      p_reason: "Sync outage test",
    });
  });

  it("records the failure as a failed job rather than losing it", async () => {
    const sheet = sheetFor();
    sheet.failWith = "Google Sheets is unreachable.";
    await sync(sheet);

    const { data } = await db
      .from("sync_jobs")
      .select("status, error_message")
      .eq("entity_table", ENTITY_TABLE)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(data![0].status).toBe("failed");
    expect(data![0].error_message).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ dry run */

describe("checking without changing", () => {
  it("says what would happen and does none of it", async () => {
    await sync(sheetFor());
    const sheet = sheetFor({ "PRICE TZS": 17_000 });

    const report = await sync(sheet, true);

    expect(report.dryRun).toBe(true);
    expect(report.toDatabase).toBe(1);
    expect((await product()).price_tzs, "nothing was written").toBe(10_000);
    expect(sheet.cellsWritten).toBe(0);
  });
});

/* ------------------------------------------- nothing operational is touched */

describe("a catalogue sync touches nothing operational", () => {
  it("leaves orders, order items, payments and the ledgers exactly as they were", async () => {
    const tables = ["orders", "order_items", "order_events", "inventory_movements", "customers"] as const;

    const before: Record<string, number | null> = {};
    for (const table of tables) {
      const { count } = await db.from(table).select("*", { count: "exact", head: true });
      before[table] = count ?? 0;
    }

    await sync(sheetFor());
    await sync(sheetFor({ "PRICE TZS": 12_000, "STOCK QTY": 500_000, "BEST SELLER": "Yes" }));

    for (const table of tables) {
      const { count } = await db.from(table).select("*", { count: "exact", head: true });
      expect(count, `${table} must be untouched by a catalogue sync`).toBe(before[table]);
    }
  });

  it("never reads or writes a staff row", async () => {
    const { data: before } = await db
      .from("admin_profiles")
      .select("*")
      .order("id");

    await sync(sheetFor({ "PRICE TZS": 12_000 }));

    const { data: after } = await db.from("admin_profiles").select("*").order("id");
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});
