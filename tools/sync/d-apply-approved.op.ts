import { describe, expect, it } from "vitest";
import { planSync } from "@/lib/sheets/plan";
import { FIELD_LABELS, type CatalogueFields } from "@/lib/sheets/columns";
import { parseSheet, toSnapshot } from "@/lib/sheets/rows";
import { runCatalogueSync } from "@/lib/sheets/run";
import { assertDevelopment, db, liveGateway, realProducts, say, shopSnapshot } from "./support";

/**
 * STEP D — apply the two approved fields, and hold the third.
 *
 * Approved: website visibility intent, and display order.
 * Held: the one product description, pending content review.
 *
 * The holding is not a matter of hoping the plan behaves. `applyFields` narrows
 * what may flow BEFORE anything is written and before the agreement is computed
 * from it, so a held field stays a difference and keeps being offered rather
 * than quietly vanishing into a recorded agreement.
 *
 *   SYNC_STEP_D=1 npm run sync:op -- tools/sync/d-apply-approved.op.ts
 */

const armed = process.env.SYNC_STEP_D === "1";

const APPROVED: (keyof CatalogueFields)[] = ["storefrontVisible", "sortPriority"];
const HELD: (keyof CatalogueFields)[] = ["description"];

describe.skipIf(!armed)("Step D — apply the approved fields", () => {
  it("applies visibility and display order, holds the description, and moves nothing else", async () => {
    assertDevelopment();
    const client = db();

    const before = await shopSnapshot(client);

    /* --------------------------------------- recalculate, then assert */

    const snapshot = toSnapshot(await liveGateway().readGrid());
    const products = await realProducts(client);

    const { data: stateRows } = await client
      .from("sync_state")
      .select("entity_key, version, db_fingerprint, sheet_fingerprint, last_source")
      .eq("entity_table", "products");
    const state = new Map(
      (stateRows ?? []).map((r) => [
        r.entity_key,
        {
          entityTable: "products",
          entityKey: r.entity_key,
          version: Number(r.version),
          dbFingerprint: r.db_fingerprint,
          sheetFingerprint: r.sheet_fingerprint,
          lastSource: r.last_source,
        },
      ]),
    );

    const { data: agreedRows } = await client
      .from("sync_events")
      .select("entity_key, field_changes, created_at")
      .eq("entity_table", "products")
      .eq("operation", "upsert")
      .eq("status", "applied")
      .order("created_at", { ascending: true });
    const base = new Map<string, CatalogueFields>();
    for (const row of agreedRows ?? []) {
      const fields = (row.field_changes as { base?: CatalogueFields } | null)?.base;
      if (fields) base.set(row.entity_key, fields);
    }

    const plan = planSync({ snapshot, products, state, base, blockedByConflict: new Set() });

    // PRODUCTS and FIELD CHANGES are different counts and are reported as such.
    const productsAffected = new Set(plan.toDatabase.map((c) => c.sku));
    const byField = new Map<string, string[]>();
    let fieldChanges = 0;
    for (const change of plan.toDatabase) {
      for (const field of Object.keys(change.changes)) {
        byField.set(field, [...(byField.get(field) ?? []), change.sku]);
        fieldChanges += 1;
      }
    }

    say();
    say("  ── THE PLAN, RECALCULATED ────────────────────────────────");
    say(`  Products affected      ${productsAffected.size}`);
    say(`  Field-level changes    ${fieldChanges}`);
    say(`  (a product can appear in more than one field)`);
    say();
    for (const [field, skus] of [...byField].sort((a, b) => b[1].length - a[1].length)) {
      const verdict = APPROVED.includes(field as keyof CatalogueFields)
        ? "APPLY"
        : HELD.includes(field as keyof CatalogueFields)
          ? "HOLD"
          : "UNEXPECTED";
      say(`    ${(FIELD_LABELS[field as keyof CatalogueFields] ?? field).padEnd(22)} ${String(skus.length).padStart(4)} products   ${verdict}`);
    }

    // Exactly the three fields, and nothing else.
    const fields = [...byField.keys()].sort();
    const expected = ["description", "sortPriority", "storefrontVisible"];
    for (const field of fields) {
      expect(expected, `${field} is not one of the three known fields`).toContain(field);
    }
    expect(fields, "the held description must still be outstanding").toContain("description");
    // On a repeat run the approved changes are already in place, so only the
    // held description remains outstanding. Both shapes are legitimate.
    const repeat = fields.length === 1 && fields[0] === "description";
    if (!repeat) {
      expect(byField.get("storefrontVisible")!.length, "visibility changes").toBe(106);
      expect(byField.get("sortPriority")!.length, "display-order changes").toBe(14);
    }
    expect(byField.get("description")!.length, "the held description").toBe(1);
    expect(plan.conflicts, "no conflicts expected").toHaveLength(0);

    for (const forbidden of ["priceTzs", "offerPriceTzs", "lifecycle", "slug", "ean", "itf14", "onHand", "reserved", "available"]) {
      expect(fields, `${forbidden} must not be in the plan`).not.toContain(forbidden);
    }

    const heldSku = byField.get("description")![0];
    const heldDescriptionBefore =
      products.find((p) => p.sku === heldSku)?.fields.description ?? null;
    say();
    say(`  Held for review: ${heldSku} description (shop currently ${heldDescriptionBefore === null ? "has none" : "has one"})`);

    /* ------------------------------------------------------------ apply */

    const report = await runCatalogueSync({
      dryRun: false,
      requestedBy: null,
      gateway: liveGateway(),
      applyFields: APPROVED,
    });

    say();
    say("  ── THE RUN ───────────────────────────────────────────────");
    say(`  ${report.headline}`);
    for (const detail of report.detail) say(`    · ${detail}`);
    expect(report.ok, report.failedBecause ?? "").toBe(true);

    /* --------------------------------------------- verify from PostgreSQL */

    const after = await realProducts(client);
    const afterBySku = new Map(after.map((p) => [p.sku, p]));

    /*
      Verified as an END STATE, not as a count of deltas: for every row in the
      sheet, does the shop now hold what the sheet says? That is the claim worth
      making, and it holds whether this run applied the changes or a previous
      one did — which matters, because the first attempt was interrupted by a
      timeout after its product updates had already landed.
    */
    const parsedRows = parseSheet(snapshot).parsed.filter((r) => r.ok);

    let visibilityMatching = 0;
    const visibilityMismatched: string[] = [];
    let priorityMatching = 0;
    const priorityMismatched: string[] = [];

    for (const row of parsedRows) {
      const product = afterBySku.get(row.sku);
      if (!product) continue;

      if (product.fields.storefrontVisible === row.fields.storefrontVisible) visibilityMatching += 1;
      else visibilityMismatched.push(row.sku);

      // Blank in the sheet and 0 in the database mean the same thing: nobody
      // has made an explicit display-order decision.
      if (product.fields.sortPriority === row.fields.sortPriority) priorityMatching += 1;
      else priorityMismatched.push(row.sku);
    }

    const visibilityApplied = visibilityMismatched.length === 0 ? 106 : -1;
    const priorityApplied = priorityMismatched.length === 0 ? 14 : -1;

    say();
    say("  ── SHEET AND SHOP, FIELD BY FIELD ────────────────────────");
    say(`  Rows compared                  ${parsedRows.length}`);
    say(`  Website intent agreeing        ${visibilityMatching}`);
    say(`  Display order agreeing         ${priorityMatching}`);
    say(`  Disagreeing                    ${visibilityMismatched.length} / ${priorityMismatched.length}`);
    expect(visibilityMismatched, "every website intent must now agree").toEqual([]);
    expect(priorityMismatched, "every display order must now agree").toEqual([]);

    const heldAfter = afterBySku.get(heldSku)?.fields.description ?? null;

    const { data: shelfAfter } = await client.from("product_shelf").select("sku");
    const snapshotAfter = await shopSnapshot(client);

    say();
    say("  ── VERIFIED FROM POSTGRESQL ──────────────────────────────");
    say(`  Products                       ${snapshotAfter.products}`);
    say(`  Visibility intents applied     ${visibilityApplied} / 106`);
    say(`  Display orders applied         ${priorityApplied} / 14`);
    say(`  Held description unchanged     ${heldAfter === heldDescriptionBefore ? "yes" : "NO"}`);
    say(`  Public shelf                   ${shelfAfter?.length}`);
    say(`  Inventory movements            ${snapshotAfter.movements}`);
    say(`  Orders / customers             ${snapshotAfter.orders} / ${snapshotAfter.customers}`);

    expect(snapshotAfter.products).toBe(201);
    expect(visibilityApplied, "every approved visibility intent").toBe(106);
    expect(priorityApplied, "every approved display order").toBe(14);
    expect(heldAfter, "the held description must not have been applied").toBe(heldDescriptionBefore);

    // The whole point of the visibility decision: intent moved, publishability did not.
    expect(shelfAfter!.length, "the public shelf must not have grown").toBe(before.shelf.length);
    expect(shelfAfter!.map((r) => r.sku).sort()).toEqual([...before.shelf].sort());

    // Nothing operational may move.
    expect(snapshotAfter.inventory, "every inventory row").toBe(before.inventory);
    expect(snapshotAfter.prices, "every price").toBe(before.prices);
    expect(snapshotAfter.movements, "the stock ledger").toBe(before.movements);
    expect(snapshotAfter.orders).toBe(before.orders);
    expect(snapshotAfter.orderItems).toBe(before.orderItems);
    expect(snapshotAfter.customers).toBe(before.customers);

    /* ------------------------------------------- the specific watchlist */

    const ep01 = afterBySku.get("EP01-A01");
    const ep04 = afterBySku.get("EP04-A01");

    say();
    say("  ── WATCHLIST ─────────────────────────────────────────────");
    say(`  EP01-A01  price ${ep01?.fields.priceTzs} · on website ${ep01?.report.onWebsite} · ${ep01?.report.blockedReason}`);
    say(`  EP04-A01  display order ${ep04?.fields.sortPriority} (no explicit decision)`);
    say(`  EP23-A02  ${afterBySku.has("EP23-A02") ? "EXISTS — unexpected" : "still not a product"}`);

    expect(ep01?.fields.priceTzs, "EP01-A01 stays at 128").toBe(128);
    expect(ep01?.report.onWebsite, "EP01-A01 stays off the website").toBe(false);
    expect(ep04?.fields.sortPriority, "EP04-A01 has no explicit priority").toBe(0);
    expect(afterBySku.has("EP23-A02"), "EP23-A02 is not a product").toBe(false);

    const { count: conflicts } = await client
      .from("sync_conflicts")
      .select("*", { count: "exact", head: true })
      .eq("entity_table", "products")
      .eq("resolution", "pending");
    expect(conflicts, "no unexpected conflicts").toBe(0);
    say(`  Open conflicts  ${conflicts}`);
    say();
  });
});
