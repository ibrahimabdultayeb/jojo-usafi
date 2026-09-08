/**
 * Delivery zones.
 *
 * Jojo Usafi delivers to named areas, each with its own fee. A zone can be
 * marked free, which waives the fee everywhere at once — on the shelf, at
 * checkout, on the order snapshot and in the WhatsApp message — rather than
 * requiring a zero to be typed in several places.
 *
 * TSh 4,000 is the approved starting fee for a NEW zone. It is a default, not a
 * price: every zone is edited in the admin dashboard, and the same default is
 * the column default on `delivery_zones.fee_tzs`.
 */

import { z } from "zod";
import { err, ok, type Result } from "./result";
import { MAX_MONEY_TZS, type MoneyTzs } from "./money";

/** The fee a brand-new zone starts on. Approved business value. */
export const DEFAULT_DELIVERY_FEE_TZS = 4000;

export const deliveryZoneSchema = z
  .object({
    name: z
      .string({ message: "Give the area a name." })
      .trim()
      .min(2, { message: "Give the area a name." })
      .max(60, { message: "That name is too long for an order card." }),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "The web address for this area is not valid." }),
    feeTzs: z
      .number({ message: "Enter a delivery fee in shillings." })
      .int({ message: "Delivery fees are whole shillings — no decimals." })
      .min(0, { message: "A delivery fee cannot be negative." })
      .max(MAX_MONEY_TZS, { message: "That fee is too large to be real." }),
    freeDelivery: z.boolean(),
    active: z.boolean(),
    sortPriority: z.number().int(),
  })
  .refine((zone) => !zone.freeDelivery || zone.feeTzs === 0, {
    // Mirrors the delivery_zones_free_is_free CHECK constraint.
    message: "An area marked free delivery must have a fee of 0.",
    path: ["feeTzs"],
  });

export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;

export interface DeliveryZone extends DeliveryZoneInput {
  readonly id: string;
}

export function parseDeliveryZone(input: unknown): Result<DeliveryZoneInput> {
  const parsed = deliveryZoneSchema.safeParse(input);
  if (!parsed.success) {
    return err("invalid_zone", parsed.error.issues[0]?.message ?? "That delivery area is not valid.");
  }
  return ok(parsed.data);
}

/**
 * A blank zone, ready for the admin's "Add area" form. The name and slug are
 * the operator's to fill in; the fee starts on the approved default.
 */
export function newDeliveryZoneDefaults(): Omit<DeliveryZoneInput, "name" | "slug"> {
  return {
    feeTzs: DEFAULT_DELIVERY_FEE_TZS,
    freeDelivery: false,
    active: true,
    sortPriority: 0,
  };
}

/**
 * What this order is actually charged for delivery. The single place that
 * decides it, so a free zone can never leak a fee onto a total.
 */
export function deliveryFeeForZone(zone: Pick<DeliveryZoneInput, "feeTzs" | "freeDelivery">): MoneyTzs {
  return zone.freeDelivery ? 0 : zone.feeTzs;
}

/**
 * Marking a zone free zeroes its fee in the same edit, so the pair is never
 * saved in the contradictory state the database would reject.
 */
export function setFreeDelivery(
  zone: DeliveryZoneInput,
  freeDelivery: boolean,
  feeWhenCharged: MoneyTzs = DEFAULT_DELIVERY_FEE_TZS,
): DeliveryZoneInput {
  return freeDelivery
    ? { ...zone, freeDelivery: true, feeTzs: 0 }
    : { ...zone, freeDelivery: false, feeTzs: feeWhenCharged };
}

/**
 * Only an active zone may be chosen at checkout. Retiring an area must not
 * invalidate the orders already delivered to it, which is why the zone name and
 * fee are snapshotted onto every order.
 */
export function isOrderable(zone: Pick<DeliveryZoneInput, "active">): boolean {
  return zone.active;
}
