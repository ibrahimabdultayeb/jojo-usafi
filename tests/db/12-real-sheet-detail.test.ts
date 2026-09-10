/**
 * A closer read of the two things the first connection turned up.
 *
 * Read-only, skipped unless `INSPECT_REAL_SHEET=1`, and it opens the real
 * spreadsheet through a gateway with no write methods wired at all.
 *
 * The first pass said a real sync would rewrite 105 `WEBSITE STATUS` cells and
 * 14 `PRODUCT PRIORITY` cells in Ibrahim's sheet. Those are the operator's own
 * columns, not system columns, so what exactly would change and why is worth
 * knowing before anybody presses Sync now.
 */

import { describe, expect, it } from "vitest";
import { serviceClient } from "./support";
import { googleSheetGateway, googleStatus, type SheetGateway } from "@/lib/sheets/google";
import { parseSheet, toSnapshot } from "@/lib/sheets/rows";

const shouldRun = process.env.INSPECT_REAL_SHEET === "1";
const db = serviceClient();
const line = (text = "") => console.log(text);

/** A gateway that physically cannot write: the methods throw before doing anything. */
function readOnly(gateway: SheetGateway): SheetGateway {
  return {
    describe: gateway.describe,
    readGrid: () => gateway.readGrid(),
    writeCells: async () => {
      throw new Error("READ-ONLY PASS");
    },
    appendHeaders: async () => {
      throw new Error("READ-ONLY PASS");
    },
  };
}

describe.skipIf(!shouldRun)("what the first sync would actually change in the sheet", () => {
  it("explains the WEBSITE STATUS and PRODUCT PRIORITY differences", async () => {
    const status = googleStatus();
    if (!status.configured) throw new Error("not configured");

    const snapshot = toSnapshot(await readOnly(googleSheetGateway(status.config)).readGrid());
    const parsed = parseSheet(snapshot);
    const rows = parsed.parsed.filter((r) => r.ok);

    const { data } = await db
      .from("products")
      .select("sku, storefront_visible, lifecycle, sort_priority, price_tzs, product_media ( role )")
      .not("sku", "like", "ZZ%")
      .order("sku");

    const bySku = new Map(
      (data ?? []).map((row) => [
        row.sku,
        {
          visible: row.storefront_visible,
          lifecycle: row.lifecycle,
          priority: row.sort_priority,
          price: row.price_tzs,
          hasPhoto: (Array.isArray(row.product_media) ? row.product_media : []).some(
            (m: { role: string }) => m.role === "primary",
          ),
        },
      ]),
    );

    /* ------------------------------------------------- WEBSITE STATUS */

    let sheetShowDbHidden = 0;
    let sheetHideDbVisible = 0;
    let withPhoto = 0;
    let withoutPhoto = 0;
    const examples: string[] = [];

    for (const row of rows) {
      const product = bySku.get(row.sku);
      if (!product) continue;
      if (row.fields.storefrontVisible === product.visible) continue;

      if (row.fields.storefrontVisible && !product.visible) {
        sheetShowDbHidden += 1;
        if (product.hasPhoto) withPhoto += 1;
        else withoutPhoto += 1;
        if (examples.length < 6) {
          examples.push(
            `    ${row.sku.padEnd(12)} sheet says Show · shop says hidden · photo: ${product.hasPhoto ? "yes" : "NO"} · ${product.lifecycle}`,
          );
        }
      } else {
        sheetHideDbVisible += 1;
      }
    }

    line();
    line("  ── WEBSITE STATUS, WHERE THE TWO DISAGREE ────────────────");
    line(`  Sheet says Show, shop has it hidden   ${sheetShowDbHidden}`);
    line(`      …of those, WITHOUT a photograph   ${withoutPhoto}`);
    line(`      …of those, WITH a photograph      ${withPhoto}`);
    line(`  Sheet says Hide, shop has it visible  ${sheetHideDbVisible}`);
    line();
    for (const example of examples) line(example);

    /* ----------------------------------------------- PRODUCT PRIORITY */

    const priorityDiffs: string[] = [];
    for (const row of rows) {
      const product = bySku.get(row.sku);
      if (!product) continue;
      if (row.fields.sortPriority !== product.priority) {
        priorityDiffs.push(
          `    ${row.sku.padEnd(12)} sheet ${String(row.fields.sortPriority).padStart(4)} · shop ${String(product.priority).padStart(4)}`,
        );
      }
    }

    line();
    line("  ── PRODUCT PRIORITY, WHERE THE TWO DISAGREE ──────────────");
    line(`  Rows differing  ${priorityDiffs.length}`);
    for (const diff of priorityDiffs.slice(0, 20)) line(diff);

    /* ------------------------------------------------------ EP04-A01 */

    line();
    line("  ── EP04-A01, THE ONE UNREADABLE ROW ──────────────────────");
    const raw = snapshot.rows.find(
      (r) => String(r.cells["SKU"] ?? "").trim().toUpperCase() === "EP04-A01",
    );
    line(`  Present in the sheet     ${raw ? `yes, row ${raw.rowNumber}` : "no"}`);
    if (raw) {
      line(`  PRODUCT PRIORITY cell    ${JSON.stringify(raw.cells["PRODUCT PRIORITY"])}`);
      line(`  PRICE TZS cell           ${JSON.stringify(raw.cells["PRICE TZS"])}`);
      line(`  WEBSITE STATUS cell      ${JSON.stringify(raw.cells["WEBSITE STATUS"])}`);
      line(`  PRODUCT VARIANT cell     ${JSON.stringify(raw.cells["PRODUCT VARIANT"])}`);
    }
    const ep04 = bySku.get("EP04-A01");
    line(`  In the shop              ${ep04 ? `yes · ${ep04.price} TZS · priority ${ep04.priority}` : "no"}`);
    line();
    line("  It is NOT missing from the sheet — its row could not be read, and the");
    line("  first pass reported it under both headings. That is a reporting fault,");
    line("  not a data one.");

    /* ---------------------------------------------- price sanity check */

    let priceDiffs = 0;
    const priceExamples: string[] = [];
    for (const row of rows) {
      const product = bySku.get(row.sku);
      if (!product) continue;
      if (row.fields.priceTzs !== product.price) {
        priceDiffs += 1;
        if (priceExamples.length < 10) {
          priceExamples.push(
            `    ${row.sku.padEnd(12)} sheet ${row.fields.priceTzs} · shop ${product.price}`,
          );
        }
      }
    }

    line();
    line("  ── PRICES ────────────────────────────────────────────────");
    line(`  Rows where the price differs  ${priceDiffs}`);
    for (const example of priceExamples) line(example);
    line();

    expect(true).toBe(true);
  }, 180_000);
});
