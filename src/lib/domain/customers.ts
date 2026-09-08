/**
 * Customers.
 *
 * Guest checkout is the default and stays the default: a name, a phone number
 * and somewhere to deliver to is the whole requirement. No account, no
 * password, no email verification stands between a shopper and an order.
 *
 * This is not a CRM. Anything that is not needed to deliver an order and call
 * the customer back does not belong here.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";
import { parseTanzanianPhone, tanzanianPhoneSchema } from "./phone";

/** Required at checkout. Everything else is optional, deliberately. */
export const customerIdentitySchema = z.object({
  fullName: z
    .string({ message: "Enter your name." })
    .trim()
    .min(2, { message: "Enter your name." })
    .max(120, { message: "That name is too long." }),
  phone: tanzanianPhoneSchema,
  email: z
    .string()
    .trim()
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { message: "That email address does not look right." })
    .nullable()
    .default(null),
});

export type CustomerIdentity = z.infer<typeof customerIdentitySchema>;

export const customerAddressSchema = z.object({
  label: z.string().trim().max(40).nullable().default(null),
  deliveryZoneName: z.string().trim().min(1, { message: "Choose a delivery area." }),
  addressLine: z
    .string({ message: "Enter the delivery address." })
    .trim()
    .min(4, { message: "Enter the delivery address." })
    .max(240, { message: "That address is too long." }),
  // Where the rider actually finds it. Optional, but the single most useful
  // field on a Dar es Salaam delivery, so it is asked for by name.
  landmark: z.string().trim().max(160).nullable().default(null),
  instructions: z.string().trim().max(240).nullable().default(null),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;

export function parseCustomerIdentity(input: unknown): Result<CustomerIdentity> {
  const parsed = customerIdentitySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue?.path[0] === "phone" ? "invalid_phone" : "invalid_name";
    return err(code, issue?.message ?? "Please check these details.");
  }
  return ok(parsed.data);
}

export function parseCustomerAddress(input: unknown): Result<CustomerAddressInput> {
  const parsed = customerAddressSchema.safeParse(input);
  if (!parsed.success) {
    return err("invalid_zone", parsed.error.issues[0]?.message ?? "Please check the delivery details.");
  }
  return ok(parsed.data);
}

/**
 * The phone number IS the customer. Two checkouts with the same number are the
 * same person, however they typed it, which is what makes "6 orders, TSh
 * 284,500" on a customer card true rather than a guess.
 */
export function customerKey(phone: string): Result<string> {
  const parsed = parseTanzanianPhone(phone);
  if (!parsed.ok) return parsed;
  return ok(parsed.value.e164);
}

/** "Hassan Ali" → "HA", for the avatar on a customer card. */
export function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
