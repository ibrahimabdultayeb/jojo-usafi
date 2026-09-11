import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { assertDevelopment, db, liveGateway, say } from "./support";
import { fieldsForSku, recordResolvedBase } from "@/lib/sheets/run";

/**
 * STEP I — the Google Sheet, driven from the DEPLOYED dashboard.
 *
 * Steps A to H ran the synchroniser in this terminal. None of them could prove
 * the one thing only a deployment can be wrong about: that the deployed
 * application reaches Google at all — that the service-account credentials
 * arrived in Vercel's environment, that a PEM survived being pasted into a
 * settings form, and that the Sync Now button a person actually presses does
 * the thing.
 *
 * So the sync is triggered by clicking it, on the real HTTPS site, signed in as
 * the development QA Manager. Every assertion is made here, against the
 * database and the real Product Master.
 *
 * THE FIELD IS `PRODUCT PRIORITY` — display order. Pure merchandising: not
 * stock, not price, not lifecycle, not a customer-facing word. The same field
 * Build 09's round trip used, for the same reason. EP01-A01, EP04-A01,
 * EP10-A02 and EP23-A02 are excluded by name.
 *
 * Everything it changes is put back in a `finally`, through the normal sync.
 *
  *   DEPLOY_URL=https://… SYNC_STEP_I=1 npm run sync:op -- tools/sync/i-deployed-round-trip.op.ts
 */

const armed = process.env.SYNC_STEP_I === "1";

/**
 * `DEPLOY_URL`, NOT `BASE_URL`, and this cost a confused quarter of an hour.
 *
 * `BASE_URL` is reserved by Vite — it is the public path a build is served
 * from, exposed as `import.meta.env.BASE_URL` — and Vitest sets
 * `process.env.BASE_URL` to an empty string inside the test environment. So a
 * perfectly good `BASE_URL=https://…` on the command line arrives here as "",
 * and Playwright is asked to navigate to "/admin/sign-in".
 *
 * Every plain Node script in `scripts/` still takes `BASE_URL`, because none of
 * them runs under Vitest. Anything under `tools/` needs its own name.
 */
const BASE_URL = (process.env.DEPLOY_URL || "http://localhost:3000").replace(/\/$/, "");
const MANIFEST = ".qa-staff.local.json";
const FORBIDDEN = new Set(["EP01-A01", "EP04-A01", "EP10-A02", "EP23-A02"]);

describe.skipIf(!armed)("Step I — the deployed dashboard syncs the real sheet", () => {
  it("carries a change each way, and still cannot move stock", async () => {
    assertDevelopment();
    const client = db();

    expect(fs.existsSync(MANIFEST), "development QA staff must exist").toBe(true);
    const manager = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).accounts.find(
      (a: { key: string }) => a.key === "manager",
    );
    expect(manager, "a QA Manager must exist").toBeTruthy();

    /* ------------------------------------------------- a safe subject */

    const { data: candidates } = await client
      .from("products")
      .select("id, sku, sort_priority")
      .eq("lifecycle", "active")
      .not("sku", "like", "ZZ%")
      .order("sku")
      .limit(30);

    const subject = (candidates ?? []).find((row) => !FORBIDDEN.has(row.sku));
    expect(subject, "there must be a safe product").toBeDefined();

    const ORIGINAL = subject!.sort_priority;
    const FROM_SHOP = 61;
    const FROM_SHEET = 62;

    const stockOf = async () =>
      (
        await client
          .from("inventory")
          .select("on_hand, reserved, available")
          .eq("product_id", subject!.id)
          .eq("location_code", "main")
          .single()
      ).data!;

    const movementsOf = async () =>
      (
        await client
          .from("inventory_movements")
          .select("*", { count: "exact", head: true })
          .eq("product_id", subject!.id)
      ).count ?? 0;

    const priorityInShop = async () =>
      (await client.from("products").select("sort_priority").eq("id", subject!.id).single()).data!
        .sort_priority;

    const stockBefore = await stockOf();
    const movementsBefore = await movementsOf();

    /**
     * Clear a pending disagreement this operation itself left behind.
     *
     * Setting both sides at once is how step 4 works, so an aborted run leaves
     * a conflict — and a conflicted row is FROZEN, which is the mechanism
     * working: nothing moves until a person decides. The next run then proves
     * nothing, because its change never travels.
     *
     * So leftovers are cleared, but only ones that are recognisably this
     * operation's: the subject SKU, the display-order field, and values that
     * are either the original or the two this file writes. Anything else is a
     * real disagreement somebody needs to look at, and it stops the run.
     */
    async function clearOwnConflict(when: string): Promise<void> {
      const { data: pending } = await client
        .from("sync_conflicts")
        .select("id, field, sheet_value, db_value")
        .eq("entity_table", "products")
        .eq("entity_key", subject!.sku)
        .eq("resolution", "pending");

      for (const conflict of pending ?? []) {
        const mine =
          conflict.field === "sortPriority" &&
          [ORIGINAL, FROM_SHOP, FROM_SHEET].includes(Number(conflict.sheet_value)) &&
          [ORIGINAL, FROM_SHOP, FROM_SHEET].includes(Number(conflict.db_value));

        if (!mine) {
          throw new Error(
            `A real conflict is waiting on ${subject!.sku} (${conflict.field}). Settle it on the Catalogue Sync screen first.`,
          );
        }

        await client
          .from("sync_conflicts")
          .update({
            resolution: "db_wins",
            resolved_at: new Date().toISOString(),
            note: "Settled by tools/sync/i-deployed-round-trip.op.ts",
          })
          .eq("id", conflict.id);

        // Settling means recording what the two now agree on, or the same
        // disagreement is found again on the next run — Build 09's lesson.
        const fields = await fieldsForSku(subject!.sku);
        if (fields) await recordResolvedBase(subject!.sku, { ...fields, sortPriority: ORIGINAL }, "admin");

        say(`  ${when}: settled a leftover conflict on ${subject!.sku}`);
      }
    }

    /* -------------------------------------------------------- the sheet */

    const gateway = liveGateway();
    const grid = await gateway.readGrid();
    const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim().toUpperCase());
    const skuColumn = headers.indexOf("SKU");
    const priorityColumn = headers.indexOf("PRODUCT PRIORITY");
    const stockColumn = headers.indexOf("STOCK QTY");
    const availableColumn = headers.indexOf("SYSTEM AVAILABLE STOCK");
    const rowIndex = grid.findIndex(
      (r) => String(r[skuColumn] ?? "").trim().toUpperCase() === subject!.sku,
    );
    expect(rowIndex, "the subject must be in the Product Master").toBeGreaterThan(0);

    const sheetPriorityOriginal = grid[rowIndex][priorityColumn] ?? "";
    const sheetStockOriginal = grid[rowIndex][stockColumn] ?? "";

    const readSheet = async (column: number) => {
      const fresh = await gateway.readGrid();
      return fresh[rowIndex]?.[column] ?? "";
    };
    const writeSheet = (column: number, value: string | number) =>
      gateway.writeCells([{ row: rowIndex + 1, column, value }]);

    /* ------------------------------------------------------ the browser */

    const password = `Qa!${randomBytes(18).toString("base64url")}`;
    await client.auth.admin.updateUserById(manager.authUserId, { password, email_confirm: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("jojo-usafi.locale.v1", "en");
        window.sessionStorage.setItem("jojo-usafi.locale.applied.v1", "1");
      } catch {
        /* storage blocked — the page still has to work */
      }
    });
    const tab = await context.newPage();

    /** The most recent sync job the database knows about, or null. */
    async function latestJob(): Promise<string | null> {
      const { data } = await client
        .from("sync_jobs")
        .select("id")
        .order("started_at", { ascending: false })
        .limit(1);
      return data?.[0]?.id ?? null;
    }

    /**
     * Press a sync button on the deployed screen and wait for it to finish.
     *
     * WAITING ON THE DATABASE, NOT ON THE WORDS. The screen renders the LAST
     * run's outcome as soon as it loads, so "Sync complete" is already on the
     * page before this one has started — a text watch returns instantly and
     * every assertion after it then reads the state before the sync. That is
     * exactly what happened: a shop → sheet change "failed" because it was
     * checked before the sync ran.
     *
     * A new row in `sync_jobs` is unambiguous, and it is the same record the
     * screen itself is reading.
     */
    async function runSync(label: string): Promise<string> {
      const before = await latestJob();

      await tab.goto(`${BASE_URL}/admin/more/catalogue-sync`, { waitUntil: "load", timeout: 90_000 });
      const button = tab.locator(`button:has-text("${label}")`).first();
      await button.waitFor({ state: "visible", timeout: 30_000 });
      await button.click();

      for (let attempt = 0; attempt < 90; attempt += 1) {
        await tab.waitForTimeout(2000);
        const now = await latestJob();
        if (now && now !== before) {
          const { data } = await client
            .from("sync_jobs")
            .select("status, rows_applied, rows_seen, error_message")
            .eq("id", now)
            .single();
          // The terminal states, by name. The enum has no "running" — it has
          // `pending` and `in_progress` on the way there, and treating
          // "not running" as finished read a half-done sync as a whole one.
          if (data && ["applied", "skipped_echo", "conflict", "failed"].includes(data.status)) {
            // Let the screen catch up, so the text this returns is the run's.
            await tab.waitForTimeout(1500);
            return `[${data.status}] seen ${data.rows_seen} applied ${data.rows_applied}${
              data.error_message ? ` — ${data.error_message}` : ""
            }`;
          }
        }
      }
      return "[no new sync job appeared]";
    }

    try {
      say();
      say(`  Against ${BASE_URL}`);
      say(`  Subject ${subject!.sku}, display order ${ORIGINAL}`);

      // Anything left frozen by an earlier run would stop every change below
      // from travelling, and the run would report a broken sync instead.
      await clearOwnConflict("before");

      await tab.goto(`${BASE_URL}/admin/sign-in`, { waitUntil: "load", timeout: 90_000 });
      await tab.fill("#email", manager.email);
      await tab.fill("#password", password);
      await Promise.all([
        tab
          .waitForURL((u) => !new URL(u).pathname.startsWith("/admin/sign-in"), { timeout: 60_000 })
          .catch(() => {}),
        tab.click('[data-qa-anchor="admin-sign-in-submit"]'),
      ]);

      /* ---------------------------------------- 1. the screen sees Google */

      await tab.goto(`${BASE_URL}/admin/more/catalogue-sync`, { waitUntil: "load", timeout: 90_000 });
      const screen = (await tab.locator("body").innerText()).replace(/\s+/g, " ");

      say();
      say("  ── THE DEPLOYED SCREEN ───────────────────────────────────");
      say(`  ${screen.slice(0, 200)}`);

      expect(new URL(tab.url()).pathname, "staff must reach the sync screen").toBe(
        "/admin/more/catalogue-sync",
      );
      expect(
        /not configured|waiting for/i.test(screen),
        "Google must be configured on the deployment",
      ).toBe(false);

      /* --------------------------------------------- 2. a check is safe */

      const checked = await runSync("Check first, change nothing");
      say();
      say("  ── A CHECK ───────────────────────────────────────────────");
      say(`  ${checked.slice(0, 180)}`);
      expect(await priorityInShop(), "a check changes nothing in the shop").toBe(ORIGINAL);

      /* ----------------------------------------------- 3. shop → sheet */

      await client.from("products").update({ sort_priority: FROM_SHOP }).eq("id", subject!.id);
      const outward = await runSync("Sync now");

      say();
      say("  ── SHOP → SHEET ──────────────────────────────────────────");
      say(`  ${outward.slice(0, 180)}`);
      const sheetGot = await readSheet(priorityColumn);
      say(`  Sheet now ${JSON.stringify(sheetGot)}`);
      expect(Number(sheetGot), "the shop's change must reach the sheet").toBe(FROM_SHOP);

      /* ----------------------------------------------- 4. sheet → shop */

      await writeSheet(priorityColumn, FROM_SHEET);
      await runSync("Sync now");

      say();
      say("  ── SHEET → SHOP ──────────────────────────────────────────");
      say(`  Shop now ${await priorityInShop()}`);
      expect(await priorityInShop(), "the sheet's change must reach the shop").toBe(FROM_SHEET);

      /* ------------------------------- 5. the sheet cannot move stock */

      const ABSURD = 999_999;
      await writeSheet(stockColumn, ABSURD);
      await runSync("Sync now");

      const stockAfter = await stockOf();
      const movementsAfter = await movementsOf();
      const reported = await readSheet(stockColumn);

      say();
      say("  ── STOCK IS NOT THE SHEET'S TO CHANGE ────────────────────");
      say(`  Sheet said            ${ABSURD.toLocaleString("en-TZ")}`);
      say(`  On hand               ${stockBefore.on_hand} → ${stockAfter.on_hand}`);
      say(`  Reserved              ${stockBefore.reserved} → ${stockAfter.reserved}`);
      say(`  Available             ${stockBefore.available} → ${stockAfter.available}`);
      say(`  Ledger movements      ${movementsBefore} → ${movementsAfter}`);
      say(`  Sheet was told        ${JSON.stringify(reported)}`);

      expect(stockAfter.on_hand, "on hand must not move").toBe(stockBefore.on_hand);
      expect(stockAfter.reserved, "reserved must not move").toBe(stockBefore.reserved);
      expect(stockAfter.available, "available must not move").toBe(stockBefore.available);
      expect(movementsAfter, "no ledger row may be written").toBe(movementsBefore);

      /*
       * AND THE SYNC DOES NOT FIGHT THE OPERATOR OVER THEIR OWN COLUMN.
       *
       * `STOCK QTY` is still whatever was typed into it. That is deliberate and
       * it is in the field authority matrix: the column is classified
       * `database`, which means it is never READ as an instruction — not that
       * it is overwritten. The real figure is reported into a column the
       * database owns outright, `SYSTEM AVAILABLE STOCK`, beside it.
       *
       * The first draft of this asserted the opposite and failed, which is the
       * test being wrong about a design that is right.
       */
      expect(Number(reported), "the operator's own cell is left as they typed it").toBe(ABSURD);
      expect(
        Number(await readSheet(availableColumn)),
        "and the truth is reported beside it",
      ).toBe(stockBefore.available);
    } finally {
      /* ------------------------------------------- 6. put it all back */

      await clearOwnConflict("after").catch(() => {});
      await client.from("products").update({ sort_priority: ORIGINAL }).eq("id", subject!.id);
      await writeSheet(priorityColumn, sheetPriorityOriginal === "" ? "" : ORIGINAL);
      await writeSheet(stockColumn, typeof sheetStockOriginal === "boolean" ? "" : sheetStockOriginal);
      await runSync("Sync now").catch(() => {});

      const finalShop = await priorityInShop();
      const finalSheet = await readSheet(priorityColumn);

      say();
      say("  ── PUT BACK ──────────────────────────────────────────────");
      say(`  Shop  ${finalShop} (was ${ORIGINAL})`);
      say(`  Sheet ${JSON.stringify(finalSheet)} (was ${JSON.stringify(sheetPriorityOriginal)})`);

      await browser.close().catch(() => {});

      expect(finalShop, "the shop must be put back").toBe(ORIGINAL);
    }
  }, 1_500_000);
});
