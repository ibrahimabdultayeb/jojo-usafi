import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * The one way a machine is allowed to ask this application to do something.
 *
 * Written once because there are now two job routes, and two hand-rolled
 * bearer checks eventually differ in the detail that matters. All three of the
 * properties below are that detail.
 *
 * CLOSED BY DEFAULT. A missing or too-short secret is not "no authentication
 * required" — it means every request is refused, so a deployment that forgets
 * to configure the variable is shut rather than open to the internet.
 *
 * CONSTANT TIME. `timingSafeEqual` throws on a length mismatch, so the lengths
 * are compared first and the byte comparison still runs in constant time when
 * they match.
 *
 * SILENT. The secret is never returned, logged, or hinted at, and a wrong
 * secret is answered exactly like an unconfigured one: telling a caller which
 * of the two happened tells them how close they are.
 */

/** Shorter than this is not a secret, whatever it is set to. */
const MINIMUM_LENGTH = 16;

export function bearerAuthorised(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.trim().length < MINIMUM_LENGTH) return false;

  const header = request.headers.get("authorization") ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (offered.length === 0) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
