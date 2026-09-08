/**
 * Tanzanian phone numbers.
 *
 * The phone number is the customer's identity — guest checkout means there is
 * nothing else. So the same person typing "0712 884 210" on Monday and
 * "+255712884210" on Friday must land on the same customer row, which means one
 * normalisation, used everywhere, matching the CHECK constraint on
 * `customers.phone_e164` and `orders.customer_phone_e164`.
 *
 * Stored form:   +255712884210      (E.164, what the database holds)
 * Display form:  +255 712 884 210   (what a person reads, and what WhatsApp
 *                                    messages and order cards show)
 * WhatsApp form: 255712884210       (wa.me takes no plus and no spaces)
 *
 * Mobile networks in Tanzania issue subscriber numbers starting 6 or 7, nine
 * digits in total. Landlines (2x) are not accepted: an order needs a number
 * that can receive a WhatsApp message.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";

export const TZ_COUNTRY_CODE = "255" as const;

/** Nine digits, starting 6 or 7. */
export const TZ_NATIONAL_PATTERN = /^[67]\d{8}$/;

/** The stored form. MUST match the SQL CHECK constraint. */
export const TZ_E164_PATTERN = /^\+255[67]\d{8}$/;

export interface TanzanianPhone {
  /** "+255712884210" — the stored, unique form. */
  readonly e164: string;
  /** "712884210" — the subscriber number without country code. */
  readonly national: string;
  /** "+255 712 884 210" — for reading aloud and for order cards. */
  readonly display: string;
  /** "255712884210" — for building a wa.me link. */
  readonly whatsapp: string;
}

/**
 * Accepts every shape a real customer or a spreadsheet actually produces:
 *
 *   0712884210, 0712 884 210, 0712-884-210
 *   712884210
 *   255712884210, +255712884210, 00255712884210
 *   +255 (0)712 884 210
 *
 * Rejects anything else rather than guessing. A wrong number is a lost delivery.
 */
export function parseTanzanianPhone(input: unknown): Result<TanzanianPhone> {
  if (typeof input !== "string") {
    return err("invalid_phone", "Enter a phone number.");
  }

  // Strip everything a human uses for readability, and the "(0)" that appears
  // when an international prefix is written in front of a local number.
  const stripped = input.replace(/\(0\)/g, "").replace(/[\s\-().]/g, "");

  if (stripped === "") return err("invalid_phone", "Enter a phone number.");
  if (!/^\+?\d+$/.test(stripped)) {
    return err("invalid_phone", "A phone number can only contain digits.");
  }

  let digits = stripped.replace(/^\+/, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(TZ_COUNTRY_CODE)) digits = digits.slice(TZ_COUNTRY_CODE.length);
  // A local number written with its trunk prefix: 0712... -> 712...
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);

  if (!TZ_NATIONAL_PATTERN.test(digits)) {
    return err(
      "invalid_phone",
      "Enter a Tanzanian mobile number, for example 0712 884 210.",
    );
  }

  const e164 = `+${TZ_COUNTRY_CODE}${digits}`;
  return ok({
    e164,
    national: digits,
    display: `+${TZ_COUNTRY_CODE} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`,
    whatsapp: `${TZ_COUNTRY_CODE}${digits}`,
  });
}

/** True only for the stored E.164 form. Use `parseTanzanianPhone` for input. */
export function isTanzanianPhoneE164(value: unknown): value is string {
  return typeof value === "string" && TZ_E164_PATTERN.test(value);
}

/**
 * Zod field for checkout and admin forms. Parses input in any accepted shape
 * and yields the stored E.164 string, so a form's output is already the value
 * the database wants.
 */
export const tanzanianPhoneSchema = z
  .string({ message: "Enter a phone number." })
  .transform((value, ctx) => {
    const parsed = parseTanzanianPhone(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.reason });
      return z.NEVER;
    }
    return parsed.value.e164;
  });

/** The display form of an already-stored number, for order cards and receipts. */
export function formatPhoneE164(e164: string): string {
  const parsed = parseTanzanianPhone(e164);
  return parsed.ok ? parsed.value.display : e164;
}
