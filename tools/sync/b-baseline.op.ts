import { describe, expect, it } from "vitest";
import { planSync } from "@/lib/sheets/plan";
import { checkHeaders, REPORT_COLUMNS } from "@/lib/sheets/columns";
import { toSnapshot } from "@/lib/sheets/rows";
import { runCatalogueSync, ENTITY_TABLE } from "@/lib/sheets/run";
import {
  assertDevelopment,
  db,
  liveGateway,
  onlyColumns,
  realProducts,
  say,
  shopSnapshot,
} from "./support";

/**
 * STEP B — the first real synchronisation.
 *
 * This one writes. It establishes the baseline: the two sides record what they
 * currently agree on, and the read-only system columns are filled in for the
 * first time. Nothing of Ibrahim's is touched.
 *
 * THREE GUARDS, EACH INDEPENDENT
 *
 *   1. The plan is recomputed and checked BEFORE the run: if it proposes a
 *      single change to the shop, or a single cell outside the system columns,
 *      this step throws and never calls the sync.
 *   2. The gateway is wrapped in `onlyColumns`, which throws before anything
 *      reaches Google if a write lands in a column that is not on the list.
 *   3. Everything that must not move is snapshotted before and compared after —
 *      inventory row by row, the shelf, every price, and the counts of orders,
 *      order items and customers.
 *
 *   SYNC_STEP_B=1 npm run sync:op -- tools/sync/b-baseline.op.ts
 */

const armed = process.env.SYNC_STEP_B === "1";
const SYSTEM_COLUMNS = REPORT_COLUMNS.map((c) => c.header);

describe.skipIf(!armed)("Step B — the baseline sync", () => {
  it("writes only the system columns, and moves nothing in the shop", async () => {
    assertDevelopment();
    const client = db();

    const before = await shopSnapshot(client);
    say();
    say("  ── BEFORE ────────────────────────────────────────────────");
    say(`  Products ${before.products} · on the shelf ${before.shelf.length} · orders ${before.orders} · movements ${before.movements}`);

    /* ------------------------------------------------ guard 1: the plan */

    const inspect = liveGateway();
    const grid = await inspect.readGrid();
    const snapshot = toSnapshot(grid);
    const headers = checkHeaders(snapshot.headers);
    const products = await realProducts(client);

    const plan = planSync({
      snapshot,
      products,
      state: new Map(),
      base: new Map(),
      blockedByConflict: new Set(),
    });

    expect(plan.ok, plan.stopped ?? "").toBe(true);
    expect(plan.toDatabase, "a baseline run must not change the shop").toHaveLength(0);
    expect(plan.conflicts, "a baseline run cannot have conflicts").toHaveLength(0);

    const cellHeaders = new Set(plan.toSheet.flatMap((c) => Object.keys(c.cells)));
    for (const header of cellHeaders) {
      expect(SYSTEM_COLUMNS, `${header} is not a system column`).toContain(header);
    }
    for (const header of headers.toAppend) {
      expect(SYSTEM_COLUMNS).toContain(header);
    }

    say();
    say("  ── THE PLAN, RE-CHECKED ──────────────────────────────────");
    say(`  Sheet → Supabase  ${plan.toDatabase.length}`);
    say(`  Supabase → Sheet  ${plan.toSheet.length} rows`);
    say(`  Columns           ${[...cellHeaders].join(", ")}`);
    say(`  Headers to append ${headers.toAppend.length}`);

    /* ------------------------------------------- guard 2: the wire itself */

    // The header row as it will be once the system columns are appended, so a
    // write into one of them is recognised rather than read as an unknown
    // column past the end of the row.
    const finalHeaderRow = [...snapshot.headers, ...headers.toAppend];
    const gateway = onlyColumns(liveGateway(), finalHeaderRow, SYSTEM_COLUMNS);

    /* ------------------------------------------------------------- run */

    const report = await runCatalogueSync({ dryRun: false, requestedBy: null, gateway });

    say();
    say("  ── THE RUN ───────────────────────────────────────────────");
    say(`  ${report.headline}`);
    for (const detail of report.detail) say(`    · ${detail}`);
    say(`  Cells actually written  ${gateway.written.length}`);
    expect(report.ok, report.failedBecause ?? "").toBe(true);

    /* ------------------------------------------- guard 3: nothing moved */

    const after = await shopSnapshot(client);

    say();
    say("  ── AFTER ─────────────────────────────────────────────────");
    say(`  Products ${after.products} · on the shelf ${after.shelf.length} · orders ${after.orders} · movements ${after.movements}`);

    expect(after.products, "product count").toBe(before.products);
    expect(after.orders, "orders").toBe(before.orders);
    expect(after.orderItems, "order items").toBe(before.orderItems);
    expect(after.customers, "customers").toBe(before.customers);
    expect(after.movements, "stock ledger").toBe(before.movements);
    expect(after.inventory, "every inventory row, byte for byte").toBe(before.inventory);
    expect(after.prices, "every price, byte for byte").toBe(before.prices);
    expect(after.shelf, "the public shelf").toEqual(before.shelf);

    say("  Inventory, prices, orders, customers and the shelf: unchanged.  ✓");

    /* ------------------------------------------------------- the audit */

    const { data: job } = await client
      .from("sync_jobs")
      .select("status, rows_seen, rows_applied, rows_failed, idempotency_key, finished_at")
      .eq("entity_table", ENTITY_TABLE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: stateRows } = await client
      .from("sync_state")
      .select("*", { count: "exact", head: true })
      .eq("entity_table", ENTITY_TABLE);

    const { count: conflicts } = await client
      .from("sync_conflicts")
      .select("*", { count: "exact", head: true })
      .eq("entity_table", ENTITY_TABLE);

    say();
    say("  ── AUDIT ─────────────────────────────────────────────────");
    say(`  Job status        ${job?.status} · seen ${job?.rows_seen} · applied ${job?.rows_applied} · failed ${job?.rows_failed}`);
    say(`  Live run          ${String(job?.idempotency_key ?? "").endsWith(":live") ? "yes" : "no"}`);
    say(`  sync_state rows   ${stateRows}`);
    say(`  Conflicts         ${conflicts}`);

    expect(job?.status).toBe("applied");
    expect(String(job?.idempotency_key ?? "")).toContain(":live");
    expect(stateRows, "every product should now have an agreed baseline").toBeGreaterThan(0);
    expect(conflicts).toBe(0);

    /* --------------------------- does the sheet now agree with the shop? */

    const reread = toSnapshot(await liveGateway().readGrid());
    const columnOf = (header: string) =>
      reread.headers.findIndex((h) => h.trim().toUpperCase() === header.toUpperCase());

    const stockColumn = columnOf("SYSTEM AVAILABLE STOCK");
    const websiteColumn = columnOf("SYSTEM ON WEBSITE");
    const skuColumn = columnOf("SKU");

    expect(stockColumn, "the system stock column must exist now").toBeGreaterThan(-1);

    const bySku = new Map(products.map((p) => [p.sku, p]));
    let checked = 0;
    let wrong = 0;
    for (const row of reread.rows) {
      const sku = String(row.cells["SKU"] ?? "").trim().toUpperCase();
      const product = bySku.get(sku);
      if (!product) continue;
      checked += 1;
      const stock = Number(row.cells["SYSTEM AVAILABLE STOCK"]);
      const onWebsite = String(row.cells["SYSTEM ON WEBSITE"] ?? "");
      if (stock !== product.report.availableStock) wrong += 1;
      else if (onWebsite !== (product.report.onWebsite ? "On the website" : "Not on the website")) wrong += 1;
    }

    say();
    say("  ── THE SHEET NOW AGREES ──────────────────────────────────");
    say(`  Rows compared      ${checked}`);
    say(`  Rows disagreeing   ${wrong}`);
    say(`  (SKU col ${skuColumn}, stock col ${stockColumn}, website col ${websiteColumn})`);
    expect(wrong, "every system value must match the shop").toBe(0);
    say();
  });
});
