"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, PrimaryAction, SectionTitle, StatTile } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { whenExactly } from "@/lib/admin/format";
import { can, type Role } from "@/lib/admin/permissions";
import { runSyncAction, resolveConflictAction, type SyncActionResult } from "@/lib/sheets/actions";
import type { OpenConflict, SyncOverview } from "@/lib/sheets/status";

/**
 * Catalogue Sync.
 *
 * The screen answers four questions and offers one button, in the same plain
 * language as the rest of the dashboard: is the sheet connected, when did it
 * last run, is anything waiting, and does anything need a decision.
 *
 * It is deliberately NOT a developer console. There is no JSON, no row count of
 * "entities processed", no raw field names and no error stack — what a person
 * gets back is a sentence about their shop.
 */
export function SyncManager({
  overview,
  conflicts,
  role,
}: {
  overview: SyncOverview;
  conflicts: OpenConflict[];
  role: Role;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncActionResult | null>(null);
  // Read here rather than at the point of use: hooks cannot be called inside a
  // conditional, and the value is needed by one tile.
  const lastRunWhen = useShortWhen(overview.lastRun?.at);

  const maySync = can(role, "catalogue.sync");

  function run(operation: () => Promise<SyncActionResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await operation();
      setResult(outcome);
      router.refresh();
    });
  }

  return (
    <>
      {/* Connection */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Google Sheet</p>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              {overview.connected
                ? `Connected · sheet ${overview.spreadsheetHint}`
                : "Not connected yet."}
            </p>
          </div>
          <Badge tone={overview.connected ? "good" : "warn"}>
            {overview.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>

        {!overview.connected && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Jojo Usafi is waiting for the Google settings before it can read the sheet. Nothing is
            broken — the shop, the orders and the product screens all work exactly as they do now.
          </p>
        )}
      </Card>

      {/* The figures */}
      <SectionTitle>Where things stand</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Products" value={String(overview.productCount)} sub="In Jojo Usafi" />
        <StatTile
          label={overview.lastRun?.checkOnly ? "Last checked" : "Last sync"}
          value={lastRunWhen}
          sub={
            overview.lastRun
              ? overview.lastRun.checkOnly
                ? "Checked, nothing changed"
                : outcomeWord(overview.lastRun.status)
              : "Not run yet"
          }
        />
        <StatTile label="Need a decision" value={String(overview.openConflicts)} sub="Sheet and shop disagree" />
        <StatTile label="Sync issues" value={String(overview.recentIssues)} sub="Rows to fix" />
      </div>

      {overview.lastRun?.error && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">The last sync did not finish</p>
          <p className="mt-1 text-sm font-medium text-amber-800">{overview.lastRun.error}</p>
        </Card>
      )}

      {/* The action */}
      {maySync ? (
        <div className="mb-5 space-y-2.5">
          <PrimaryAction icon="sparkle" onClick={() => run(() => runSyncAction(false))} disabled={pending}>
            {pending ? "Working…" : "Sync now"}
          </PrimaryAction>
          <Button variant="secondary" full disabled={pending} onClick={() => run(() => runSyncAction(true))}>
            Check first, change nothing
          </Button>
        </div>
      ) : (
        <Card className="mb-5 p-4">
          <p className="text-sm font-medium text-slate-500">
            Catalogue syncing is looked after by the Owner and Managers.
          </p>
        </Card>
      )}

      {result && (
        <Card className={`mb-5 p-4 ${result.ok ? "" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-sm font-bold ${result.ok ? "text-slate-900" : "text-amber-900"}`}>
            {result.headline}
          </p>
          {result.detail.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.detail.map((line) => (
                <li key={line} className="flex gap-2 text-sm font-medium text-slate-600">
                  <Icon name="chevronRight" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <>
          <SectionTitle>Needs a decision</SectionTitle>
          <p className="mb-3 text-sm font-medium text-slate-500">
            The Google Sheet and Jojo Usafi were both changed, so neither was applied. Choose which
            one is right.
          </p>
          <ul className="mb-5 grid gap-2.5">
            {conflicts.map((conflict) => (
              <li key={conflict.id}>
                <Card className="p-4">
                  <p className="font-display text-base font-bold text-slate-900">
                    {conflict.productName}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {conflict.sku} · {conflict.fieldLabel}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ConflictChoice
                      who="Google Sheet"
                      value={conflict.sheetValue}
                      disabled={pending || !maySync}
                      onChoose={() => run(() => resolveConflictAction(conflict.id, "sheet"))}
                    />
                    <ConflictChoice
                      who="Jojo Usafi"
                      value={conflict.dbValue}
                      disabled={pending || !maySync}
                      onChoose={() => run(() => resolveConflictAction(conflict.id, "database"))}
                    />
                  </div>

                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    Noticed {whenExactly(conflict.detectedAt)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Stock is never taken from the sheet. What is on the shelf comes from deliveries, stock
        counts and orders, and the sheet is shown the current figure rather than asked for one.
      </p>
    </>
  );
}

/**
 * One side of a disagreement. Neither is preselected and neither is styled as
 * the recommended answer — the whole point is that the shop does not know which
 * is right.
 */
function ConflictChoice({
  who,
  value,
  disabled,
  onChoose,
}: {
  who: string;
  value: string;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="flex min-h-16 flex-col items-start justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">{who}</span>
      <span className="font-display text-base font-bold text-slate-900">{value}</span>
      <span className="mt-0.5 text-[11px] font-semibold text-brand-700">Use this one</span>
    </button>
  );
}

/**
 * When the last run happened, in the reader's own timezone.
 *
 * WHY THIS IS A HOOK AND NOT A FUNCTION
 *
 * This is a client component, so its first render happens on the SERVER — and a
 * server in Virginia formats "14:22" where the same moment in Dar es Salaam is
 * "17:22". React compares the two, finds different text, and throws hydration
 * error #418.
 *
 * It never appeared in development because the server and the browser were the
 * same laptop in the same timezone. It appeared on the first real deployment,
 * at four of the five QA widths, which is exactly the class of defect a staging
 * environment exists to find.
 *
 * So the first render — the one the server also produces — is deliberately
 * timezone-free, and the local time is filled in once the component is running
 * in the browser. One frame of "—" is a fair price for a dashboard that does
 * not throw.
 */
function useShortWhen(iso: string | null | undefined): string {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return setLocal(null);
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return setLocal("Unknown");

    const sameDay = new Date().toDateString() === then.toDateString();
    setLocal(
      sameDay
        ? then.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : then.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
  }, [iso]);

  if (!iso) return "Never";
  return local ?? "—";
}

function outcomeWord(status: string): string {
  if (status === "applied") return "Finished";
  if (status === "failed") return "Did not finish";
  if (status === "in_progress") return "Running";
  return "Waiting";
}
