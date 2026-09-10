import { describe, expect, it } from "vitest";
import { runCatalogueSync, fieldsForSku, recordResolvedBase } from "@/lib/sheets/run";
import type { CatalogueFields } from "@/lib/sheets/columns";
import { assertDevelopment, db, liveGateway, say, shopSnapshot } from "./support";

/**
 * STEP F — the round trip, on one safe field of one safe product.
 *
 * Four things, in order, each reversible:
 *
 *   A. an edit made only in the sheet reaches the shop
 *   B. an edit made only in the shop reaches the sheet
 *   C. the same field edited on both sides becomes a conflict, and neither wins
 *   D. everything is put back the way it was, through the normal mechanism
 *
 * THE FIELD IS `PRODUCT PRIORITY` — display order. Pure merchandising: not
 * stock, not price, not lifecycle, not the description under review, and not a
 * customer-facing word. It is also an integer, which matters for C: a boolean
 * cannot produce a conflict at all, because if both sides changed away from the
 * same base they must have changed to the same value.
 *
 *   SYNC_STEP_F=1 npm run sync:op -- tools/sync/f-round-trip.op.ts
 */

const armed = process.env.SYNC_STEP_F === "1";
const FORBIDDEN = new Set(["EP01-A01", "EP04-A01"]);

describe.skipIf(!armed)("Step F — the round trip", () => {
  it("carries an edit each way, refuses to guess a conflict, and restores", async () => {
    assertDevelopment();
    const client = db();
    const before = await shopSnapshot(client);

    /* ------------------------------------------- choose a safe product */

    const { data: candidates } = await client
      .from("products")
      .select("sku, sort_priority, storefront_visible, lifecycle")
      .eq("lifecycle", "active")
      .eq("sort_priority", 0)
      .not("sku", "like", "ZZ%")
      .order("sku")
      .limit(20);

    const chosen = (candidates ?? []).find((row) => !FORBIDDEN.has(row.sku));
    expect(chosen, "there must be a safe product to test with").toBeDefined();

    const SKU = chosen!.sku;
    const ORIGINAL = chosen!.sort_priority;

    const gateway = liveGateway();
    const grid = await gateway.readGrid();
    const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
    const skuColumn = headers.indexOf("SKU");
    const priorityColumn = headers.indexOf("PRODUCT PRIORITY");
    const rowIndex = grid.findIndex(
      (row) => String(row[skuColumn] ?? "").trim().toUpperCase() === SKU,
    );
    const sheetRow = rowIndex + 1;
    const ORIGINAL_CELL = grid[rowIndex]?.[priorityColumn] ?? "";

    say();
    say("  ── THE TEST PRODUCT ──────────────────────────────────────");
    say(`  SKU                ${SKU}`);
    say(`  Sheet row          ${sheetRow}`);
    say(`  Display order      shop ${ORIGINAL} · sheet ${JSON.stringify(ORIGINAL_CELL)}`);

    const writeSheet = (value: string | number) =>
      gateway.writeCells([{ row: sheetRow, column: priorityColumn, value }]);

    const readSheet = async () => {
      const fresh = await gateway.readGrid();
      return fresh[rowIndex]?.[priorityColumn] ?? "";
    };

    const readShop = async () => {
      const { data } = await client.from("products").select("sort_priority").eq("sku", SKU).single();
      return data!.sort_priority;
    };

    const sync = (fields?: (keyof CatalogueFields)[]) =>
      runCatalogueSync({
        dryRun: false,
        requestedBy: null,
        gateway: liveGateway(),
        applyFields: fields ?? ["sortPriority"],
      });

    try {
      /* ---------------------------------------------------------- A */

      await writeSheet(41);
      const a = await sync();
      const afterA = await readShop();

      say();
      say("  ── A · SHEET → SHOP ──────────────────────────────────────");
      say(`  Sheet set to 41, then synced.  Shop now ${afterA}`);
      say(`  Run: ${a.headline}`);
      expect(afterA, "the sheet's edit must reach the shop").toBe(41);

      /* ---------------------------------------------------------- B */

      await client.from("products").update({ sort_priority: 42 }).eq("sku", SKU);
      await sync();
      const afterB = await readSheet();

      say();
      say("  ── B · SHOP → SHEET ──────────────────────────────────────");
      say(`  Shop set to 42 in the dashboard, then synced.  Sheet now ${JSON.stringify(afterB)}`);
      expect(Number(afterB), "the shop's edit must reach the sheet").toBe(42);

      /* ---------------------------------------------------------- C */

      // Both sides move away from the agreed 42, to different values.
      await writeSheet(43);
      await client.from("products").update({ sort_priority: 44 }).eq("sku", SKU);

      const c = await sync();
      const shopAfterC = await readShop();
      const sheetAfterC = await readSheet();

      const { data: conflicts } = await client
        .from("sync_conflicts")
        .select("id, field, sheet_value, db_value, resolution")
        .eq("entity_table", "products")
        .eq("entity_key", SKU)
        .eq("resolution", "pending");

      say();
      say("  ── C · BOTH SIDES, SAME FIELD ────────────────────────────");
      say(`  Sheet 43, shop 44, then synced.`);
      say(`  Run: ${c.headline}`);
      say(`  Conflicts raised   ${conflicts?.length}`);
      say(`  Shop still         ${shopAfterC}`);
      say(`  Sheet still        ${JSON.stringify(sheetAfterC)}`);

      expect(conflicts, "a conflict must be raised").toHaveLength(1);
      expect(conflicts![0].field).toBe("sortPriority");
      expect(conflicts![0].sheet_value).toBe(43);
      expect(conflicts![0].db_value).toBe(44);
      expect(shopAfterC, "neither side may silently win").toBe(44);
      expect(Number(sheetAfterC), "neither side may silently win").toBe(43);

      // And the row is frozen: syncing again neither applies nor re-raises.
      await sync();
      const { count: stillOne } = await client
        .from("sync_conflicts")
        .select("*", { count: "exact", head: true })
        .eq("entity_table", "products")
        .eq("entity_key", SKU)
        .eq("resolution", "pending");
      expect(stillOne, "the same disagreement must not pile up").toBe(1);
      expect(await readShop(), "and nothing is applied while it waits").toBe(44);
      say(`  After another sync: still 1 conflict, shop still 44.  ✓`);

      /* ------------------------------- resolve, the way the screen does */

      await client
        .from("sync_conflicts")
        .update({
          resolution: "db_wins",
          resolved_at: new Date().toISOString(),
          note: "Settled by the Build 09 round-trip proof.",
        })
        .eq("id", conflicts![0].id);

      // The shop won, so the base records the sheet's rejected value: the
      // database then reads as changed and the decision travels to the sheet.
      const fields = await fieldsForSku(SKU);
      const agreed: CatalogueFields = { ...fields!, sortPriority: 43 };
      await recordResolvedBase(SKU, agreed, "admin");

      await sync();
      const sheetAfterResolve = await readSheet();

      say();
      say("  ── RESOLUTION · THE SHOP WINS ────────────────────────────");
      say(`  Sheet now ${JSON.stringify(sheetAfterResolve)} — the decision travelled.`);
      expect(Number(sheetAfterResolve), "the decision must reach the sheet").toBe(44);
      expect(await readShop()).toBe(44);
    } finally {
      /* ---------------------------------------------------------- D */

      // Put both sides back, through the normal mechanism, whatever happened.
      await client.from("products").update({ sort_priority: ORIGINAL }).eq("sku", SKU);
      await writeSheet(ORIGINAL_CELL === "" ? "" : ORIGINAL);

      const fields = await fieldsForSku(SKU);
      if (fields) {
        await recordResolvedBase(SKU, { ...fields, sortPriority: ORIGINAL }, "admin");
      }

      await client
        .from("sync_conflicts")
        .update({ resolution: "db_wins", resolved_at: new Date().toISOString() })
        .eq("entity_table", "products")
        .eq("entity_key", SKU)
        .eq("resolution", "pending");

      await runCatalogueSync({
        dryRun: false,
        requestedBy: null,
        gateway: liveGateway(),
        applyFields: ["sortPriority"],
      });
    }

    /* ------------------------------------------------ verify the cleanup */

    const finalShop = await readShop();
    const finalSheet = await readSheet();
    const { count: openConflicts } = await client
      .from("sync_conflicts")
      .select("*", { count: "exact", head: true })
      .eq("entity_table", "products")
      .eq("resolution", "pending");

    const after = await shopSnapshot(client);

    say();
    say("  ── D · RESTORED ──────────────────────────────────────────");
    say(`  Shop display order   ${finalShop} (was ${ORIGINAL})`);
    say(`  Sheet cell           ${JSON.stringify(finalSheet)} (was ${JSON.stringify(ORIGINAL_CELL)})`);
    say(`  Open conflicts       ${openConflicts}`);
    say(`  Public shelf         ${before.shelf.length} → ${after.shelf.length}`);
    say(`  Stock ledger         ${before.movements} → ${after.movements}`);
    say(`  Orders / customers   ${after.orders} / ${after.customers}`);

    expect(finalShop, "the shop is back where it started").toBe(ORIGINAL);
    expect(String(finalSheet).trim(), "the sheet is back where it started").toBe(
      String(ORIGINAL_CELL).trim(),
    );
    expect(openConflicts, "no conflict left open").toBe(0);
    expect(after.inventory, "inventory untouched throughout").toBe(before.inventory);
    expect(after.prices, "prices untouched throughout").toBe(before.prices);
    expect(after.movements).toBe(before.movements);
    expect(after.shelf).toEqual(before.shelf);
    expect(after.orders).toBe(before.orders);
    expect(after.customers).toBe(before.customers);
    say();
  });
});
