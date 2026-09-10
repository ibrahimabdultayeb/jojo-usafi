import { describe, expect, it } from "vitest";
import { runCatalogueSync } from "@/lib/sheets/run";
import { assertDevelopment, db, liveGateway, say, shopSnapshot } from "./support";

/**
 * STEP H — a genuinely new product, added the way Ibrahim would add one.
 *
 * `13-operations.test.ts` already proves what `createNewProducts` does when it
 * is handed a row. This proves the part no unit test can: that a row TYPED INTO
 * THE REAL SHEET is seen, understood, refused when it should be, created as a
 * draft when it should be, and left alone on the next run.
 *
 * EVERY WRITE IS REVERSIBLE AND EVERY ONE IS UNDONE. The row is appended below
 * the operator's 201 products, carries a `ZZ`-prefixed SKU that matches no real
 * product, and is cleared in a `finally` — as is the product, its inventory
 * row, its sync state and its sync events. The last assertion re-reads the shop
 * and requires the counts to be identical to the ones taken before the run.
 *
 * IT DOES NOT DELETE THE SHEET ROW ITSELF, only its contents. Deleting a row
 * shifts every row beneath it, and this file is not going to renumber a
 * spreadsheet somebody else is looking at. A row of empty cells at the bottom
 * is what the sheet had before.
 *
 *   SYNC_STEP_H=1 npm run sync:op -- tools/sync/h-new-product.op.ts
 */

const armed = process.env.SYNC_STEP_H === "1";

/** One deliberately awkward candidate, and one that must be refused. */
const TOKEN = String(Date.now()).slice(-6);
const GOOD_SKU = `ZZ${TOKEN}-N1`;
const BAD_SKU = `ZZ${TOKEN}-N2`;

describe.skipIf(!armed)("Step H — a new product from the sheet", () => {
  it("creates a draft, refuses a broken row, and repeats itself into nothing", async () => {
    assertDevelopment();
    const client = db();
    const gateway = liveGateway();

    const before = await shopSnapshot(client);

    const grid = await gateway.readGrid();
    const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
    const at = (header: string) => {
      const index = headers.indexOf(header);
      if (index < 0) throw new Error(`The Product Master has no "${header}" column.`);
      return index;
    };

    // Two rows below whatever the sheet currently ends with, so nothing that
    // exists is touched even if a row is added by hand while this runs.
    const firstFree = grid.length + 1;
    const goodRow = firstFree;
    const badRow = firstFree + 1;

    /** Borrow a real product's brand, category, family and supplier by name. */
    const { data: sample } = await client
      .from("products")
      .select("sku, brands ( name ), categories ( name ), product_families ( code ), display_name")
      .not("sku", "like", "ZZ%")
      .eq("lifecycle", "active")
      .order("sku")
      .limit(1)
      .single();

    const brandName = (Array.isArray(sample!.brands) ? sample!.brands[0] : sample!.brands)!.name;
    const categoryName = (Array.isArray(sample!.categories) ? sample!.categories[0] : sample!.categories)!.name;
    const familyCode = (Array.isArray(sample!.product_families)
      ? sample!.product_families[0]
      : sample!.product_families)!.code;

    const { data: supplierRow } = await client
      .from("suppliers")
      .select("name")
      .not("name", "like", "ZZ%")
      .order("name")
      .limit(1)
      .single();

    const cells = (row: number, sku: string, over: Record<string, string | number> = {}) => {
      const values: Record<string, string | number> = {
        SKU: sku,
        "FAMILY CODE": familyCode,
        SUPPLIER: supplierRow!.name,
        "PRODUCT BRAND": brandName,
        "PRODUCT VARIANT": `ZZ ${TOKEN} Sync Proof`,
        SIZE: "1LT",
        CATEGORY: categoryName,
        "WEBSITE STATUS": "Show",
        "PRICE TZS": 12_500,
        "PRODUCT STATUS": "Active",
        "SEO SLUG": `zz-${TOKEN}-sync-proof${sku.endsWith("N2") ? "-b" : ""}`,
        "LOW STOCK THRESHOLD": 3,
        "PRODUCT PRIORITY": 0,
        ...over,
      };
      return Object.entries(values).map(([header, value]) => ({
        row,
        column: at(header),
        value,
      }));
    };

    /** Wipe every cell of a row, leaving the blank row the sheet started with. */
    const clearRow = (row: number) =>
      gateway.writeCells(headers.map((_, column) => ({ row, column, value: "" })));

    try {
      /* ------------------------------------------- 1 · type the rows in */

      await gateway.writeCells([
        ...cells(goodRow, GOOD_SKU),
        // Priced at 40 shillings: below the implausible-price floor, so the
        // sync must refuse it rather than sell a bottle of bleach for 40/=.
        ...cells(badRow, BAD_SKU, { "PRICE TZS": 40 }),
      ]);

      say();
      say("  ── THE ROWS ──────────────────────────────────────────────");
      say(`  Row ${goodRow}   ${GOOD_SKU}   12,500/=  complete`);
      say(`  Row ${badRow}   ${BAD_SKU}   40/=      implausible price`);

      /* ------------------------------------ 2 · a dry run sees them both */

      const dry = await runCatalogueSync({
        dryRun: true,
        requestedBy: null,
        gateway: liveGateway(),
      });

      say();
      say("  ── DRY RUN ───────────────────────────────────────────────");
      say(`  ${dry.headline}`);
      say(`  New in the sheet   ${dry.newProducts}`);

      expect(dry.newProducts, "both new rows must be seen").toBeGreaterThanOrEqual(2);

      const stillMissing = await client
        .from("products")
        .select("sku")
        .in("sku", [GOOD_SKU, BAD_SKU]);
      expect(stillMissing.data, "a dry run creates nothing").toEqual([]);

      /* --------------------------------- 3 · the real run, creating only */

      const real = await runCatalogueSync({
        dryRun: false,
        requestedBy: null,
        gateway: liveGateway(),
        createNew: true,
        // Creation only. No existing product's fields may move in a run whose
        // purpose is to prove creation.
        applyFields: [],
      });

      say();
      say("  ── CREATION ──────────────────────────────────────────────");
      say(`  ${real.headline}`);
      for (const note of real.detail) say(`  ${note}`);

      const { data: made } = await client
        .from("products")
        .select("sku, lifecycle, storefront_visible, price_tzs, display_name, inventory ( on_hand, reserved, available )")
        .in("sku", [GOOD_SKU, BAD_SKU]);

      const rows = made ?? [];
      expect(rows.map((r) => r.sku), "the broken row must not become a product").toEqual([GOOD_SKU]);

      const created = rows[0]!;
      const stock = Array.isArray(created.inventory) ? created.inventory[0] : created.inventory;

      say();
      say(`  ${created.sku}`);
      say(`    Status           ${created.lifecycle}`);
      say(`    On the website   ${created.storefront_visible}`);
      say(`    Price            ${created.price_tzs.toLocaleString("en-TZ")}/=`);
      say(`    Stock            on hand ${stock?.on_hand} · available ${stock?.available}`);

      // The three promises made about a sheet-created product.
      expect(created.lifecycle, "a new product arrives as a draft").toBe("draft");
      expect(created.storefront_visible, 'a sheet saying "Show" cannot publish a new product').toBe(false);
      expect(stock?.on_hand, "the sheet never creates stock").toBe(0);

      // And it is not on the shelf, because it has no photograph.
      const { data: shelf } = await client.from("product_shelf").select("sku").eq("sku", GOOD_SKU);
      expect(shelf, "a product with no photograph is not public").toEqual([]);

      /* ------------------------------------------- 4 · say it again */

      const again = await runCatalogueSync({
        dryRun: false,
        requestedBy: null,
        gateway: liveGateway(),
        createNew: true,
        applyFields: [],
      });

      const { count } = await client
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("sku", GOOD_SKU);

      say();
      say("  ── SECOND RUN ────────────────────────────────────────────");
      say(`  ${again.headline}`);
      say(`  Products carrying ${GOOD_SKU}: ${count}`);
      expect(count, "running twice must not make a second copy").toBe(1);
    } finally {
      /* --------------------------------------------- 5 · put it all back */

      const { data: leftovers } = await client
        .from("products")
        .select("id")
        .in("sku", [GOOD_SKU, BAD_SKU]);

      for (const product of leftovers ?? []) {
        await client.from("inventory").delete().eq("product_id", product.id);
        await client.from("products").delete().eq("id", product.id);
      }

      await client.from("sync_state").delete().in("entity_key", [GOOD_SKU, BAD_SKU]);
      await client.from("sync_events").delete().in("entity_key", [GOOD_SKU, BAD_SKU]);

      await clearRow(goodRow);
      await clearRow(badRow);

      const after = await shopSnapshot(client);
      say();
      say("  ── AFTERWARDS ────────────────────────────────────────────");
      say(`  Before  ${JSON.stringify(before)}`);
      say(`  After   ${JSON.stringify(after)}`);
      expect(after, "the shop must be exactly as it was found").toEqual(before);
    }
  }, 900_000);
});
