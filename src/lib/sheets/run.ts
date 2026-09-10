import "server-only";

import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { fingerprint, idempotencyKey, type SyncStateRecord } from "@/lib/domain/sync";
import { GoogleUnavailable, googleSheetGateway, googleStatus, type SheetGateway } from "./google";
import { KNOWN_HEADERS, type CatalogueFields } from "./columns";
import { toSnapshot, type SheetSnapshot } from "./rows";
import { planSync, reportCells, sheetCellsFor, type DbProduct, type SyncPlan } from "./plan";

/**
 * One synchronisation run, start to finish.
 *
 * The ten steps of the Build 09 brief, in order, with the pure decision
 * (`planSync`) in the middle and everything with a side effect on the outside:
 *
 *   read the sheet → load the database → PLAN → apply → write back → record
 *
 * WHY THE SERVICE ROLE. A sync run writes products, `sync_state`, `sync_events`
 * and `sync_jobs` in one pass, and three of those four have no INSERT policy
 * for a browser token because they are ledgers. The key never leaves the server
 * and this module is `server-only`; the caller has already passed `authorize()`
 * before reaching here, and the protected endpoint checks its own secret.
 *
 * WHY GOOGLE FAILING IS NOT AN OUTAGE. Every Google call is wrapped. If the
 * sheet is unreachable the run is recorded as failed, the shop is untouched,
 * and the storefront, checkout and the admin's own product writes carry on
 * exactly as before — none of them import this file.
 */

export const ENTITY_TABLE = "products";

export interface RunOptions {
  readonly dryRun: boolean;
  /** The admin profile asking. Null for the protected scheduled path. */
  readonly requestedBy: string | null;
  /** Swapped for an in-memory sheet by the tests. */
  readonly gateway?: SheetGateway;
  /**
   * When set, ONLY these fields may flow Sheet → Supabase. Everything else the
   * plan proposes is held: not applied, not recorded as agreed, and therefore
   * proposed again next time until somebody decides about it.
   *
   * This exists because approval is field-specific in practice. Ibrahim
   * approved website visibility and display order and deliberately held one
   * product description for content review — and "apply the plan" would have
   * been all three or none.
   *
   * Holding a field is safe precisely because the agreement is recorded from
   * what was APPLIED. The held difference stays a difference, so it keeps being
   * offered rather than quietly disappearing.
   */
  readonly applyFields?: readonly (keyof CatalogueFields)[];
}

export interface RunReport {
  readonly ok: boolean;
  readonly dryRun: boolean;
  readonly jobId: string | null;
  /** One sentence for the operator. Never JSON, never a stack trace. */
  readonly headline: string;
  readonly detail: string[];
  readonly sheetRowsSeen: number;
  readonly dbRowsSeen: number;
  readonly toDatabase: number;
  readonly toSheet: number;
  readonly unchanged: number;
  readonly echoes: number;
  readonly conflicts: number;
  readonly newProducts: number;
  readonly missingFromSheet: number;
  readonly issues: number;
  readonly failedBecause: string | null;
}

/* ------------------------------------------------------- database reading */

type Service = ReturnType<typeof getServiceRoleSupabase>;

const PRODUCT_SELECT = `
  id, sku, slug, display_name, variant_label, pack_size_label,
  price_tzs, offer_price_tzs, storefront_visible, featured, best_seller,
  lifecycle, low_stock_threshold, sort_priority, ean, itf14,
  brands ( name ), categories ( name ),
  inventory ( available ),
  product_media ( role ),
  product_content ( locale, description )
`;

/** The catalogue as the comparison needs it, plus the reporting figures. */
async function loadProducts(db: Service): Promise<DbProduct[]> {
  const { data, error } = await db.from("products").select(PRODUCT_SELECT).order("sku");
  if (error) throw new Error(`Could not read the catalogue: ${error.message}`);

  return (data ?? []).map((row) => {
    const one = <T,>(value: T | T[] | null): T | null =>
      Array.isArray(value) ? (value[0] ?? null) : value;

    const stock = one(row.inventory as { available: number | null }[] | null);
    const media = (Array.isArray(row.product_media) ? row.product_media : []) as { role: string }[];
    const content = (Array.isArray(row.product_content) ? row.product_content : []) as {
      locale: string;
      description: string | null;
    }[];

    const hasImage = media.some((m) => m.role === "primary");
    const available = stock?.available ?? 0;
    const onWebsite = row.lifecycle === "active" && row.storefront_visible && hasImage;

    const blocked: string[] = [];
    if (!hasImage) blocked.push("no approved photo");
    if (row.lifecycle !== "active") blocked.push(`status is ${row.lifecycle}`);
    if (!row.storefront_visible) blocked.push("switched off");

    return {
      id: row.id,
      sku: row.sku,
      fields: {
        displayName: row.display_name,
        variantLabel: row.variant_label,
        packSizeLabel: row.pack_size_label,
        categoryName: one(row.categories as unknown as { name: string }[] | null)?.name ?? "",
        brandName: one(row.brands as unknown as { name: string }[] | null)?.name ?? "",
        ean: row.ean,
        itf14: row.itf14,
        priceTzs: row.price_tzs,
        offerPriceTzs: row.offer_price_tzs,
        storefrontVisible: row.storefront_visible,
        featured: row.featured,
        bestSeller: row.best_seller,
        lifecycle: row.lifecycle as CatalogueFields["lifecycle"],
        lowStockThreshold: row.low_stock_threshold,
        sortPriority: row.sort_priority,
        slug: row.slug,
        description: content.find((c) => c.locale === "en")?.description ?? null,
      },
      report: {
        availableStock: available,
        hasImage,
        onWebsite,
        blockedReason: onWebsite ? "" : blocked.join(", "),
      },
    };
  });
}

/**
 * The last agreed values, per SKU.
 *
 * `sync_state` holds fingerprints rather than values — it is a loop breaker,
 * not a mirror — so the values themselves are kept in `sync_events` under a
 * dedicated `base` operation. That keeps the base auditable: it is a row that
 * says "on this date, both sides agreed this is what the product was".
 */
async function loadState(db: Service): Promise<{
  state: Map<string, SyncStateRecord>;
  base: Map<string, CatalogueFields>;
}> {
  const state = new Map<string, SyncStateRecord>();
  const base = new Map<string, CatalogueFields>();

  // Paged for the same reason as the bases below: PostgREST caps a response at
  // 1000 rows and says nothing about it. One row per product is under that
  // today, and a catalogue of 1200 products would silently lose the last 200.
  for (let page = 0; page < 50; page += 1) {
    const from = page * 1000;
    const { data: rows, error } = await db
      .from("sync_state")
      .select("entity_key, version, db_fingerprint, sheet_fingerprint, last_source")
      .eq("entity_table", ENTITY_TABLE)
      .order("entity_key")
      .range(from, from + 999);

    if (error || !rows || rows.length === 0) break;

    for (const row of rows) {
      state.set(row.entity_key, {
        entityTable: ENTITY_TABLE,
        entityKey: row.entity_key,
        version: Number(row.version),
        dbFingerprint: row.db_fingerprint,
        sheetFingerprint: row.sheet_fingerprint,
        lastSource: row.last_source,
      });
    }

    if (rows.length < 1000) break;
  }

  /*
    NEWEST FIRST, AND PAGED. THIS IS NOT A STYLE CHOICE.

    This used to be one unbounded select ordered oldest-first, taking the last
    row per key as the base. PostgREST caps a response at 1000 rows, silently.
    With 201 products and a handful of runs there were 1993 base rows, so the
    query returned the OLDEST 1000 and every base the sync compared against was
    months of runs out of date — invisibly, with no error anywhere.

    It surfaced as a settled conflict refusing to stick: the decision was
    written, the next run read a stale base, and the sheet kept asserting the
    value a person had just rejected.

    Reading newest-first and keeping the first occurrence of each key makes the
    result correct regardless of how much history there is.
  */
  const PAGE = 1000;
  const MAX_PAGES = 50; // 50,000 rows. Far beyond what pruning below leaves.

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data: agreed, error } = await db
      .from("sync_events")
      .select("entity_key, field_changes")
      .eq("entity_table", ENTITY_TABLE)
      .eq("operation", "upsert")
      .eq("status", "applied")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error || !agreed || agreed.length === 0) break;

    for (const row of agreed) {
      // Newest first, so the first one seen for a key is the current one.
      if (base.has(row.entity_key)) continue;
      const fields = (row.field_changes as { base?: CatalogueFields } | null)?.base;
      if (fields) base.set(row.entity_key, fields);
    }

    if (agreed.length < PAGE) break;
  }

  return { state, base };
}

/**
 * Remove base snapshots that a newer one has replaced.
 *
 * `sync_events` carries two different kinds of row. An `update` row is history —
 * what changed, which way, from what to what — and is never touched. An
 * `upsert` row is not history: it is a snapshot of what the two sides agreed on
 * at that moment, and only the newest one per product means anything.
 *
 * Left alone they accumulate at 201 rows per run, which is what pushed the
 * loader past PostgREST's response cap in the first place.
 */
async function pruneSupersededBases(
  db: Service,
  skus: readonly string[],
  writtenAfter: string,
): Promise<void> {
  if (skus.length === 0) return;

  // One delete per chunk of keys, not one per product: anything older than the
  // batch just written is, by definition, superseded.
  for (let i = 0; i < skus.length; i += 200) {
    await db
      .from("sync_events")
      .delete()
      .eq("entity_table", ENTITY_TABLE)
      .eq("operation", "upsert")
      .eq("status", "applied")
      .lt("created_at", writtenAfter)
      .in("entity_key", skus.slice(i, i + 200));
  }
}

async function openConflictSkus(db: Service): Promise<Set<string>> {
  const { data } = await db
    .from("sync_conflicts")
    .select("entity_key")
    .eq("entity_table", ENTITY_TABLE)
    .eq("resolution", "pending");
  return new Set((data ?? []).map((row) => row.entity_key));
}

/* --------------------------------------------------------------- the run */

export async function runCatalogueSync(options: RunOptions): Promise<RunReport> {
  const db = getServiceRoleSupabase();
  const startedAt = new Date().toISOString();

  const status = googleStatus();
  const gateway =
    options.gateway ?? (status.configured ? googleSheetGateway(status.config) : null);

  if (!gateway) {
    return failed(
      "Google Sheets is not connected yet.",
      [
        `Waiting for: ${status.configured ? "" : (status as { missing: string[] }).missing.join(", ")}.`,
        "Nothing was changed.",
      ],
      options.dryRun,
    );
  }

  // A job row exists before anything is read, so a run that dies mid-way is
  // still visible as a run that happened.
  const runKey = idempotencyKey({
    direction: "sheet_to_db",
    entityTable: ENTITY_TABLE,
    entityKey: "catalogue",
    operation: "upsert",
    fingerprint: `${startedAt}:${options.dryRun ? "dry" : "live"}`,
  });

  const { data: job } = await db
    .from("sync_jobs")
    .insert({
      direction: "sheet_to_db",
      source: "sheet",
      entity_table: ENTITY_TABLE,
      status: "in_progress",
      idempotency_key: runKey,
      requested_by: options.requestedBy,
      started_at: startedAt,
    })
    .select("id")
    .single();

  const jobId = job?.id ?? null;

  let snapshot: SheetSnapshot;
  try {
    snapshot = toSnapshot(await gateway.readGrid());
  } catch (error) {
    const problem =
      error instanceof GoogleUnavailable
        ? { message: error.message, detail: error.detail }
        : { message: "Could not read the Google Sheet.", detail: "" };

    await finishJob(db, jobId, "failed", { errorMessage: problem.message, detail: problem.detail });
    return failed(problem.message, [problem.detail, "The shop is unaffected — nothing was changed."].filter(Boolean), options.dryRun, jobId);
  }

  const [products, { state, base }, blockedByConflict] = await Promise.all([
    loadProducts(db),
    loadState(db),
    openConflictSkus(db),
  ]);

  const plan = planSync({ snapshot, products, state, base, blockedByConflict });

  if (!plan.ok) {
    await finishJob(db, jobId, "failed", {
      errorMessage: plan.stopped ?? "The sheet could not be read.",
      detail: "",
      rowsSeen: plan.sheetRowsSeen,
    });
    return failed(
      "The sheet's columns have changed, so nothing was synced.",
      [plan.stopped ?? "", "Put the columns back, or ask for the new ones to be added to the sync."].filter(Boolean),
      options.dryRun,
      jobId,
    );
  }

  if (options.dryRun) {
    await finishJob(db, jobId, "applied", {
      rowsSeen: plan.sheetRowsSeen,
      rowsSkipped: plan.sheetRowsSeen,
    });
    return describe(plan, true, jobId, null);
  }

  /* ----------------------------------------------------------- apply */

  let applied = 0;
  let failures = 0;
  const notes: string[] = [];

  // Narrow the plan to the fields this run is allowed to apply, BEFORE anything
  // is written and before the agreement is computed from it.
  const allowed = options.applyFields ? new Set<string>(options.applyFields) : null;
  let heldFields = 0;
  let heldProducts = 0;

  const toApply = !allowed
    ? plan.toDatabase
    : plan.toDatabase.flatMap((change) => {
        const kept: Partial<CatalogueFields> = {};
        let held = 0;
        for (const [field, value] of Object.entries(change.changes)) {
          if (allowed.has(field)) (kept as Record<string, unknown>)[field] = value;
          else held += 1;
        }
        if (held > 0) {
          heldFields += held;
          heldProducts += 1;
        }
        return Object.keys(kept).length === 0 ? [] : [{ ...change, changes: kept }];
      });

  if (heldFields > 0) {
    notes.push(
      `${heldFields} change(s) on ${heldProducts} product(s) were left for a decision and not applied.`,
    );
  }

  // Everything downstream — the agreement included — sees only what was applied.
  const effective: SyncPlan = { ...plan, toDatabase: toApply };

  for (const change of toApply) {
    const patch = toColumnPatch(change.changes);
    const { error } = await db
      .from("products")
      .update(patch.columns as never)
      .eq("id", change.productId);

    if (error) {
      failures += 1;
      notes.push(`${change.sku} could not be updated: ${error.message}`);
      await recordEvent(db, jobId, {
        sku: change.sku,
        row: change.row,
        operation: "update",
        direction: "sheet_to_db",
        status: "failed",
        fields: change.changes,
        fingerprintValue: change.fingerprint,
        errorMessage: error.message,
      });
      continue;
    }

    if (patch.description !== undefined) {
      await writeDescription(db, change.productId, change.sku, patch.description);
    }

    applied += 1;
    await recordEvent(db, jobId, {
      sku: change.sku,
      row: change.row,
      operation: "update",
      direction: "sheet_to_db",
      status: "applied",
      fields: change.changes,
      before: change.before,
      fingerprintValue: change.fingerprint,
    });
  }

  /* ------------------------------------------------ conflicts, recorded */

  for (const conflict of plan.conflicts) {
    for (const field of conflict.conflicts) {
      const { data: existing } = await db
        .from("sync_conflicts")
        .select("id")
        .eq("entity_table", ENTITY_TABLE)
        .eq("entity_key", conflict.sku)
        .eq("field", field.field)
        .eq("resolution", "pending")
        .maybeSingle();

      // The same unresolved disagreement must not pile up one row per run.
      if (existing) continue;

      await db.from("sync_conflicts").insert({
        entity_table: ENTITY_TABLE,
        entity_key: conflict.sku,
        field: field.field,
        sheet_value: field.sheetValue as never,
        db_value: field.dbValue as never,
        resolution: "pending",
      });
    }
  }

  /* -------------------------------------------------- write to the sheet */

  let sheetCellsWritten = 0;
  const headerIndex = new Map(snapshot.headers.map((header, index) => [header, index]));

  // Append the system columns if the sheet does not have them yet, so the
  // operator's own layout is never disturbed — only extended to the right.
  let headersFailed: string | null = null;

  if (plan.headerCheck.toAppend.length > 0) {
    try {
      await gateway.appendHeaders(plan.headerCheck.toAppend, snapshot.headers.length);
      plan.headerCheck.toAppend.forEach((header, offset) =>
        headerIndex.set(header, snapshot.headers.length + offset),
      );
      notes.push(`Added ${plan.headerCheck.toAppend.length} read-only system column(s) to the sheet.`);
    } catch (error) {
      // NOT a note-and-carry-on. Without those columns every cell destined for
      // them is silently dropped, so the run would report "Sync complete",
      // record an agreement, and leave the sheet with none of the information
      // the agreement claims it has. The first real run against the Product
      // Master did exactly that: the grid was 39 columns wide, Google refused
      // the write, and the failure arrived as a cheerful success.
      headersFailed =
        error instanceof GoogleUnavailable ? error.message : "The system columns could not be added.";
      notes.push(`${headersFailed} Nothing was recorded as agreed, so the next run will try again.`);
    }
  }

  const updates = plan.toSheet.flatMap((change) =>
    Object.entries(change.cells).flatMap(([header, value]) => {
      const column = headerIndex.get(header);
      return column === undefined ? [] : [{ row: change.row, column, value }];
    }),
  );

  let sheetWriteFailed: string | null = null;
  if (updates.length > 0) {
    try {
      await gateway.writeCells(updates);
      sheetCellsWritten = updates.length;
      for (const change of plan.toSheet) {
        await recordEvent(db, jobId, {
          sku: change.sku,
          row: change.row,
          operation: "update",
          direction: "db_to_sheet",
          status: "applied",
          fields: Object.fromEntries(change.fields.map((f) => [f, change.cells])) as Record<string, unknown>,
          fingerprintValue: change.fingerprint,
        });
      }
    } catch (error) {
      // The database half is already saved and correct. The sheet is simply
      // behind, and the next run will bring it up — which is the whole reason
      // the two halves are applied separately.
      sheetWriteFailed =
        error instanceof GoogleUnavailable ? error.message : "The sheet could not be updated.";
      notes.push(`${sheetWriteFailed} Everything saved in Jojo Usafi is safe; the sheet will catch up on the next sync.`);
    }
  }

  /* -------------------------------------------------- record the agreement */

  /*
    AN AGREEMENT IS ONLY RECORDED IF BOTH SIDES ACTUALLY GOT THERE.

    `sync_state` says "this is what the two last agreed on", and everything
    afterwards is measured against it: an echo, a stale write, a conflict.
    Writing it after a half-finished run would make the next comparison start
    from a version of the sheet that never existed — the sheet would look
    unchanged when it had never been changed at all, and the difference would
    be invisible forever.

    So a failed sheet write, or system columns that could not be created, means
    no agreement. The database half stands (it is correct and already saved),
    and the next run simply does the sheet half again.
  */
  const sheetIsBehind = headersFailed ?? sheetWriteFailed;

  if (!sheetIsBehind) {
    await recordAgreement(db, jobId, effective, products);
  }

  const failedOverall = failures > 0 || sheetIsBehind !== null;

  await finishJob(db, jobId, failedOverall ? "failed" : "applied", {
    rowsSeen: plan.sheetRowsSeen,
    rowsApplied: applied,
    rowsSkipped: plan.unchanged + plan.echoes,
    rowsFailed: failures,
    errorMessage:
      failures > 0
        ? `${failures} row(s) could not be applied.`
        : (sheetIsBehind ?? undefined),
  });

  return describe(effective, false, jobId, sheetIsBehind, {
    applied,
    sheetCellsWritten,
    notes,
    failures,
  });
}

/* ---------------------------------------------------------------- writes */

/** Catalogue fields → real column names. Nothing operational can appear here. */
function toColumnPatch(changes: Partial<CatalogueFields>): {
  columns: Record<string, unknown>;
  description?: string | null;
} {
  const columns: Record<string, unknown> = {};
  let description: string | null | undefined;

  for (const [field, value] of Object.entries(changes)) {
    switch (field as keyof CatalogueFields) {
      case "displayName": columns.display_name = value; break;
      case "packSizeLabel": columns.pack_size_label = value; break;
      case "ean": columns.ean = value; break;
      case "itf14": columns.itf14 = value; break;
      case "priceTzs": columns.price_tzs = value; break;
      case "offerPriceTzs": columns.offer_price_tzs = value; break;
      case "storefrontVisible": columns.storefront_visible = value; break;
      case "featured": columns.featured = value; break;
      case "bestSeller": columns.best_seller = value; break;
      case "lifecycle": columns.lifecycle = value; break;
      case "lowStockThreshold": columns.low_stock_threshold = value; break;
      case "sortPriority": columns.sort_priority = value; break;
      case "slug": columns.slug = value; break;
      case "description": description = value as string | null; break;
      // Brand and category are relationships. Changing which brand a product
      // belongs to is a catalogue restructure, not a cell edit, so the sheet
      // may disagree and be reported but may not repoint the foreign key.
      case "categoryName":
      case "brandName":
      case "variantLabel":
        break;
    }
  }

  return description === undefined ? { columns } : { columns, description };
}

async function writeDescription(
  db: Service,
  productId: string,
  sku: string,
  description: string | null,
): Promise<void> {
  const { data: existing } = await db
    .from("product_content")
    .select("product_id")
    .eq("product_id", productId)
    .eq("locale", "en")
    .maybeSingle();

  if (existing) {
    await db
      .from("product_content")
      .update({ description })
      .eq("product_id", productId)
      .eq("locale", "en");
    return;
  }

  const { data: product } = await db
    .from("products")
    .select("display_name")
    .eq("id", productId)
    .single();

  await db.from("product_content").insert({
    product_id: productId,
    locale: "en",
    name: product?.display_name ?? sku,
    description,
  });
}

/* ---------------------------------------------------------------- audit */

interface EventInput {
  sku: string;
  row: number;
  operation: "insert" | "update" | "delete" | "upsert";
  direction: "sheet_to_db" | "db_to_sheet";
  status: "applied" | "failed" | "conflict" | "skipped_echo" | "pending";
  fields: Record<string, unknown>;
  before?: CatalogueFields;
  fingerprintValue: string;
  errorMessage?: string;
}

/**
 * One row per attempted change, carrying enough to answer the four questions
 * the brief asks: what changed, which way, which field, and from what to what.
 */
async function recordEvent(db: Service, jobId: string | null, input: EventInput): Promise<void> {
  const before: Record<string, unknown> = {};
  if (input.before) {
    for (const field of Object.keys(input.fields)) {
      before[field] = (input.before as unknown as Record<string, unknown>)[field];
    }
  }

  await db.from("sync_events").insert({
    job_id: jobId,
    source: input.direction === "sheet_to_db" ? "sheet" : "admin",
    direction: input.direction,
    operation: input.operation,
    entity_table: ENTITY_TABLE,
    entity_key: input.sku,
    field_changes: { after: input.fields, before } as never,
    fingerprint: input.fingerprintValue,
    status: input.status,
    idempotency_key: idempotencyKey({
      direction: input.direction,
      entityTable: ENTITY_TABLE,
      entityKey: input.sku,
      operation: input.operation,
      fingerprint: `${input.fingerprintValue}:${jobId ?? "none"}`,
    }),
    sheet_row: input.row,
    applied_at: input.status === "applied" ? new Date().toISOString() : null,
    error_message: input.errorMessage,
  });
}

/**
 * Write down what the two sides now agree on — the base for next time — and
 * the fingerprints that make the next run's echo detection work.
 */
async function recordAgreement(
  db: Service,
  jobId: string | null,
  plan: SyncPlan,
  products: readonly DbProduct[],
): Promise<void> {
  const touched = new Set([
    ...plan.toDatabase.map((c) => c.sku),
    ...plan.toSheet.map((c) => c.sku),
  ]);
  if (touched.size === 0) return;

  const bySku = new Map(products.map((p) => [p.sku, p]));
  const changeBySku = new Map(plan.toDatabase.map((c) => [c.sku, c]));
  const sheetRowBySku = new Map(plan.toSheet.map((c) => [c.sku, c.row]));
  const now = new Date().toISOString();

  /*
    WRITTEN IN BATCHES, NOT ONE PRODUCT AT A TIME.

    This used to be two round trips per SKU. Against 201 real products that is
    402 sequential calls to Mumbai, and the first real catalogue run was killed
    by a five-minute timeout in the middle of them — after every product update
    had already landed. The work was right and the bookkeeping was cut in half,
    which is the worst place to be interrupted.

    A partial agreement is survivable — a stale base makes the next run see both
    sides having changed to the SAME value, which is not a conflict and not a
    change — but "survivable" is not a reason to keep doing it 402 times.
  */
  const states: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  for (const sku of touched) {
    const product = bySku.get(sku);
    if (!product) continue;

    // The agreed values are the database's, AFTER this run's changes — that is
    // what both sides now hold.
    const change = changeBySku.get(sku);
    const agreed: CatalogueFields = { ...product.fields, ...(change?.changes ?? {}) };

    const comparable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(agreed)) {
      if (key !== "variantLabel") comparable[key] = value;
    }
    const print = fingerprint(comparable);

    states.push({
      entity_table: ENTITY_TABLE,
      entity_key: sku,
      entity_id: product.id,
      db_fingerprint: print,
      sheet_fingerprint: print,
      last_source: change ? "sheet" : "admin",
      last_synced_at: now,
      sheet_row: change?.row ?? sheetRowBySku.get(sku) ?? null,
    });

    events.push({
      job_id: jobId,
      source: "system",
      direction: "sheet_to_db",
      operation: "upsert",
      entity_table: ENTITY_TABLE,
      entity_key: sku,
      field_changes: { base: agreed },
      fingerprint: print,
      status: "applied",
      idempotency_key: idempotencyKey({
        direction: "sheet_to_db",
        entityTable: ENTITY_TABLE,
        entityKey: sku,
        operation: "upsert",
        fingerprint: `${print}:${jobId ?? now}`,
      }),
      applied_at: now,
    });
  }

  // Chunked so one oversized request cannot fail the lot, and so a very large
  // catalogue does not arrive as a single enormous body.
  const CHUNK = 100;
  const cutoff = new Date().toISOString();

  for (let i = 0; i < states.length; i += CHUNK) {
    const { error } = await db
      .from("sync_state")
      .upsert(states.slice(i, i + CHUNK) as never, { onConflict: "entity_table,entity_key" });
    if (error) throw new Error(`Could not record the agreement: ${error.message}`);
  }
  for (let i = 0; i < events.length; i += CHUNK) {
    const { error } = await db.from("sync_events").insert(events.slice(i, i + CHUNK) as never);
    if (error) throw new Error(`Could not record the agreement: ${error.message}`);
  }

  await pruneSupersededBases(db, [...touched], cutoff);
}

/**
 * Write the agreed base for ONE product, after a person has settled a conflict.
 *
 * Deleting `sync_state` is not enough on its own, and that was a real defect:
 * the base lives in `sync_events`, so a resolved conflict would be re-detected
 * on the very next run and the decision would never stick.
 *
 * What the base has to say depends on who won, and the asymmetry is the point:
 *
 *   the sheet won   both sides now hold the chosen value, so the base is that
 *                   value and neither side has anything to say.
 *   the shop won    the sheet still holds the REJECTED value, so the base is
 *                   recorded as that rejected value. The database then reads as
 *                   changed and the sheet as unchanged, and the next run carries
 *                   the decision out to the sheet — which is what "use Jojo
 *                   Usafi" has to mean, or the sheet would simply re-assert
 *                   itself for ever.
 */
export async function recordResolvedBase(
  sku: string,
  agreed: CatalogueFields,
  source: "sheet" | "admin",
): Promise<void> {
  const db = getServiceRoleSupabase();
  const now = new Date().toISOString();

  const comparable: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(agreed)) {
    if (key !== "variantLabel") comparable[key] = value;
  }
  const print = fingerprint(comparable);

  const { data: product } = await db.from("products").select("id").eq("sku", sku).maybeSingle();

  await db.from("sync_events").insert({
    source: "system",
    direction: "sheet_to_db",
    operation: "upsert",
    entity_table: ENTITY_TABLE,
    entity_key: sku,
    field_changes: { base: agreed } as never,
    fingerprint: print,
    status: "applied",
    idempotency_key: idempotencyKey({
      direction: "sheet_to_db",
      entityTable: ENTITY_TABLE,
      entityKey: sku,
      operation: "upsert",
      fingerprint: `${print}:resolved:${now}`,
    }),
    applied_at: now,
  });

  await pruneSupersededBases(getServiceRoleSupabase(), [sku], now);

  await db.from("sync_state").upsert(
    {
      entity_table: ENTITY_TABLE,
      entity_key: sku,
      entity_id: product?.id ?? null,
      db_fingerprint: print,
      sheet_fingerprint: print,
      last_source: source,
      last_synced_at: now,
    },
    { onConflict: "entity_table,entity_key" },
  );
}

/** The catalogue fields of one product, for building a resolved base. */
export async function fieldsForSku(sku: string): Promise<CatalogueFields | null> {
  const db = getServiceRoleSupabase();
  const products = await loadProducts(db);
  return products.find((p) => p.sku === sku)?.fields ?? null;
}

async function finishJob(
  db: Service,
  jobId: string | null,
  status: "applied" | "failed",
  counts: {
    rowsSeen?: number;
    rowsApplied?: number;
    rowsSkipped?: number;
    rowsFailed?: number;
    errorMessage?: string;
    detail?: string;
  },
): Promise<void> {
  if (!jobId) return;
  await db
    .from("sync_jobs")
    .update({
      status,
      rows_seen: counts.rowsSeen ?? 0,
      rows_applied: counts.rowsApplied ?? 0,
      rows_skipped: counts.rowsSkipped ?? 0,
      rows_failed: counts.rowsFailed ?? 0,
      error_message: counts.errorMessage ?? null,
      error_detail: counts.detail ? ({ detail: counts.detail } as never) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/* --------------------------------------------------------------- reports */

function failed(headline: string, detail: string[], dryRun: boolean, jobId: string | null = null): RunReport {
  return {
    ok: false,
    dryRun,
    jobId,
    headline,
    detail,
    sheetRowsSeen: 0,
    dbRowsSeen: 0,
    toDatabase: 0,
    toSheet: 0,
    unchanged: 0,
    echoes: 0,
    conflicts: 0,
    newProducts: 0,
    missingFromSheet: 0,
    issues: 0,
    failedBecause: headline,
  };
}

/** The outcome in the words an operator would use. Never JSON, never a count of rows "processed". */
function describe(
  plan: SyncPlan,
  dryRun: boolean,
  jobId: string | null,
  sheetWriteFailed: string | null,
  applied?: { applied: number; sheetCellsWritten: number; notes: string[]; failures: number },
): RunReport {
  const detail: string[] = [];
  const products = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

  if (dryRun) {
    detail.push(
      plan.toDatabase.length === 0
        ? "Nothing in the sheet needs to come across."
        : `${products(plan.toDatabase.length)} would be updated from the sheet.`,
    );
    if (plan.toSheet.length > 0) detail.push(`${products(plan.toSheet.length)} would be updated in the sheet.`);
  } else {
    detail.push(
      applied && applied.applied > 0
        ? `${products(applied.applied)} updated from the sheet.`
        : "Nothing in the sheet needed to come across.",
    );
    if (applied && applied.sheetCellsWritten > 0) {
      detail.push(`${products(plan.toSheet.length)} updated in the sheet.`);
    }
  }

  if (plan.conflicts.length > 0) {
    detail.push(`${plan.conflicts.length} ${plan.conflicts.length === 1 ? "product needs" : "products need"} a decision — the sheet and the dashboard disagree.`);
  }
  if (plan.heldForConflict > 0) {
    detail.push(`${products(plan.heldForConflict)} held until an earlier disagreement is settled.`);
  }
  if (plan.newProducts.length > 0) {
    detail.push(`${products(plan.newProducts.length)} in the sheet ${plan.newProducts.length === 1 ? "is" : "are"} not in Jojo Usafi yet.`);
  }
  if (plan.missingFromSheet.length > 0) {
    detail.push(`${products(plan.missingFromSheet.length)} in Jojo Usafi ${plan.missingFromSheet.length === 1 ? "is" : "are"} no longer in the sheet. Nothing was removed.`);
  }
  if (plan.issues.length > 0) {
    detail.push(`${plan.issues.length} ${plan.issues.length === 1 ? "row needs" : "rows need"} fixing in the sheet.`);
  }
  if (applied?.notes.length) detail.push(...applied.notes);

  const trouble = plan.conflicts.length + plan.issues.length + (applied?.failures ?? 0);

  return {
    ok: !sheetWriteFailed && (applied?.failures ?? 0) === 0,
    dryRun,
    jobId,
    headline: dryRun
      ? "Checked the sheet — nothing was changed."
      : trouble === 0
        ? "Sync complete."
        : `Sync complete, with ${trouble} ${trouble === 1 ? "thing" : "things"} needing attention.`,
    detail,
    sheetRowsSeen: plan.sheetRowsSeen,
    dbRowsSeen: plan.dbRowsSeen,
    toDatabase: applied?.applied ?? plan.toDatabase.length,
    toSheet: plan.toSheet.length,
    unchanged: plan.unchanged,
    echoes: plan.echoes,
    conflicts: plan.conflicts.length,
    newProducts: plan.newProducts.length,
    missingFromSheet: plan.missingFromSheet.length,
    issues: plan.issues.length,
    failedBecause: sheetWriteFailed,
  };
}

/** The headers the sync understands, for the docs and the admin screen. */
export const SYNCED_HEADERS = KNOWN_HEADERS;
export { sheetCellsFor, reportCells };
