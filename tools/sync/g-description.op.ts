import { describe, expect, it } from "vitest";
import { runCatalogueSync } from "@/lib/sheets/run";
import { assertDevelopment, db, liveGateway, say, shopSnapshot } from "./support";

/**
 * The EP10-A02 description, settled.
 *
 * The old Product Master copy claimed the product washes away "bacteria,
 * viruses and germs". That is a regulatory claim, not a stylistic one, and it
 * is why the description was held out of every sync since Build 09 rather than
 * quietly imported.
 *
 * Ibrahim approved replacement wording. It goes into the Product Master — which
 * IS the catalogue's editing surface — and then travels the ordinary way, so
 * the thing being proved is the normal workflow rather than a special case.
 *
 *   SYNC_STEP_G=1 npm run sync:op -- tools/sync/g-description.op.ts
 */

const armed = process.env.SYNC_STEP_G === "1";
const SKU = "EP10-A02";

const APPROVED =
  "Shower Gel Bubblegum is a refreshing body wash with a sweet bubblegum-inspired fragrance. " +
  "It creates a rich lather to cleanse the skin and leave it feeling fresh and comfortable after washing. " +
  "Suitable for everyday use.";

/** Words the old copy used that must not survive anywhere. */
const FORBIDDEN = [/bacteria/i, /viruses?/i, /germs?/i];

describe.skipIf(!armed)("EP10-A02 — the approved description", () => {
  it("replaces the claim-making copy and synchronises it", async () => {
    assertDevelopment();
    const client = db();
    const before = await shopSnapshot(client);

    const gateway = liveGateway();
    const grid = await gateway.readGrid();
    const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
    const skuColumn = headers.indexOf("SKU");
    const descriptionColumn = headers.indexOf("DESCRIPTION");
    const rowIndex = grid.findIndex(
      (row) => String(row[skuColumn] ?? "").trim().toUpperCase() === SKU,
    );

    expect(rowIndex, "EP10-A02 must be in the sheet").toBeGreaterThan(0);
    const sheetRow = rowIndex + 1;
    const existing = String(grid[rowIndex]?.[descriptionColumn] ?? "");

    say();
    say("  ── BEFORE ────────────────────────────────────────────────");
    say(`  Sheet row              ${sheetRow}`);
    say(`  Old copy length        ${existing.length} characters`);
    say(`  Old copy makes claims  ${FORBIDDEN.some((r) => r.test(existing)) ? "yes" : "no"}`);

    /* ------------------------------- write the approved copy to the master */

    await gateway.writeCells([
      { row: sheetRow, column: descriptionColumn, value: APPROVED },
    ]);

    const afterWrite = await gateway.readGrid();
    expect(String(afterWrite[rowIndex]?.[descriptionColumn] ?? "")).toBe(APPROVED);
    say();
    say("  ── THE MASTER NOW SAYS ───────────────────────────────────");
    say(`  ${APPROVED.slice(0, 96)}…`);

    /* ------------------------------------------- sync it the ordinary way */

    const report = await runCatalogueSync({
      dryRun: false,
      requestedBy: null,
      gateway: liveGateway(),
      // The description is no longer held: this is the field being released.
      applyFields: ["storefrontVisible", "sortPriority", "description"],
    });

    say();
    say("  ── THE RUN ───────────────────────────────────────────────");
    say(`  ${report.headline}`);
    for (const detail of report.detail) say(`    · ${detail}`);
    expect(report.ok, report.failedBecause ?? "").toBe(true);

    /* ------------------------------------------ verify from PostgreSQL */

    const { data: product } = await client
      .from("products")
      .select("id, display_name, storefront_visible, lifecycle")
      .eq("sku", SKU)
      .single();

    const { data: content } = await client
      .from("product_content")
      .select("locale, description")
      .eq("product_id", product!.id);

    const english = (content ?? []).find((row) => row.locale === "en");

    say();
    say("  ── VERIFIED ──────────────────────────────────────────────");
    say(`  Product               ${product!.display_name}`);
    say(`  Description stored    ${english?.description ? "yes" : "NO"}`);
    say(`  Matches the approval  ${english?.description === APPROVED}`);

    expect(english?.description, "the approved copy is what the shop holds").toBe(APPROVED);

    for (const claim of FORBIDDEN) {
      expect(english!.description!, `no claim matching ${claim}`).not.toMatch(claim);
    }

    /* ---------------------------------- and only that product changed */

    const { data: others } = await client
      .from("product_content")
      .select("product_id, description")
      .not("description", "is", null);

    say(`  Products with a description  ${others?.length}`);
    expect(others, "no description was invented for anything else").toHaveLength(1);
    expect(others![0].product_id).toBe(product!.id);

    /* ------------------------------------------ nothing else moved */

    const after = await shopSnapshot(client);
    expect(after.inventory, "inventory untouched").toBe(before.inventory);
    expect(after.prices, "prices untouched").toBe(before.prices);
    expect(after.movements).toBe(before.movements);
    expect(after.shelf).toEqual(before.shelf);
    expect(after.orders).toBe(before.orders);

    say(`  Shelf ${after.shelf.length} · movements ${after.movements} · orders ${after.orders} — unchanged.  ✓`);

    /* ----------------------------------------- and it does not repeat */

    const again = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: liveGateway(),
    });
    say();
    say(`  A check afterwards proposes ${again.toDatabase} change(s) — the description is settled.`);
    expect(again.toDatabase, "nothing outstanding now").toBe(0);
    say();
  });
});
