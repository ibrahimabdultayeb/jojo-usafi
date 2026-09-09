import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runCatalogueSync } from "@/lib/sheets/run";

/**
 * The catalogue sync, callable by a trusted server rather than by a person.
 *
 * NOTHING SCHEDULES THIS. Build 09 deliberately ships manual syncing only — no
 * cron, no Apps Script poller, no paid scheduler — because the deployment
 * architecture is not settled and "automatic" that nobody watches is worse than
 * a button somebody presses. This route exists so that when a schedule is
 * decided, the thing it calls already exists, is already authorised and is
 * already audited.
 *
 * IT IS NEVER ANONYMOUS. Without `SHEET_SYNC_WEBHOOK_SECRET` set, the route
 * refuses every request — including one carrying no header at all — so a
 * deployment that forgets to configure it is closed rather than open. The
 * comparison is constant-time, and the secret is never echoed, logged, or
 * included in a response.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorised(request: NextRequest): boolean {
  const expected = process.env.SHEET_SYNC_WEBHOOK_SECRET;

  // Closed by default. A missing secret is not "no authentication required".
  if (!expected || expected.trim().length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (offered.length === 0) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  // Compare lengths first — `timingSafeEqual` throws on a mismatch — and still
  // do a constant-time compare on equal lengths.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    // The same answer whether the secret is wrong or not configured: telling a
    // caller which it is tells them how close they are.
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  try {
    const report = await runCatalogueSync({ dryRun, requestedBy: null });
    return NextResponse.json({
      ok: report.ok,
      dryRun: report.dryRun,
      headline: report.headline,
      detail: report.detail,
      counts: {
        sheetRows: report.sheetRowsSeen,
        products: report.dbRowsSeen,
        updatedInShop: report.toDatabase,
        updatedInSheet: report.toSheet,
        unchanged: report.unchanged,
        conflicts: report.conflicts,
        newInSheet: report.newProducts,
        missingFromSheet: report.missingFromSheet,
        issues: report.issues,
      },
    });
  } catch {
    // A sync failure is a sync failure. It is never allowed to become a 500
    // that a monitoring system reads as "the shop is down".
    return NextResponse.json(
      { ok: false, headline: "The sync could not finish. Nothing was changed." },
      { status: 200 },
    );
  }
}

/** A health answer that reveals nothing: is this route reachable at all. */
export function GET() {
  return NextResponse.json({ ok: true, method: "POST", authenticated: true });
}
