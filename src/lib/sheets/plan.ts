/**
 * The synchronisation decision, computed and not yet applied.
 *
 * This is the whole engine, and it is a PURE FUNCTION: sheet snapshot in,
 * database snapshot in, last-agreed state in — a plan out. Nothing here reads
 * Google, writes Supabase or looks at a clock, which is what makes every rule
 * below testable from a literal and what makes `dry-run` free: a dry run is
 * this function without the applier that follows it.
 *
 * THE ORDER OF THE CHECKS IS THE SAFETY ARGUMENT.
 *
 *   1. headers          an unclassified column stops the whole run
 *   2. row validity     an unreadable row becomes an issue, not a guess
 *   3. duplicate SKUs   neither row wins
 *   4. echo             our own write coming back is not an edit
 *   5. stale            an instruction computed against a version we passed
 *   6. conflict         both sides changed the same field — a person decides
 *   7. field merge      different fields on each side merge safely
 *   8. new rows         created non-public, or reported when unsafe
 *   9. missing rows     reported, NEVER deleted or archived
 *
 * `decideSync` from `src/lib/domain/sync.ts` performs 4–7. It was written and
 * unit-tested in Build 05 for exactly this, and is not reimplemented here.
 */

import { decideSync, fingerprint, type FieldConflict, type SyncStateRecord } from "@/lib/domain/sync";
import { BIDIRECTIONAL_FIELDS, checkHeaders, type CatalogueFields } from "./columns";
import { parseSheet, type ParsedSheet, type RowIssue, type SheetSnapshot } from "./rows";

/* ------------------------------------------------------------ the inputs */

/** One product as the database currently has it, reduced to comparable fields. */
export interface DbProduct {
  readonly id: string;
  readonly sku: string;
  readonly fields: CatalogueFields;
  /** Reporting values written back into the Sheet. Never read as input. */
  readonly report: {
    readonly availableStock: number;
    readonly hasImage: boolean;
    readonly onWebsite: boolean;
    readonly blockedReason: string;
  };
}

export interface PlanInput {
  readonly snapshot: SheetSnapshot;
  readonly products: readonly DbProduct[];
  /** `sync_state` rows, keyed by SKU. Absent means the two have never agreed. */
  readonly state: ReadonlyMap<string, SyncStateRecord>;
  /**
   * The values both sides agreed on last time, keyed by SKU. This is the BASE
   * of the three-way comparison — without it a change cannot be told from a
   * value that was simply always different.
   */
  readonly base: ReadonlyMap<string, CatalogueFields>;
  /** SKUs with an unresolved conflict. They are held, not re-decided. */
  readonly blockedByConflict?: ReadonlySet<string>;
}

/* ----------------------------------------------------------- the outputs */

export interface SheetToDbChange {
  readonly sku: string;
  readonly row: number;
  readonly productId: string;
  readonly changes: Partial<CatalogueFields>;
  readonly before: CatalogueFields;
  readonly fingerprint: string;
}

export interface DbToSheetChange {
  readonly sku: string;
  readonly row: number;
  /** Bidirectional fields the database won, plus the read-only report cells. */
  readonly cells: Record<string, string | number>;
  readonly fields: (keyof CatalogueFields)[];
  readonly fingerprint: string;
}

export interface PlannedConflict {
  readonly sku: string;
  readonly row: number;
  readonly conflicts: readonly FieldConflict[];
}

export interface NewProduct {
  readonly sku: string;
  readonly row: number;
  readonly fields: CatalogueFields;
  readonly reference: { readonly familyCode: string | null; readonly supplierName: string | null };
}

export interface MissingFromSheet {
  readonly sku: string;
  readonly productId: string;
}

export interface SyncPlan {
  readonly ok: boolean;
  /** Set when the run cannot proceed at all — a bad header row. */
  readonly stopped: string | null;
  readonly headerCheck: ReturnType<typeof checkHeaders>;
  readonly sheetRowsSeen: number;
  readonly dbRowsSeen: number;
  readonly toDatabase: SheetToDbChange[];
  readonly toSheet: DbToSheetChange[];
  readonly conflicts: PlannedConflict[];
  readonly newProducts: NewProduct[];
  readonly missingFromSheet: MissingFromSheet[];
  readonly issues: RowIssue[];
  readonly unchanged: number;
  readonly echoes: number;
  readonly stale: number;
  readonly heldForConflict: number;
}

/* ------------------------------------------------------------- reporting */

/** The read-only cells the database owns in the Sheet, for one product. */
export function reportCells(product: DbProduct, when: string): Record<string, string | number> {
  return {
    "SYSTEM AVAILABLE STOCK": product.report.availableStock,
    "SYSTEM IMAGE": product.report.hasImage ? "Photo on file" : "No photo yet",
    "SYSTEM ON WEBSITE": product.report.onWebsite ? "On the website" : "Not on the website",
    "SYSTEM BLOCKED REASON": product.report.blockedReason,
    "SYSTEM LAST SYNCED": when,
  };
}

/** Bidirectional field values as the Sheet spells them. */
export function sheetCellsFor(
  fields: CatalogueFields,
  only: readonly (keyof CatalogueFields)[],
): Record<string, string | number> {
  const all: Record<keyof CatalogueFields, { header: string; value: string | number }> = {
    displayName: { header: "PRODUCT VARIANT", value: fields.displayName },
    variantLabel: { header: "PRODUCT VARIANT", value: fields.displayName },
    packSizeLabel: { header: "SIZE", value: fields.packSizeLabel ?? "" },
    categoryName: { header: "CATEGORY", value: fields.categoryName },
    brandName: { header: "PRODUCT BRAND", value: fields.brandName },
    ean: { header: "EAN", value: fields.ean ?? "" },
    itf14: { header: "ITF", value: fields.itf14 ?? "" },
    priceTzs: { header: "PRICE TZS", value: fields.priceTzs },
    offerPriceTzs: { header: "OFFER PRICE TZS", value: fields.offerPriceTzs ?? "" },
    storefrontVisible: { header: "WEBSITE STATUS", value: fields.storefrontVisible ? "Show" : "Hide" },
    featured: { header: "FEATURED", value: fields.featured ? "Yes" : "No" },
    bestSeller: { header: "BEST SELLER", value: fields.bestSeller ? "Yes" : "No" },
    lifecycle: { header: "PRODUCT STATUS", value: titleCase(fields.lifecycle) },
    lowStockThreshold: { header: "LOW STOCK THRESHOLD", value: fields.lowStockThreshold },
    sortPriority: { header: "PRODUCT PRIORITY", value: fields.sortPriority },
    slug: { header: "SEO SLUG", value: fields.slug },
    description: { header: "DESCRIPTION", value: fields.description ?? "" },
  };

  const cells: Record<string, string | number> = {};
  for (const field of only) {
    const cell = all[field];
    if (cell) cells[cell.header] = cell.value;
  }
  return cells;
}

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The fields to compare, as a plain record. `variantLabel` is excluded: the
 * master has no column for it, so including it would make every row look like
 * the database had changed something the Sheet never said.
 */
function comparable(fields: CatalogueFields): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of BIDIRECTIONAL_FIELDS) {
    if (field === "variantLabel") continue;
    record[field] = fields[field];
  }
  return record;
}

/* ------------------------------------------------------------- the plan */

export function planSync(input: PlanInput): SyncPlan {
  const headerCheck = checkHeaders(input.snapshot.headers);

  const empty = {
    headerCheck,
    sheetRowsSeen: input.snapshot.rows.length,
    dbRowsSeen: input.products.length,
    toDatabase: [] as SheetToDbChange[],
    toSheet: [] as DbToSheetChange[],
    conflicts: [] as PlannedConflict[],
    newProducts: [] as NewProduct[],
    missingFromSheet: [] as MissingFromSheet[],
    issues: [] as RowIssue[],
    unchanged: 0,
    echoes: 0,
    stale: 0,
    heldForConflict: 0,
  };

  // A header row this project does not recognise stops everything. Reading rows
  // through a map we do not understand is how a spreadsheet silently starts
  // writing the wrong column into the shop.
  if (!headerCheck.ok) {
    const parts: string[] = [];
    if (headerCheck.unknown.length > 0) {
      parts.push(`columns nobody has classified yet: ${headerCheck.unknown.join(", ")}`);
    }
    if (headerCheck.missing.length > 0) {
      parts.push(`columns that should be there and are not: ${headerCheck.missing.join(", ")}`);
    }
    return { ...empty, ok: false, stopped: `The sheet has ${parts.join("; ")}.` };
  }

  const sheet: ParsedSheet = parseSheet(input.snapshot);
  const bySku = new Map(input.products.map((product) => [product.sku, product]));
  const seenInSheet = new Set<string>();
  const blocked = input.blockedByConflict ?? new Set<string>();

  const plan = { ...empty, ok: true, stopped: null as string | null };
  plan.issues.push(...sheet.issues);

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  for (const row of sheet.parsed) {
    // A row that could not be READ is still a row that EXISTS. Marking it seen
    // before skipping it keeps it out of "no longer in the sheet", which it is
    // not — it is a row with a problem, already reported as one. The first real
    // connection found EP04-A01 reported under both headings at once, which is
    // the kind of double-count that turns into somebody archiving a product
    // that was never missing.
    if (row.sku) seenInSheet.add(row.sku);
    if (!row.ok) continue;

    const product = bySku.get(row.sku);

    // A SKU the shop has never seen. Section 8: it may become a product, but
    // never a public one until the publishability rules pass on their own.
    if (!product) {
      plan.newProducts.push({ sku: row.sku, row: row.row, fields: row.fields, reference: row.reference });
      continue;
    }

    // An unresolved conflict freezes the row. Re-deciding it every run would
    // either re-raise the same conflict forever or quietly pick a side.
    if (blocked.has(row.sku)) {
      plan.heldForConflict += 1;
      continue;
    }

    const incoming = comparable(row.fields);
    const current = comparable(product.fields);
    const base = input.base.get(row.sku);
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming,
      current,
      base: base ? comparable(base) : null,
      state: input.state.get(row.sku) ?? null,
    });

    /*
      AN ECHO IS NOT A REASON TO SKIP THE PRODUCT.

      It means the sheet is showing exactly what we last wrote to it, so the
      sheet has nothing to contribute in the sheet → database direction. The
      OTHER direction is untouched by that: the dashboard may have changed a
      price since, and it still has to reach the sheet. Returning early here
      meant a price raised in the dashboard never went back to the sheet — a
      test below caught it, and only because it asserted the cell rather than
      the report.

      No `continue`: the field-by-field comparison below derives "the sheet
      changed nothing" on its own, because incoming and base are equal.
    */
    if (decision.action === "skip_echo") plan.echoes += 1;

    if (decision.action === "stale") {
      plan.stale += 1;
      plan.issues.push({
        sku: row.sku,
        row: row.row,
        field: null,
        problem: "This row was edited against an older version of the product. Sync again to pick up the current values first.",
      });
      continue;
    }
    if (decision.action === "conflict") {
      plan.conflicts.push({ sku: row.sku, row: row.row, conflicts: decision.conflicts });
      continue;
    }

    /*
      WHICH SIDE ACTUALLY CHANGED WHAT.

      `decideSync` has answered the hard questions — echo, stale, conflict — and
      its `changes` are "every field where incoming differs from current". That
      is the right answer for a one-way feed and the WRONG one here: if the
      dashboard raised a price and the sheet still shows the old figure, the
      sheet's untouched cell differs from the database and would be applied,
      silently undoing the raise. That is the data loss section 11 forbids, and
      it is not hypothetical — two tests below started life failing on it.

      So a field moves only if the side it is coming FROM actually changed it,
      which needs the base: the values the two last agreed on.
    */
    const baseRecord = base ? comparable(base) : null;
    const changed: (keyof CatalogueFields)[] = [];
    const dbWon: (keyof CatalogueFields)[] = [];

    for (const field of BIDIRECTIONAL_FIELDS) {
      if (field === "variantLabel") continue;

      if (!baseRecord) {
        /*
          FIRST MEETING: NEITHER SIDE WINS.

          The two have never agreed, so no field has "changed" — a difference
          here is just a difference, and there is no way to tell a deliberate
          one from an artefact of how the data got there. So nothing flows in
          either direction. The run records what the database holds as the
          agreed base and writes only the read-only system columns; from the
          next run on, a real edit reads as a real edit.

          This rule used to push the database's value into the sheet, and the
          first connection to the real Product Master showed what that costs:
          it would have overwritten 105 `WEBSITE STATUS` cells reading "Show"
          with "Hide", and 14 `PRODUCT PRIORITY` cells with 0. Neither value was
          a decision anybody made — the hidden flag came from the Build 07
          importer noticing there was no photograph, and the 0 is a column
          default for a field that was never imported. Ibrahim's "Show" is the
          only stated intent in that pair, and it would have been destroyed
          silently, in his own column, on the first press of the button.

          The database is still the operational truth for what the SHOP does.
          It is not automatically the truth about what the operator MEANT.
        */
        continue;
      }

      const sheetChanged = differ(incoming[field], baseRecord[field]);
      const dbChanged = differ(current[field], baseRecord[field]);

      // Both changed and disagreed was already caught above as a conflict.
      if (sheetChanged && differ(incoming[field], current[field])) changed.push(field);
      else if (dbChanged && !sheetChanged) dbWon.push(field);
    }

    if (changed.length > 0) {
      const changes: Partial<CatalogueFields> = {};
      for (const field of changed) {
        (changes as Record<string, unknown>)[field] = incoming[field];
      }
      plan.toDatabase.push({
        sku: row.sku,
        row: row.row,
        productId: product.id,
        changes,
        before: product.fields,
        fingerprint: fingerprint(incoming),
      });
    }

    const cells = {
      ...sheetCellsFor(product.fields, dbWon),
      ...reportCells(product, now),
    };

    // Only write cells that actually differ from what the sheet already shows,
    // so a run that changes nothing writes nothing — section 14, and the reason
    // an idempotent second run is genuinely free.
    const rowCells = input.snapshot.rows.find((r) => r.rowNumber === row.row)?.cells ?? {};
    const needed: Record<string, string | number> = {};
    for (const [header, value] of Object.entries(cells)) {
      if (String(rowCells[header] ?? "").trim() !== String(value).trim()) needed[header] = value;
    }

    if (Object.keys(needed).length > 0) {
      plan.toSheet.push({
        sku: row.sku,
        row: row.row,
        cells: needed,
        fields: dbWon,
        fingerprint: fingerprint(current),
      });
    }

    if (changed.length === 0 && dbWon.length === 0) plan.unchanged += 1;
  }

  // Section 9. A product that has left the sheet is REPORTED. It is not
  // deleted, not archived and not hidden: an order placed last week still
  // points at it, and a row can vanish because somebody sorted the sheet badly.
  for (const product of input.products) {
    if (!seenInSheet.has(product.sku)) {
      plan.missingFromSheet.push({ sku: product.sku, productId: product.id });
    }
  }

  return plan;
}

/** Same comparison the fingerprint uses: blank and absent are one thing. */
function differ(a: unknown, b: unknown): boolean {
  const render = (v: unknown) =>
    v === null || v === undefined || v === "" ? "~" : typeof v === "string" ? v.trim() : String(v);
  return render(a) !== render(b);
}
