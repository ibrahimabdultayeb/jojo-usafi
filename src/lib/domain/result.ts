/**
 * The result shape every domain rule returns.
 *
 * Domain rules answer questions a person could get wrong — may this order be
 * completed, may this stock be reserved, is this phone number usable. A failure
 * is an ordinary answer, not an exception, so callers are forced to handle it
 * and the admin dashboard can show the `reason` verbatim.
 *
 * `reason` is written for a non-technical operator to read. No table names, no
 * enum values, no stack traces.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly reason: string; readonly code: DomainErrorCode };

export type Result<T> = Ok<T> | Err;

/**
 * A machine-readable tag alongside the human sentence, so a caller can branch
 * on the kind of failure without matching on English text.
 */
export type DomainErrorCode =
  | "invalid_sku"
  | "invalid_money"
  | "invalid_quantity"
  | "invalid_phone"
  | "invalid_email"
  | "invalid_name"
  | "invalid_zone"
  | "invalid_transition"
  | "payment_required"
  | "payment_invalid"
  | "reason_required"
  | "insufficient_stock"
  | "invalid_movement"
  | "invalid_locale"
  | "invalid_order"
  | "invalid_sync_record"
  | "stale_write";

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(code: DomainErrorCode, reason: string): Err {
  return { ok: false, code, reason };
}

/** Narrowing helper, so callers read as `if (isOk(r))` rather than `r.ok`. */
export function isOk<T>(result: Result<T>): result is Ok<T> {
  return result.ok;
}

/**
 * Unwrap or throw. For tests and for code paths that have already validated
 * their input; never for handling user input.
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(`${result.code}: ${result.reason}`);
}
