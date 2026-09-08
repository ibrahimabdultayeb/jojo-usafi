/**
 * Google Sheet ↔ Supabase synchronisation rules.
 *
 * Ibrahim edits the catalogue in a Google Sheet. The admin dashboard edits the
 * same catalogue. Both write to Supabase and Supabase writes back to the Sheet,
 * which is a loop. A loop is survivable only if four questions have answers:
 *
 *   Have I already applied this instruction?    idempotency key
 *   Is this change actually my own, returning?  fingerprint comparison
 *   Was this computed against a version I have  base fingerprint comparison
 *     already moved past?
 *   Did both sides change the same field?       conflict record, never guessed
 *
 * Nothing here talks to Google. There is no spreadsheet id, no credential and
 * no Apps Script in this build. These are the rules the worker will follow.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";

export const SYNC_SOURCES = ["sheet", "admin", "storefront", "system"] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];

export const SYNC_DIRECTIONS = ["sheet_to_db", "db_to_sheet"] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const SYNC_OPERATIONS = ["insert", "update", "delete", "upsert"] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const SYNC_STATUSES = [
  "pending",
  "in_progress",
  "applied",
  "skipped_echo",
  "conflict",
  "failed",
] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_CONFLICT_RESOLUTIONS = [
  "pending",
  "sheet_wins",
  "db_wins",
  "manual",
  "ignored",
] as const;
export type SyncConflictResolution = (typeof SYNC_CONFLICT_RESOLUTIONS)[number];

/* ------------------------------------------------------------ fingerprints */

/**
 * A stable fingerprint of the values being written.
 *
 * Deliberately NOT a cryptographic hash: this is change detection, not
 * security, and a pure implementation runs identically in the browser, in a
 * Vercel function and in a test without importing `node:crypto`. FNV-1a over a
 * canonical rendering of the record is more than enough to answer "are these
 * the same values I last wrote".
 *
 * Canonical rendering matters more than the hash: keys are sorted, `null` and
 * `undefined` collapse to the same token, and numbers and strings are tagged so
 * that 4000 and "4000" do not look identical. Two runs over the same record
 * must always produce the same string, in any process, forever.
 */
export function fingerprint(record: Record<string, unknown>): string {
  return fnv1a(canonicalise(record));
}

function canonicalise(value: unknown): string {
  if (value === null || value === undefined) return "~";
  if (typeof value === "string") return `s:${value.trim()}`;
  if (typeof value === "number") return Number.isFinite(value) ? `n:${value}` : "~";
  if (typeof value === "boolean") return `b:${value ? 1 : 0}`;
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  if (typeof value === "object") {
    // A key that is absent and a key that is present but empty mean the same
    // thing on a spreadsheet row, so neither may change the fingerprint.
    // Position still matters inside an array, which is why only object keys are
    // dropped here.
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${canonicalise(v)}`);
    return `{${entries.join(";")}}`;
  }
  return `s:${String(value)}`;
}

/** 64-bit FNV-1a, rendered as 16 hex characters. */
function fnv1a(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash ^ BigInt(input.charCodeAt(i))) * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * The key that makes an instruction safe to deliver twice. Built from the
 * things that identify the instruction rather than from a timestamp, so a
 * retried webhook produces the same key and is recognised as already handled.
 */
export function idempotencyKey(parts: {
  direction: SyncDirection;
  entityTable: string;
  entityKey: string;
  operation: SyncOperation;
  fingerprint: string;
}): string {
  return [parts.direction, parts.entityTable, parts.entityKey, parts.operation, parts.fingerprint].join(
    ":",
  );
}

/* ---------------------------------------------------------- the four rules */

export interface SyncStateRecord {
  readonly entityTable: string;
  readonly entityKey: string;
  readonly version: number;
  readonly dbFingerprint: string | null;
  readonly sheetFingerprint: string | null;
  readonly lastSource: SyncSource | null;
}

/**
 * Echo: this incoming change carries exactly the values we last wrote to that
 * side, so it is our own write coming back. Applying it would be harmless once
 * and an infinite loop forever.
 */
export function isEcho(
  incoming: { direction: SyncDirection; fingerprint: string },
  state: SyncStateRecord | null,
): boolean {
  if (!state) return false;
  return incoming.direction === "sheet_to_db"
    ? state.sheetFingerprint === incoming.fingerprint
    : state.dbFingerprint === incoming.fingerprint;
}

/**
 * Stale write: the instruction was computed against a version of the row we
 * have already moved past. Applying it would silently undo whatever changed in
 * between.
 *
 * An instruction with no base fingerprint (a first write, or a source that does
 * not track versions) is not stale — it is simply unversioned, and the conflict
 * check below is what protects it.
 */
export function isStaleWrite(
  incoming: { direction: SyncDirection; baseFingerprint: string | null },
  state: SyncStateRecord | null,
): boolean {
  if (!state || !incoming.baseFingerprint) return false;
  const current =
    incoming.direction === "sheet_to_db" ? state.dbFingerprint : state.sheetFingerprint;
  if (!current) return false;
  return current !== incoming.baseFingerprint;
}

export interface FieldConflict {
  readonly field: string;
  readonly sheetValue: unknown;
  readonly dbValue: unknown;
}

/**
 * Both sides changed the same field since they last agreed. This is never
 * resolved automatically: last-write-wins on a price is how a product ends up
 * costing TSh 400 instead of TSh 40,000.
 */
export function detectConflicts(
  incoming: Record<string, unknown>,
  current: Record<string, unknown>,
  base: Record<string, unknown> | null,
): FieldConflict[] {
  if (!base) return [];
  const conflicts: FieldConflict[] = [];
  for (const field of Object.keys(incoming)) {
    const incomingChanged = canonicalise(incoming[field]) !== canonicalise(base[field]);
    const currentChanged = canonicalise(current[field]) !== canonicalise(base[field]);
    const agree = canonicalise(incoming[field]) === canonicalise(current[field]);
    if (incomingChanged && currentChanged && !agree) {
      conflicts.push({ field, sheetValue: incoming[field], dbValue: current[field] });
    }
  }
  return conflicts;
}

export type SyncDecision =
  | { readonly action: "apply"; readonly changes: Record<string, unknown> }
  | { readonly action: "skip_echo"; readonly reason: string }
  | { readonly action: "conflict"; readonly conflicts: FieldConflict[]; readonly reason: string }
  | { readonly action: "stale"; readonly reason: string };

/**
 * The whole decision, in one place, in the order the checks must happen: an
 * echo is not a conflict, and a stale write must be caught before its values
 * are compared as if they were current.
 */
export function decideSync(input: {
  direction: SyncDirection;
  incoming: Record<string, unknown>;
  current: Record<string, unknown>;
  base: Record<string, unknown> | null;
  state: SyncStateRecord | null;
}): SyncDecision {
  const incomingFingerprint = fingerprint(input.incoming);

  if (isEcho({ direction: input.direction, fingerprint: incomingFingerprint }, input.state)) {
    return { action: "skip_echo", reason: "This change is our own write coming back." };
  }

  const baseFingerprint = input.base ? fingerprint(input.base) : null;
  if (isStaleWrite({ direction: input.direction, baseFingerprint }, input.state)) {
    return {
      action: "stale",
      reason: "This change was made against an older version of the row.",
    };
  }

  const conflicts = detectConflicts(input.incoming, input.current, input.base);
  if (conflicts.length > 0) {
    return {
      action: "conflict",
      conflicts,
      reason: "Both the sheet and the dashboard changed the same information.",
    };
  }

  const changes: Record<string, unknown> = {};
  for (const field of Object.keys(input.incoming)) {
    if (canonicalise(input.incoming[field]) !== canonicalise(input.current[field])) {
      changes[field] = input.incoming[field];
    }
  }
  return { action: "apply", changes };
}

/* -------------------------------------------------------------- retry rule */

export const MAX_SYNC_RETRIES = 5;

/**
 * Exponential backoff, capped. A Sheet that is briefly unreachable must not be
 * hammered, and a permanently broken row must eventually stop and be shown to a
 * human instead of retrying forever.
 */
export function nextRetryDelayMs(retryCount: number): number | null {
  if (retryCount >= MAX_SYNC_RETRIES) return null;
  return Math.min(30_000 * 2 ** retryCount, 15 * 60_000);
}

/* ---------------------------------------------------------------- schemas */

export const syncEventSchema = z.object({
  source: z.enum(SYNC_SOURCES),
  direction: z.enum(SYNC_DIRECTIONS),
  operation: z.enum(SYNC_OPERATIONS),
  entityTable: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,62}$/, { message: "That is not a valid table name." }),
  entityKey: z.string().trim().min(1, { message: "A synchronised row needs a key." }),
  fieldChanges: z.record(z.string(), z.unknown()).default({}),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/, { message: "That fingerprint is not valid." }),
  baseFingerprint: z
    .string()
    .regex(/^[0-9a-f]{16}$/, { message: "That fingerprint is not valid." })
    .nullable()
    .default(null),
  status: z.enum(SYNC_STATUSES).default("pending"),
  idempotencyKey: z.string().trim().min(8),
  retryCount: z.number().int().min(0).max(MAX_SYNC_RETRIES).default(0),
  sheetTab: z.string().trim().nullable().default(null),
  sheetRow: z.number().int().positive().nullable().default(null),
  errorMessage: z.string().trim().nullable().default(null),
});

export type SyncEventInput = z.infer<typeof syncEventSchema>;

export function parseSyncEvent(input: unknown): Result<SyncEventInput> {
  const parsed = syncEventSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      "invalid_sync_record",
      parsed.error.issues[0]?.message ?? "That synchronisation record is not valid.",
    );
  }
  // Mirrors sync_events_failure_is_explained: a failure without a message is
  // an unusable audit record.
  if (parsed.data.status === "failed" && !parsed.data.errorMessage?.trim()) {
    return err("invalid_sync_record", "A failed synchronisation must record what went wrong.");
  }
  return ok(parsed.data);
}
