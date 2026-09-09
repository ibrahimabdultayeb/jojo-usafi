import "server-only";

import { z } from "zod";
import { getPublicSupabase } from "@/lib/supabase/public";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { parseTanzanianPhone } from "@/lib/domain/phone";
import type { PaymentPreference } from "@/lib/domain/orders";

/**
 * The checkout trust boundary.
 *
 * The browser may say WHICH SKUs and HOW MANY, and which delivery area. It may
 * not say what anything costs. There is deliberately no parameter anywhere in
 * this module for a price, a subtotal, a delivery fee or a total — a hostile
 * request cannot supply one because there is nowhere to put it.
 *
 * Every figure comes back from `jojo_quote_order` / `jojo_place_order`, which
 * read the current rows inside PostgreSQL. See migration 0016.
 *
 * `jojo_place_order` is reachable only with the service-role key, which is why
 * this file — and not a browser — is the one calling it. That is the "controlled
 * server path" the architecture requires: request shaping happens here, and rate
 * limiting will too.
 */

/* ------------------------------------------------------------------ shapes */

export const cartLineSchema = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(999),
});

export type CartLine = z.infer<typeof cartLineSchema>;

export interface QuoteLine {
  product_id: string;
  sku: string;
  product_name: string;
  variant: string | null;
  pack_size: string | null;
  brand_name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  available: number;
  orderable: boolean;
  in_stock: boolean;
}

export interface QuoteProblem {
  kind: "unknown_sku" | "bad_quantity" | "not_orderable" | "insufficient_stock" | "zone_unavailable";
  sku?: string;
  available?: number;
  message: string;
}

export interface Quote {
  items: QuoteLine[];
  subtotal_tzs: number;
  discount_tzs: number;
  delivery_fee_tzs: number;
  total_tzs: number;
  zone: { id: string; slug: string; name: string; fee_tzs: number; free_delivery: boolean } | null;
  problems: QuoteProblem[];
  ok: boolean;
  quoted_at: string;
}

/**
 * What the cart costs according to the database, right now.
 *
 * Read-only, and it reserves nothing: availability can change between quoting
 * and ordering, which is exactly why the order path checks again under a lock.
 * Read with the anon key, so a quote can never see more than a shopper can.
 */
export async function quoteCart(lines: CartLine[], zoneSlug: string | null): Promise<Quote> {
  const items = z.array(cartLineSchema).max(100).parse(lines);

  const { data, error } = await getPublicSupabase().rpc("jojo_quote_order", {
    p_items: items,
    p_zone_slug: zoneSlug ?? undefined,
  });

  if (error) throw new Error(`Could not price the basket: ${error.message}`);
  return data as unknown as Quote;
}

/* ------------------------------------------------------------- placing it */

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Please give us a name for the delivery.").max(120),
  phone: z.string().trim().min(1, "We need a phone number for the rider."),
  email: z.string().trim().max(160).optional().or(z.literal("")),
  zoneSlug: z.string().trim().min(1, "Choose where we are delivering to."),
  address: z.string().trim().min(4, "Please tell the rider where to bring it.").max(400),
  landmark: z.string().trim().max(200).optional().or(z.literal("")),
  instructions: z.string().trim().max(400).optional().or(z.literal("")),
  note: z.string().trim().max(400).optional().or(z.literal("")),
  paymentPreference: z.enum(["cash_on_delivery", "digital_on_delivery"]),
  locale: z.enum(["en", "sw"]).default("en"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface PlacedOrder {
  order_id: string;
  order_number: string;
  state: string;
  subtotal_tzs: number;
  delivery_fee_tzs: number;
  total_tzs: number;
  placed_at: string;
}

export type PlaceOrderResult =
  | { ok: true; order: PlacedOrder }
  | { ok: false; message: string; problems?: QuoteProblem[] };

export async function placeOrder(
  lines: CartLine[],
  input: CheckoutInput,
): Promise<PlaceOrderResult> {
  const items = z.array(cartLineSchema).min(1).max(100).safeParse(lines);
  if (!items.success) {
    return { ok: false, message: "Your basket is empty." };
  }

  // Normalised here rather than in SQL: eleven input shapes fold to one E.164
  // value, and that rule already has ten unit tests in the domain layer. The
  // database then refuses anything that is not exactly that shape.
  const phone = parseTanzanianPhone(input.phone);
  if (!phone.ok) {
    return { ok: false, message: phone.reason };
  }

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_place_order", {
    p_items: items.data,
    p_customer_name: input.fullName,
    p_customer_phone_e164: phone.value.e164,
    p_customer_phone_display: phone.value.national,
    p_customer_email: input.email || undefined,
    p_zone_slug: input.zoneSlug,
    p_delivery_address: input.address,
    p_delivery_landmark: input.landmark || undefined,
    p_delivery_instructions: input.instructions || undefined,
    p_customer_note: input.note || undefined,
    p_payment_preference: input.paymentPreference as PaymentPreference,
    p_locale: input.locale,
    p_channel: "storefront",
  });

  if (error) {
    // The database raises with sentences written for a person — "Only 3 of
    // Multix 5LT left." — so they are shown as they are rather than translated
    // into something vaguer.
    const message = error.message.replace(/^INSUFFICIENT_STOCK:\s*/, "");
    return { ok: false, message };
  }

  return { ok: true, order: data as unknown as PlacedOrder };
}

/* -------------------------------------------------------------- the zones */

export interface CheckoutZone {
  slug: string;
  name: string;
  feeTzs: number;
  freeDelivery: boolean;
}

/** Only ACTIVE zones, and read as a shopper so the list cannot say otherwise. */
export async function getCheckoutZones(): Promise<CheckoutZone[]> {
  const { data, error } = await getPublicSupabase()
    .from("delivery_zones")
    .select("slug, name, fee_tzs, free_delivery")
    .eq("active", true)
    .order("sort_priority")
    .order("name");

  if (error) throw new Error(`Could not read the delivery areas: ${error.message}`);

  return (data ?? []).map((zone) => ({
    slug: zone.slug,
    name: zone.name,
    feeTzs: zone.free_delivery ? 0 : zone.fee_tzs,
    freeDelivery: zone.free_delivery,
  }));
}
