import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { googleStatus } from "./google";
import { FIELD_LABELS, type CatalogueFields } from "./columns";
import { ENTITY_TABLE } from "./run";

/**
 * What the Catalogue Sync screen shows, read under the caller's own session.
 *
 * The four sync tables are readable by an Owner or a Manager and by nobody
 * else, so an Order staff account that reached this URL sees zeroes rather than
 * the shop's pricing history — the same rule the rest of the dashboard follows.
 */

export interface SyncOverview {
  readonly connected: boolean;
  /** What is still missing, when it is not connected. Never a secret value. */
  readonly waitingFor: string[];
  readonly spreadsheetHint: string | null;
  readonly lastRun: {
    readonly at: string;
    readonly status: string;
    readonly applied: number;
    readonly seen: number;
    readonly failed: number;
    readonly error: string | null;
    /** A dry run is a check, not a sync. The screen must not conflate them. */
    readonly checkOnly: boolean;
  } | null;
  readonly productCount: number;
  readonly openConflicts: number;
  readonly recentIssues: number;
}

export async function getSyncOverview(): Promise<SyncOverview> {
  const supabase = await getServerSupabase();
  const status = googleStatus();

  const [{ count: productCount }, { data: job }, { count: conflicts }, { count: issues }] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase
        .from("sync_jobs")
        .select("finished_at, created_at, status, rows_applied, rows_seen, rows_failed, error_message, idempotency_key")
        .eq("entity_table", ENTITY_TABLE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sync_conflicts")
        .select("id", { count: "exact", head: true })
        .eq("entity_table", ENTITY_TABLE)
        .eq("resolution", "pending"),
      supabase
        .from("sync_events")
        .select("id", { count: "exact", head: true })
        .eq("entity_table", ENTITY_TABLE)
        .eq("status", "failed"),
    ]);

  return {
    connected: status.configured,
    waitingFor: status.configured ? [] : status.missing,
    // The spreadsheet ID is a location, not a credential — but only its tail is
    // shown, because a full ID pasted into a screenshot is a link to the sheet.
    spreadsheetHint: status.configured ? `…${status.config.spreadsheetId.slice(-6)}` : null,
    lastRun: job
      ? {
          at: job.finished_at ?? job.created_at,
          status: job.status,
          applied: job.rows_applied,
          seen: job.rows_seen,
          failed: job.rows_failed,
          error: job.error_message,
          // The run key carries ":dry" or ":live" — see runCatalogueSync. A
          // check that changed nothing must not read as a completed sync.
          checkOnly: String(job.idempotency_key ?? "").endsWith(":dry"),
        }
      : null,
    productCount: productCount ?? 0,
    openConflicts: conflicts ?? 0,
    recentIssues: issues ?? 0,
  };
}

export interface OpenConflict {
  readonly id: string;
  readonly sku: string;
  readonly productName: string;
  readonly field: string;
  readonly fieldLabel: string;
  readonly sheetValue: string;
  readonly dbValue: string;
  readonly detectedAt: string;
}

/** How a value reads on screen. Money as money, switches as Yes and No. */
function display(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "priceTzs" || field === "offerPriceTzs") {
    return `TSh ${Number(value).toLocaleString("en-TZ")}`;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export async function getOpenConflicts(): Promise<OpenConflict[]> {
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("sync_conflicts")
    .select("id, entity_key, field, sheet_value, db_value, detected_at")
    .eq("entity_table", ENTITY_TABLE)
    .eq("resolution", "pending")
    .order("detected_at", { ascending: true });

  if (error || !data || data.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("sku, display_name")
    .in("sku", [...new Set(data.map((row) => row.entity_key))]);

  const names = new Map((products ?? []).map((p) => [p.sku, p.display_name]));

  return data.map((row) => ({
    id: row.id,
    sku: row.entity_key,
    productName: names.get(row.entity_key) ?? row.entity_key,
    field: row.field,
    fieldLabel: FIELD_LABELS[row.field as keyof CatalogueFields] ?? row.field,
    sheetValue: display(row.field, row.sheet_value),
    dbValue: display(row.field, row.db_value),
    detectedAt: row.detected_at,
  }));
}
