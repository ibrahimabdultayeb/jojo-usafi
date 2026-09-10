/**
 * The first look at the REAL Product Master. Read-only, by construction.
 *
 * This is not part of the gate: it is skipped unless `INSPECT_REAL_SHEET=1`,
 * because it opens Ibrahim's actual spreadsheet and the normal suite must never
 * do that. It exists as a file rather than as a throwaway command so the first
 * connection is repeatable, reviewable, and provably read-only.
 *
 * THREE THINGS MAKE IT SAFE
 *
 *   1. The gateway is wrapped in `readOnly()`, which THROWS if anything tries
 *      to write a cell or append a header. The safety of this pass does not
 *      depend on `dryRun` being honoured — if the flag were ignored, the write
 *      would fail loudly instead of landing in the sheet.
 *   2. `planSync` is a pure function. Asking it what it would do costs nothing
 *      and changes nothing.
 *   3. `runCatalogueSync({ dryRun: true })` returns before every catalogue write
 *      and before both Google write methods; the only Google call it can reach
 *      is `readGrid()`. It does write ONE `sync_jobs` audit row, which is a
 *      record that a check happened — not a catalogue change and not a sheet
 *      change.
 *
 * It reports what it finds rather than asserting expected counts. The point of
 * a first look is to see what is actually there.
 */

import { describe, expect, it } from "vitest";
import { serviceClient } from "./support";
import { NAMES } from "./fixtures";
import { googleSheetGateway, googleStatus, type CellUpdate, type SheetGateway } from "@/lib/sheets/google";
import { checkHeaders, COLUMNS, REPORT_COLUMNS, FIELD_LABELS, type CatalogueFields } from "@/lib/sheets/columns";
import { parseSheet, toSnapshot } from "@/lib/sheets/rows";
import { planSync } from "@/lib/sheets/plan";
import { runCatalogueSync } from "@/lib/sheets/run";

/** The spreadsheet this pass is allowed to open. Public information, not a secret. */
const EXPECTED_SPREADSHEET_ID = "1mezJmgIu5VKT643DdeJtgqeYFfYyQFNqVNQfLNax2z4";
const EXPECTED_TAB = "Product Master";

const shouldRun = process.env.INSPECT_REAL_SHEET === "1";
const db = serviceClient();

/** Everything this run tried to write, which must stay empty. */
const writeAttempts: string[] = [];

function readOnly(gateway: SheetGateway): SheetGateway {
  return {
    describe: gateway.describe,
    readGrid: () => gateway.readGrid(),
    writeCells: async (updates: readonly CellUpdate[]) => {
      writeAttempts.push(`writeCells(${updates.length})`);
      throw new Error("READ-ONLY PASS: a write to the Google Sheet was attempted and blocked.");
    },
    appendHeaders: async (headers: readonly string[]) => {
      writeAttempts.push(`appendHeaders(${headers.join(", ")})`);
      throw new Error("READ-ONLY PASS: a header append was attempted and blocked.");
    },
  };
}

const line = (text = "") => console.log(text);
const money = (n: number) => `TSh ${n.toLocaleString("en-TZ")}`;

describe.skipIf(!shouldRun)("the real Product Master, read only", () => {
  it("is pointed at the spreadsheet and tab we intend", () => {
    const status = googleStatus();
    expect(status.configured, "the four Google settings must be present").toBe(true);
    if (!status.configured) return;

    // Compared, never printed. The private key is not read here at all.
    expect(status.config.spreadsheetId).toBe(EXPECTED_SPREADSHEET_ID);
    expect(status.config.tab).toBe(EXPECTED_TAB);
    expect(status.config.clientEmail).toMatch(/^jojo-usafi-catalogue-sync@/);

    line();
    line(`  Spreadsheet  …${status.config.spreadsheetId.slice(-6)}  (matches the intended id)`);
    line(`  Tab          ${status.config.tab}`);
    line(`  Service acct ${status.config.clientEmail.split("@")[0]}@…`);
  });

  it("reads, validates and compares — writing nothing", async () => {
    const status = googleStatus();
    if (!status.configured) throw new Error("not configured");

    const gateway = readOnly(googleSheetGateway(status.config));

    /* ---------------------------------------------------------- 1. read */

    const grid = await gateway.readGrid();
    const snapshot = toSnapshot(grid);

    line();
    line("  ── THE SHEET ─────────────────────────────────────────────");
    line(`  Grid rows returned      ${grid.length} (including the header row)`);
    line(`  Data rows with content  ${snapshot.rows.length}`);
    line(`  Columns in the header   ${snapshot.headers.length}`);

    /* ------------------------------------------------------ 2. headers */

    const headers = checkHeaders(snapshot.headers);

    line();
    line("  ── HEADERS ───────────────────────────────────────────────");
    line(`  Recognised     ${snapshot.headers.filter((h) => h.trim() !== "").length - headers.unknown.length}`);
    line(`  Unknown        ${headers.unknown.length}${headers.unknown.length ? ` → ${headers.unknown.join(", ")}` : ""}`);
    line(`  Missing        ${headers.missing.length}${headers.missing.length ? ` → ${headers.missing.join(", ")}` : ""}`);
    line(`  Would append   ${headers.toAppend.length}${headers.toAppend.length ? ` → ${headers.toAppend.join(", ")}` : ""}`);
    line(`  Header check   ${headers.ok ? "PASSES" : "FAILS — the run would stop"}`);

    if (!headers.ok) {
      line();
      line("  The sheet's own header row, in order:");
      snapshot.headers.forEach((h, i) => line(`    ${String(i + 1).padStart(2)}  ${h}`));
    }

    /* --------------------------------------------------------- 3. rows */

    const parsed = parseSheet(snapshot);
    const readable = parsed.parsed.filter((row) => row.ok);
    const skus = new Set(readable.map((row) => row.sku));

    line();
    line("  ── ROWS ──────────────────────────────────────────────────");
    line(`  Rows parsed cleanly     ${readable.length}`);
    line(`  Unique SKUs             ${skus.size}`);
    line(`  Duplicate SKUs          ${parsed.duplicates.length}`);
    line(`  Rows with problems      ${parsed.parsed.length - readable.length}`);

    if (parsed.issues.length > 0) {
      line();
      line(`  Every problem found (${parsed.issues.length}):`);
      for (const issue of parsed.issues.slice(0, 40)) {
        line(`    row ${String(issue.row).padStart(4)}  ${(issue.sku ?? "—").padEnd(12)} ${issue.problem}`);
      }
      if (parsed.issues.length > 40) line(`    … and ${parsed.issues.length - 40} more`);
    }

    /* ----------------------------------------------------- 4. database */

    // Read exactly what a real run reads, minus this test run's own fixtures,
    // which are not part of the real catalogue and would otherwise appear as
    // products the sheet has lost.
    const { data: rows, error } = await db
      .from("products")
      .select(
        `id, sku, slug, display_name, variant_label, pack_size_label,
         price_tzs, offer_price_tzs, storefront_visible, featured, best_seller,
         lifecycle, low_stock_threshold, sort_priority, ean, itf14,
         brands ( name ), categories ( name ),
         inventory ( on_hand, reserved, available ),
         product_media ( role ),
         product_content ( locale, description )`,
      )
      .order("sku");

    expect(error).toBeNull();

    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

    const allProducts = (rows ?? []).map((row) => {
      const stock = one(row.inventory as unknown as { on_hand: number; reserved: number; available: number }[] | null);
      const media = (Array.isArray(row.product_media) ? row.product_media : []) as { role: string }[];
      const content = (Array.isArray(row.product_content) ? row.product_content : []) as {
        locale: string;
        description: string | null;
      }[];
      const hasImage = media.some((m) => m.role === "primary");
      const onWebsite = row.lifecycle === "active" && row.storefront_visible && hasImage;
      const blocked: string[] = [];
      if (!hasImage) blocked.push("no approved photo");
      if (row.lifecycle !== "active") blocked.push(`status is ${row.lifecycle}`);
      if (!row.storefront_visible) blocked.push("switched off");

      return {
        id: row.id,
        sku: row.sku,
        fields: {
          displayName: row.display_name,
          variantLabel: row.variant_label,
          packSizeLabel: row.pack_size_label,
          categoryName: one(row.categories as unknown as { name: string }[] | null)?.name ?? "",
          brandName: one(row.brands as unknown as { name: string }[] | null)?.name ?? "",
          ean: row.ean,
          itf14: row.itf14,
          priceTzs: row.price_tzs,
          offerPriceTzs: row.offer_price_tzs,
          storefrontVisible: row.storefront_visible,
          featured: row.featured,
          bestSeller: row.best_seller,
          lifecycle: row.lifecycle as CatalogueFields["lifecycle"],
          lowStockThreshold: row.low_stock_threshold,
          sortPriority: row.sort_priority,
          slug: row.slug,
          description: content.find((c) => c.locale === "en")?.description ?? null,
        },
        report: {
          availableStock: stock?.available ?? 0,
          hasImage,
          onWebsite,
          blockedReason: onWebsite ? "" : blocked.join(", "),
        },
        onHand: stock?.on_hand ?? 0,
        reserved: stock?.reserved ?? 0,
      };
    });

    const fixtures = allProducts.filter((p) => p.sku.startsWith(NAMES.skuPrefix));
    const products = allProducts.filter((p) => !p.sku.startsWith(NAMES.skuPrefix));

    line();
    line("  ── THE SHOP ──────────────────────────────────────────────");
    line(`  Real products in Supabase  ${products.length}`);
    line(`  On the website now         ${products.filter((p) => p.report.onWebsite).length}`);
    line(`  This test run's fixtures   ${fixtures.length} (excluded from every figure below)`);

    /* --------------------------------------------------------- 5. plan */

    const { data: stateRows } = await db
      .from("sync_state")
      .select("entity_key, version, db_fingerprint, sheet_fingerprint, last_source")
      .eq("entity_table", "products");

    const state = new Map(
      (stateRows ?? []).map((row) => [
        row.entity_key,
        {
          entityTable: "products",
          entityKey: row.entity_key,
          version: Number(row.version),
          dbFingerprint: row.db_fingerprint,
          sheetFingerprint: row.sheet_fingerprint,
          lastSource: row.last_source,
        },
      ]),
    );

    const plan = planSync({
      snapshot,
      products,
      state,
      base: new Map(), // nothing has ever been agreed: this is the first meeting
      blockedByConflict: new Set(),
    });

    line();
    line("  ── WHAT A REAL SYNC WOULD DO ─────────────────────────────");
    line(`  Plan usable                ${plan.ok ? "yes" : `NO — ${plan.stopped}`}`);
    line(`  Sheet → Supabase changes   ${plan.toDatabase.length}`);
    line(`  Supabase → Sheet changes   ${plan.toSheet.length}`);
    line(`  Conflicts                  ${plan.conflicts.length}`);
    line(`  New SKUs in the sheet      ${plan.newProducts.length}`);
    line(`  Products not in the sheet  ${plan.missingFromSheet.length}`);
    line(`  Rows needing attention     ${plan.issues.length}`);
    line(`  Unchanged                  ${plan.unchanged}`);

    if (plan.toDatabase.length > 0) {
      line();
      line("  Sheet → Supabase, field by field:");
      for (const change of plan.toDatabase.slice(0, 30)) {
        for (const [field, value] of Object.entries(change.changes)) {
          const before = (change.before as unknown as Record<string, unknown>)[field];
          line(
            `    ${change.sku.padEnd(12)} ${(FIELD_LABELS[field as keyof CatalogueFields] ?? field).padEnd(22)} ${String(before)} → ${String(value)}`,
          );
        }
      }
      if (plan.toDatabase.length > 30) line(`    … and ${plan.toDatabase.length - 30} more products`);
    }

    if (plan.newProducts.length > 0) {
      line();
      line("  SKUs in the sheet that the shop has never seen:");
      for (const created of plan.newProducts.slice(0, 30)) {
        line(`    row ${String(created.row).padStart(4)}  ${created.sku.padEnd(12)} ${created.fields.displayName}`);
      }
      if (plan.newProducts.length > 30) line(`    … and ${plan.newProducts.length - 30} more`);
    }

    if (plan.missingFromSheet.length > 0) {
      line();
      line("  Products in the shop that the sheet no longer lists:");
      for (const missing of plan.missingFromSheet.slice(0, 30)) line(`    ${missing.sku}`);
      if (plan.missingFromSheet.length > 30) line(`    … and ${plan.missingFromSheet.length - 30} more`);
    }

    /* ------------------------------------------------ 6. the sheet cells */

    const cellsByHeader = new Map<string, number>();
    for (const change of plan.toSheet) {
      for (const header of Object.keys(change.cells)) {
        cellsByHeader.set(header, (cellsByHeader.get(header) ?? 0) + 1);
      }
    }

    line();
    line("  ── CELLS A REAL SYNC WOULD WRITE ─────────────────────────");
    line(`  Rows touched   ${plan.toSheet.length}`);
    line(`  Cells total    ${[...cellsByHeader.values()].reduce((a, b) => a + b, 0)}`);
    for (const [header, count] of [...cellsByHeader].sort((a, b) => b[1] - a[1])) {
      const rule = [...COLUMNS, ...REPORT_COLUMNS].find(
        (c) => c.header.toUpperCase() === header.toUpperCase(),
      );
      line(`    ${header.padEnd(26)} ${String(count).padStart(4)}  (${rule?.authority ?? "?"})`);
    }
    if (headers.toAppend.length > 0) {
      line(`  Header cells to append: ${headers.toAppend.length} → ${headers.toAppend.join(", ")}`);
    }

    /* -------------------------------------------- 7. THE STOCK GUARANTEE */

    const everyChangedField = plan.toDatabase.flatMap((c) => Object.keys(c.changes));
    const forbidden = ["onHand", "on_hand", "reserved", "available", "stock", "stockQty", "quantity"];

    line();
    line("  ── STOCK PROTECTION ──────────────────────────────────────");
    line(`  Distinct fields the sheet would change: ${[...new Set(everyChangedField)].join(", ") || "none"}`);
    for (const field of forbidden) {
      expect(everyChangedField, `the sheet must never write ${field}`).not.toContain(field);
    }
    line("  No inventory field appears in any proposed change.  ✓");

    // And the cells written back are the report columns, not the operator's own
    // stock column.
    expect([...cellsByHeader.keys()]).not.toContain("STOCK QTY");
    line("  The operator's own STOCK QTY column is not written.  ✓");

    /* ------------------------------------------------ 8. the two watchlist SKUs */

    line();
    line("  ── EP01-A01 ──────────────────────────────────────────────");
    const ep01Row = readable.find((r) => r.sku === "EP01-A01");
    const ep01Db = products.find((p) => p.sku === "EP01-A01");
    line(`  In the sheet    ${ep01Row ? `yes, row ${ep01Row.row}, price ${money(ep01Row.fields.priceTzs)}` : "no"}`);
    line(`  In the shop     ${ep01Db ? `yes, price ${money(ep01Db.fields.priceTzs)}, ${ep01Db.report.onWebsite ? "ON the website" : "not on the website"}` : "no"}`);
    line(`  Blocked because ${ep01Db?.report.blockedReason || "—"}`);
    const ep01Change = plan.toDatabase.find((c) => c.sku === "EP01-A01");
    line(`  Sync proposes   ${ep01Change ? JSON.stringify(ep01Change.changes) : "no change"}`);
    if (ep01Db) {
      expect(ep01Db.report.onWebsite, "EP01-A01 must stay off the website").toBe(false);
    }

    line();
    line("  ── EP23-A02 ──────────────────────────────────────────────");
    const ep23Row = readable.find((r) => r.sku === "EP23-A02");
    const ep23Db = products.find((p) => p.sku === "EP23-A02");
    line(`  In the sheet    ${ep23Row ? `yes, row ${ep23Row.row}` : "no"}`);
    line(`  In the shop     ${ep23Db ? "yes" : "no — still an orphan image"}`);
    line(`  Sync proposes   ${plan.newProducts.some((p) => p.sku === "EP23-A02") ? "reporting it as a new SKU" : "nothing"}`);

    /* ------------------------------- 9. the product path, also read-only */

    const report = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: readOnly(googleSheetGateway(status.config)),
    });

    line();
    line("  ── THE DASHBOARD'S OWN CHECK ─────────────────────────────");
    line(`  ${report.headline}`);
    for (const detail of report.detail) line(`    · ${detail}`);
    expect(report.dryRun).toBe(true);

    /* --------------------------------------------- 10. nothing was written */

    line();
    line("  ── WRITE ATTEMPTS ────────────────────────────────────────");
    line(`  Google write attempts blocked: ${writeAttempts.length}`);
    expect(writeAttempts, "this pass must not attempt a single sheet write").toEqual([]);
    line("  Nothing was written to the Google Sheet.  ✓");
    line();
  }, 180_000);
});
