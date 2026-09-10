import { describe, expect, it } from "vitest";
import { planSync } from "@/lib/sheets/plan";
import { FIELD_LABELS, type CatalogueFields } from "@/lib/sheets/columns";
import { toSnapshot } from "@/lib/sheets/rows";
import { runCatalogueSync } from "@/lib/sheets/run";
import { assertDevelopment, db, liveGateway, readOnly, realProducts, say } from "./support";

/**
 * STEP C — the second plan, calculated and NOT applied.
 *
 * Read-only twice over: the plan is a pure function, and the gateway handed to
 * the dashboard's own check has write methods that throw.
 *
 * What it has to establish before anybody applies anything:
 *
 *   · every proposed change is merchandising intent, not operational data
 *   · the image-less products stay off the shelf even once they say "Show"
 *   · the storefront count does not move
 *   · no image requirement is bypassed
 *   · zero inventory mutations, zero price changes
 *
 *   SYNC_STEP_C=1 npm run sync:op -- tools/sync/c-second-plan.op.ts
 */

const armed = process.env.SYNC_STEP_C === "1";

/** Fields this build has authority to change. Anything else stops the run. */
const APPROVED = new Set<keyof CatalogueFields>(["storefrontVisible"]);

describe.skipIf(!armed)("Step C — the second plan", () => {
  it("proposes merchandising intent only, and cannot reach the shelf", async () => {
    assertDevelopment();
    const client = db();
    const gateway = readOnly(liveGateway());

    const snapshot = toSnapshot(await gateway.readGrid());
    const products = await realProducts(client);

    /* -------------------------------------------- the state as it now is */

    const { data: stateRows } = await client
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

    const { data: agreed } = await client
      .from("sync_events")
      .select("entity_key, field_changes, created_at")
      .eq("entity_table", "products")
      .eq("operation", "upsert")
      .eq("status", "applied")
      .order("created_at", { ascending: true });

    const base = new Map<string, CatalogueFields>();
    for (const row of agreed ?? []) {
      const fields = (row.field_changes as { base?: CatalogueFields } | null)?.base;
      if (fields) base.set(row.entity_key, fields);
    }

    say();
    say("  ── THE BASELINE THAT STEP B RECORDED ─────────────────────");
    say(`  Agreements in sync_state   ${state.size}`);
    say(`  Agreed values recorded     ${base.size}`);
    expect(base.size, "step B must have recorded a baseline").toBeGreaterThan(0);

    /* --------------------------------------------------------- the plan */

    const plan = planSync({ snapshot, products, state, base, blockedByConflict: new Set() });

    const byField = new Map<string, { skus: string[]; examples: string[] }>();
    for (const change of plan.toDatabase) {
      for (const [field, value] of Object.entries(change.changes)) {
        const entry = byField.get(field) ?? { skus: [], examples: [] };
        entry.skus.push(change.sku);
        if (entry.examples.length < 3) {
          const before = (change.before as unknown as Record<string, unknown>)[field];
          entry.examples.push(`${change.sku}: ${JSON.stringify(before)} → ${JSON.stringify(value)}`);
        }
        byField.set(field, entry);
      }
    }

    say();
    say("  ── THE SECOND PLAN ───────────────────────────────────────");
    say(`  Sheet → Supabase   ${plan.toDatabase.length} products`);
    say(`  Supabase → Sheet   ${plan.toSheet.length} rows`);
    say(`  Conflicts          ${plan.conflicts.length}`);
    say(`  Echoes             ${plan.echoes}`);
    say(`  Unchanged          ${plan.unchanged}`);
    say(`  Issues             ${plan.issues.length}`);
    say(`  New / missing      ${plan.newProducts.length} / ${plan.missingFromSheet.length}`);
    say();
    for (const [field, entry] of [...byField].sort((a, b) => b[1].skus.length - a[1].skus.length)) {
      const approved = APPROVED.has(field as keyof CatalogueFields);
      say(
        `    ${(FIELD_LABELS[field as keyof CatalogueFields] ?? field).padEnd(24)} ${String(entry.skus.length).padStart(4)}  ${approved ? "approved" : "NOT IN THIS BUILD'S APPROVAL"}`,
      );
      for (const example of entry.examples) say(`        ${example}`);
    }

    /* ------------------------------------------ nothing operational, ever */

    const fields = [...byField.keys()];
    for (const forbidden of [
      "onHand", "on_hand", "reserved", "available", "stock", "stockQty",
      "priceTzs", "offerPriceTzs", "lifecycle", "slug", "ean", "itf14",
    ]) {
      expect(fields, `the sheet must not change ${forbidden}`).not.toContain(forbidden);
    }

    say();
    say("  ── WHAT IT CANNOT TOUCH ──────────────────────────────────");
    say("  No inventory field, no price, no lifecycle, no SKU, no web address.  ✓");

    /* ------------------------- the shelf cannot be reached by a Show flag */

    const wouldBecomeVisible = byField.get("storefrontVisible")?.skus ?? [];

    const { data: media } = await client
      .from("product_media")
      .select("product_id, role, products!inner(sku)")
      .eq("role", "primary");

    const photographed = new Set(
      (media ?? []).map((row) => (row.products as unknown as { sku: string }).sku),
    );

    const withPhoto = wouldBecomeVisible.filter((sku) => photographed.has(sku));
    const withoutPhoto = wouldBecomeVisible.filter((sku) => !photographed.has(sku));

    const { data: shelfNow } = await client.from("product_shelf").select("sku");
    const onShelf = new Set((shelfNow ?? []).map((r) => r.sku));

    say();
    say("  ── THE SHELF ─────────────────────────────────────────────");
    say(`  Products that would become "Show"   ${wouldBecomeVisible.length}`);
    say(`      with an approved photograph     ${withPhoto.length}`);
    say(`      WITHOUT one                     ${withoutPhoto.length}`);
    say(`  On the public shelf right now       ${onShelf.size}`);
    say(`  Of those becoming Show, already on  ${wouldBecomeVisible.filter((s) => onShelf.has(s)).length}`);

    // `product_shelf` requires lifecycle active AND storefront_visible AND a
    // primary image. Every one of these lacks the image, so the flag alone
    // cannot put a single one of them in front of a customer. The rule itself
    // is proved empirically by the fixture in tests/db/01-schema and
    // 06-catalogue — a product that is active and visible with NO photograph,
    // asserted absent from the shelf.
    expect(withPhoto, "a Show flag must not be the thing that publishes a product").toHaveLength(0);
    for (const sku of wouldBecomeVisible) {
      expect(onShelf.has(sku), `${sku} is not on the shelf and must not be`).toBe(false);
    }

    say(`  None of them has a photograph, so none can reach the shelf.  ✓`);
    say(`  Expected shelf after applying: ${onShelf.size} — unchanged.`);

    /* ---------------------------------- the dashboard's own check, read-only */

    const report = await runCatalogueSync({
      dryRun: true,
      requestedBy: null,
      gateway: readOnly(liveGateway()),
    });

    say();
    say("  ── THE DASHBOARD'S CHECK ─────────────────────────────────");
    say(`  ${report.headline}`);
    for (const detail of report.detail) say(`    · ${detail}`);

    /* ------------------------------------------------------- the verdict */

    const beyond = fields.filter((f) => !APPROVED.has(f as keyof CatalogueFields));

    say();
    say("  ── VERDICT ───────────────────────────────────────────────");
    if (beyond.length === 0) {
      say("  Everything proposed is within this build's approval.");
    } else {
      say("  BEYOND THIS BUILD'S APPROVAL — step D must not run yet:");
      for (const field of beyond) {
        const entry = byField.get(field)!;
        say(`    ${FIELD_LABELS[field as keyof CatalogueFields] ?? field} — ${entry.skus.length} product(s)`);
        say(`      ${entry.skus.slice(0, 20).join(", ")}${entry.skus.length > 20 ? " …" : ""}`);
      }
    }

    expect(gateway.attempts, "step C must write nothing").toEqual([]);
    expect(plan.conflicts, "there should be no conflicts yet").toHaveLength(0);
    say();
    say(`  Sheet writes attempted: 0  ✓`);
    say();
  });
});
