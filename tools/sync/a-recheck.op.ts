import { describe, expect, it } from "vitest";
import { planSync } from "@/lib/sheets/plan";
import { checkHeaders, FIELD_LABELS, type CatalogueFields } from "@/lib/sheets/columns";
import { parseSheet, toSnapshot } from "@/lib/sheets/rows";
import {
  assertDevelopment,
  db,
  liveGateway,
  readOnly,
  realProducts,
  say,
} from "./support";

/**
 * STEP A — read the live Product Master again, after the EP04-A01 fix.
 *
 * Read-only. It also SIMULATES the second sync — the one that would run after a
 * baseline had been recorded — so that what Step C is going to propose is known
 * before anything is written, rather than discovered afterwards.
 *
 * The simulation is exact, not approximate: after a baseline run the agreed base
 * is the database's own values, so passing those as the base reproduces run two
 * precisely.
 *
 *   npm run sync:op -- tools/sync/a-recheck.op.ts
 */

const armed = process.env.SYNC_STEP_A === "1";

describe.skipIf(!armed)("Step A — recheck the live sheet", () => {
  it("reads, validates, and shows what the second sync would propose", async () => {
    assertDevelopment();
    const gateway = readOnly(liveGateway());
    const client = db();

    const snapshot = toSnapshot(await gateway.readGrid());
    const headers = checkHeaders(snapshot.headers);
    const parsed = parseSheet(snapshot);
    const clean = parsed.parsed.filter((r) => r.ok);
    const skus = new Set(clean.map((r) => r.sku));

    say();
    say("  ── STEP A · THE SHEET NOW ────────────────────────────────");
    say(`  Data rows                ${snapshot.rows.length}`);
    say(`  Rows parsed cleanly      ${clean.length}`);
    say(`  Unique valid SKUs        ${skus.size}`);
    say(`  Duplicate SKUs           ${parsed.duplicates.length}`);
    say(`  Headers unknown/missing  ${headers.unknown.length} / ${headers.missing.length}`);
    say(`  Rows with problems       ${parsed.parsed.length - clean.length}`);

    for (const issue of parsed.issues) {
      say(`    row ${String(issue.row).padStart(4)}  ${(issue.sku ?? "—").padEnd(12)} ${issue.problem}`);
    }

    // EP04-A01 specifically: it must now parse, and its priority must be the
    // "no decision" value rather than an invented number.
    const ep04 = clean.find((r) => r.sku === "EP04-A01");
    say();
    say("  ── EP04-A01 ──────────────────────────────────────────────");
    const raw = snapshot.rows.find(
      (r) => String(r.cells["SKU"] ?? "").trim().toUpperCase() === "EP04-A01",
    );
    say(`  PRODUCT PRIORITY cell    ${JSON.stringify(raw?.cells["PRODUCT PRIORITY"] ?? null)}`);
    say(`  Parses                   ${ep04 ? "yes" : "NO"}`);
    say(`  Display order read as    ${ep04 ? ep04.fields.sortPriority : "—"}`);

    expect(ep04, "EP04-A01 must parse now").toBeDefined();
    expect(ep04!.fields.sortPriority, "blank means no decision, which is 0 — not invented").toBe(0);
    expect(parsed.duplicates, "no duplicate SKUs").toHaveLength(0);
    expect(headers.unknown, "no unclassified column").toHaveLength(0);
    expect(headers.missing, "no column has gone").toHaveLength(0);

    /* --------------------------------------------------- prices, again */

    const products = await realProducts(client);
    const bySku = new Map(products.map((p) => [p.sku, p]));

    const priceMismatches = clean.filter((row) => {
      const product = bySku.get(row.sku);
      return product && product.fields.priceTzs !== row.fields.priceTzs;
    });

    say();
    say("  ── PRICES ────────────────────────────────────────────────");
    say(`  Rows where the price differs from the shop  ${priceMismatches.length}`);
    for (const row of priceMismatches.slice(0, 10)) {
      say(`    ${row.sku}  sheet ${row.fields.priceTzs} · shop ${bySku.get(row.sku)!.fields.priceTzs}`);
    }
    expect(priceMismatches, "no price should differ").toHaveLength(0);

    /* ------------------------------------------- the baseline run's plan */

    const first = planSync({
      snapshot,
      products,
      state: new Map(),
      base: new Map(), // nothing agreed yet
      blockedByConflict: new Set(),
    });

    const firstCells = new Map<string, number>();
    for (const change of first.toSheet) {
      for (const header of Object.keys(change.cells)) {
        firstCells.set(header, (firstCells.get(header) ?? 0) + 1);
      }
    }

    say();
    say("  ── WHAT THE BASELINE RUN WOULD DO (step B) ───────────────");
    say(`  Sheet → Supabase   ${first.toDatabase.length}`);
    say(`  Supabase → Sheet   ${first.toSheet.length} rows`);
    for (const [header, count] of [...firstCells].sort((a, b) => b[1] - a[1])) {
      say(`    ${header.padEnd(26)} ${String(count).padStart(4)}`);
    }
    say(`  Headers to append  ${headers.toAppend.length}`);
    expect(first.toDatabase, "the baseline run must not write into the shop").toHaveLength(0);
    for (const header of firstCells.keys()) {
      expect(header.startsWith("SYSTEM "), `${header} is not a system column`).toBe(true);
    }

    /* -------------------------------------- the SECOND run, simulated */

    // After the baseline, the agreed base is what the database holds. Feeding
    // exactly that reproduces run two without having run one.
    const base = new Map(products.map((p) => [p.sku, p.fields]));

    const second = planSync({
      snapshot,
      products,
      state: new Map(),
      base,
      blockedByConflict: new Set(),
    });

    const byField = new Map<string, { count: number; examples: string[] }>();
    for (const change of second.toDatabase) {
      for (const [field, value] of Object.entries(change.changes)) {
        const entry = byField.get(field) ?? { count: 0, examples: [] };
        entry.count += 1;
        if (entry.examples.length < 4) {
          const before = (change.before as unknown as Record<string, unknown>)[field];
          entry.examples.push(`${change.sku}: ${JSON.stringify(before)} → ${JSON.stringify(value)}`);
        }
        byField.set(field, entry);
      }
    }

    say();
    say("  ── WHAT THE SECOND RUN WOULD PROPOSE (step C) ────────────");
    say(`  Sheet → Supabase   ${second.toDatabase.length} products`);
    say(`  Conflicts          ${second.conflicts.length}`);
    say(`  Supabase → Sheet   ${second.toSheet.length} rows`);
    say();
    for (const [field, entry] of [...byField].sort((a, b) => b[1].count - a[1].count)) {
      say(`    ${(FIELD_LABELS[field as keyof CatalogueFields] ?? field).padEnd(24)} ${String(entry.count).padStart(4)} products`);
      for (const example of entry.examples) say(`        ${example}`);
    }

    /* --------------------------------------- the boundary this build allows */

    const approved = new Set(["storefrontVisible", "sortPriority"]);
    const beyond = [...byField.keys()].filter((field) => !approved.has(field));

    say();
    say("  ── BOUNDARY ──────────────────────────────────────────────");
    say(`  Approved for this build: website intent, display order`);
    say(`  Anything beyond that:    ${beyond.length ? beyond.join(", ") : "none"}`);

    // Never inventory, never money, in either plan.
    const everyField = [...byField.keys()];
    for (const forbidden of ["onHand", "on_hand", "reserved", "available", "stock", "priceTzs", "offerPriceTzs"]) {
      expect(everyField, `the sheet must not change ${forbidden}`).not.toContain(forbidden);
    }
    expect(gateway.attempts, "nothing may be written in step A").toEqual([]);
    say("  No inventory field and no price in either plan.  ✓");
    say("  Sheet writes attempted: 0  ✓");
    say();
  });
});
