"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { authorize } from "@/lib/admin/authorize";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { runCatalogueSync, fieldsForSku, recordResolvedBase, type RunReport } from "./run";
import { FIELD_LABELS, type CatalogueFields } from "./columns";

/**
 * The two things a person can do to the catalogue sync, as authorised server
 * actions.
 *
 * Both go through `authorize("catalogue.sync")` first, which is Owner and
 * Manager only — an Order staff account is refused here and, independently,
 * refused by Row Level Security if it somehow reached the tables.
 */

export interface SyncActionResult {
  readonly ok: boolean;
  readonly headline: string;
  readonly detail: string[];
}

const refuse = (message: string): SyncActionResult => ({ ok: false, headline: message, detail: [] });

function afterSync(): void {
  // A synced price change must reach the shop as fast as a dashboard one does.
  revalidateTag("catalogue");
  revalidatePath("/admin/more/catalogue-sync");
  revalidatePath("/admin/products");
}

export async function runSyncAction(dryRun: boolean): Promise<SyncActionResult> {
  const auth = await authorize("catalogue.sync");
  if (!auth.ok) return refuse(auth.message);

  let report: RunReport;
  try {
    report = await runCatalogueSync({ dryRun, requestedBy: auth.staff.adminId });
  } catch {
    // A sync that throws must never look like a shop that is broken. The
    // storefront, checkout and every admin operation are untouched by this
    // failing — none of them import the sync at all.
    return {
      ok: false,
      headline: "The sync could not finish.",
      detail: ["Nothing in Jojo Usafi was changed. Try again in a moment."],
    };
  }

  if (!dryRun) afterSync();

  return { ok: report.ok, headline: report.headline, detail: report.detail };
}

export type ConflictSide = "sheet" | "database";

/**
 * Settle one disagreement.
 *
 * There is no default and no "newest wins": a person picks a side, the chosen
 * value is written to the database, the conflict is closed with their name on
 * it, and the next sync carries the decision back to the sheet.
 */
export async function resolveConflictAction(
  conflictId: string,
  side: ConflictSide,
): Promise<SyncActionResult> {
  const auth = await authorize("catalogue.sync");
  if (!auth.ok) return refuse(auth.message);

  const db = getServiceRoleSupabase();

  const { data: conflict, error } = await db
    .from("sync_conflicts")
    .select("id, entity_key, field, sheet_value, db_value, resolution")
    .eq("id", conflictId)
    .maybeSingle();

  if (error || !conflict) return refuse("That disagreement is no longer there.");
  if (conflict.resolution !== "pending") return refuse("Somebody has already settled this one.");

  const label = FIELD_LABELS[conflict.field as keyof CatalogueFields] ?? conflict.field;

  if (side === "sheet") {
    const column = COLUMN_FOR[conflict.field as keyof CatalogueFields];
    if (!column) {
      return refuse(`${label} cannot be settled automatically. Change it in the dashboard instead.`);
    }

    const { error: writeError } = await db
      .from("products")
      .update({ [column]: conflict.sheet_value } as never)
      .eq("sku", conflict.entity_key);

    if (writeError) {
      return refuse(`The sheet's value could not be saved: ${writeError.message}`);
    }
  }

  await db
    .from("sync_conflicts")
    .update({
      resolution: side === "sheet" ? "sheet_wins" : "db_wins",
      resolved_by: auth.staff.adminId,
      resolved_at: new Date().toISOString(),
      note: `Settled by ${auth.staff.name} in the dashboard.`,
    })
    .eq("id", conflictId);

  /*
    Record what the two sides now agree on, so the decision sticks.

    Clearing `sync_state` alone was not enough and was a real defect: the base
    lives in `sync_events`, so the same disagreement would be detected again on
    the very next run and the person's decision would be asked for for ever.

    When the shop wins, the base is recorded as the SHEET's rejected value on
    purpose — that makes the database read as changed and the sheet as
    unchanged, so the next run carries the decision out to the sheet.
  */
  const fields = await fieldsForSku(conflict.entity_key);
  if (fields) {
    const agreed: CatalogueFields = { ...fields };
    if (side === "database") {
      (agreed as unknown as Record<string, unknown>)[conflict.field] = conflict.sheet_value;
    }
    await recordResolvedBase(conflict.entity_key, agreed, side === "sheet" ? "sheet" : "admin");
  }

  afterSync();

  return {
    ok: true,
    headline: `${conflict.entity_key} — ${label} settled.`,
    detail: [
      side === "sheet"
        ? "The Google Sheet's value is now the one Jojo Usafi uses."
        : "Jojo Usafi keeps its value. The sheet is updated on the next sync.",
    ],
  };
}

/** Which real column each settleable field writes to. Relationships are absent on purpose. */
const COLUMN_FOR: Partial<Record<keyof CatalogueFields, string>> = {
  displayName: "display_name",
  packSizeLabel: "pack_size_label",
  ean: "ean",
  itf14: "itf14",
  priceTzs: "price_tzs",
  offerPriceTzs: "offer_price_tzs",
  storefrontVisible: "storefront_visible",
  featured: "featured",
  bestSeller: "best_seller",
  lifecycle: "lifecycle",
  lowStockThreshold: "low_stock_threshold",
  sortPriority: "sort_priority",
  slug: "slug",
};
