import { describe, expect, it } from "vitest";
import { runCatalogueSync } from "@/lib/sheets/run";
import { assertDevelopment, db, liveGateway, readOnly, say, shopSnapshot } from "./support";

/**
 * STEP E — run it again, and again, and prove nothing moves.
 *
 * The question is not only "does it repeat writes" but "can the reporting
 * columns feed themselves". `SYSTEM LAST SYNCED` changes on every run by
 * design, so if the system columns were part of the comparison the sheet would
 * look edited every time and the two sides would chase each other forever.
 *
 *   SYNC_STEP_E=1 npm run sync:op -- tools/sync/e-idempotency.op.ts
 */

const armed = process.env.SYNC_STEP_E === "1";

describe.skipIf(!armed)("Step E — idempotency", () => {
  it("repeats nothing, and the timestamp column cannot start a cycle", async () => {
    assertDevelopment();
    const client = db();

    const before = await shopSnapshot(client);

    /* ------------------------------------------------ two dry runs first */

    const first = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: readOnly(liveGateway()),
    });
    const second = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: readOnly(liveGateway()),
    });

    say();
    say("  ── TWO CHECKS IN A ROW ───────────────────────────────────");
    say(`  Sheet → Supabase   ${first.toDatabase} then ${second.toDatabase}`);
    say(`  Conflicts          ${first.conflicts} then ${second.conflicts}`);
    say(`  Issues             ${first.issues} then ${second.issues}`);
    say(`  Echoes             ${first.echoes} then ${second.echoes}`);

    // Exactly one outstanding item: the description that is deliberately held.
    expect(first.toDatabase, "only the held description remains outstanding").toBe(1);
    expect(second.toDatabase, "and it does not multiply").toBe(1);
    expect(first.conflicts).toBe(0);
    expect(second.conflicts).toBe(0);
    expect(first.issues).toBe(0);

    /* ------------------------------------------- a real run that repeats */

    const live = await runCatalogueSync({
      dryRun: false,
      requestedBy: null,
      gateway: liveGateway(),
      applyFields: ["storefrontVisible", "sortPriority"],
    });

    say();
    say("  ── A REAL RUN, REPEATED ──────────────────────────────────");
    say(`  ${live.headline}`);
    for (const detail of live.detail) say(`    · ${detail}`);
    expect(live.ok, live.failedBecause ?? "").toBe(true);
    expect(live.toDatabase, "no approved change should repeat").toBe(0);

    const after = await shopSnapshot(client);

    say();
    say("  ── NOTHING MOVED ─────────────────────────────────────────");
    say(`  Inventory rows identical   ${after.inventory === before.inventory}`);
    say(`  Prices identical           ${after.prices === before.prices}`);
    say(`  Stock ledger               ${before.movements} → ${after.movements}`);
    say(`  Public shelf               ${before.shelf.length} → ${after.shelf.length}`);
    say(`  Orders / customers         ${after.orders} / ${after.customers}`);

    expect(after.inventory).toBe(before.inventory);
    expect(after.prices).toBe(before.prices);
    expect(after.movements).toBe(before.movements);
    expect(after.shelf).toEqual(before.shelf);
    expect(after.orders).toBe(before.orders);
    expect(after.customers).toBe(before.customers);

    /* --------------------------------- blank priority ≡ no decision */

    const { data: ep04 } = await client
      .from("products")
      .select("sort_priority")
      .eq("sku", "EP04-A01")
      .single();

    const grid = await liveGateway().readGrid();
    const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
    const priorityColumn = headers.indexOf("PRODUCT PRIORITY");
    const skuColumn = headers.indexOf("SKU");
    const ep04Row = grid.find(
      (row) => String(row[skuColumn] ?? "").trim().toUpperCase() === "EP04-A01",
    );
    const ep04Cell = ep04Row?.[priorityColumn];

    say();
    say("  ── BLANK PRIORITY ≡ NO DECISION ──────────────────────────");
    say(`  EP04-A01 in the sheet      ${JSON.stringify(ep04Cell ?? null)}`);
    say(`  EP04-A01 in the shop       ${ep04?.sort_priority}`);
    say(`  Proposed as a change       ${first.toDatabase === 1 ? "no (only the description is)" : "check"}`);

    expect(String(ep04Cell ?? "").trim(), "the blank cell stays blank").toBe("");
    expect(ep04?.sort_priority, "which the shop holds as no decision").toBe(0);

    /* ---------------------- the timestamp column cannot feed itself */

    // `SYSTEM LAST SYNCED` is rewritten every run. If the system columns were
    // part of the comparison, that alone would make every row look edited and
    // the two sides would chase each other for ever. They are not: only the
    // bidirectional fields are compared, so a changing timestamp can never
    // produce a Sheet → Supabase change.
    const third = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: readOnly(liveGateway()),
    });

    say();
    say("  ── AFTER A LIVE RUN REWROTE EVERY TIMESTAMP ──────────────");
    say(`  Sheet → Supabase   ${third.toDatabase}  (still only the held description)`);
    say(`  Conflicts          ${third.conflicts}`);
    expect(third.toDatabase, "a new timestamp is not an edit").toBe(1);
    expect(third.conflicts).toBe(0);
    say();
  });
});
