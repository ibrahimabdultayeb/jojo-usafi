"use server";

import { checkoutSchema, placeOrder, quoteCart, type CartLine, type Quote } from "./checkout";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { CheckoutState, TrackState, TrackedOrder } from "./state";
import { emptyCheckoutState } from "./state";
import { parseTanzanianPhone } from "@/lib/domain/phone";

/**
 * The only doors between a browser and the shop's money.
 *
 * A server action is the right shape for this: the cart lives in the browser
 * (it is the shopper's, and localStorage is the honest place for it), but every
 * decision about what that cart COSTS has to be made on this side. So the
 * browser posts SKUs and quantities and gets back figures it had no hand in.
 */


/** Read the cart the browser posted. Shape only — never its opinion of price. */
function readLines(formData: FormData): CartLine[] {
  try {
    const raw = JSON.parse(String(formData.get("cart") ?? "[]")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((line) => {
        const item = line as { sku?: unknown; quantity?: unknown };
        return { sku: String(item.sku ?? ""), quantity: Number(item.quantity ?? 0) };
      })
      .filter((line) => line.sku.length > 0 && Number.isInteger(line.quantity) && line.quantity > 0);
  } catch {
    return [];
  }
}

/** What the basket costs, for the summary beside the form. */
export async function quoteAction(lines: CartLine[], zoneSlug: string | null): Promise<Quote> {
  return quoteCart(lines, zoneSlug);
}

export async function placeOrderAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const lines = readLines(formData);
  if (lines.length === 0) {
    return { ...emptyCheckoutState, error: "Your basket is empty." };
  }

  const parsed = checkoutSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    zoneSlug: formData.get("zoneSlug"),
    address: formData.get("address"),
    landmark: formData.get("landmark") ?? "",
    instructions: formData.get("instructions") ?? "",
    note: formData.get("note") ?? "",
    paymentPreference: formData.get("paymentPreference"),
    locale: formData.get("locale") ?? "en",
  });

  if (!parsed.success) {
    return {
      ...emptyCheckoutState,
      error: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }

  const phone = parseTanzanianPhone(parsed.data.phone);
  if (!phone.ok) return { ...emptyCheckoutState, error: phone.reason };

  // Quoted first so the summary shown on the confirmation screen is the same
  // set of figures the database is about to write, and so a basket problem is
  // reported as a list rather than as one raised exception.
  const quote = await quoteCart(lines, parsed.data.zoneSlug);
  if (!quote.ok) {
    return {
      ...emptyCheckoutState,
      error: "We could not complete that order.",
      problems: quote.problems.map((p) => ({ kind: p.kind, message: p.message })),
    };
  }

  const result = await placeOrder(lines, parsed.data);
  if (!result.ok) {
    return { ...emptyCheckoutState, error: result.message };
  }

  return {
    error: null,
    problems: [],
    placed: {
      orderNumber: result.order.order_number,
      totalTzs: result.order.total_tzs,
      subtotalTzs: result.order.subtotal_tzs,
      deliveryFeeTzs: result.order.delivery_fee_tzs,
      zoneName: quote.zone?.name ?? "",
      address: parsed.data.address,
      paymentPreference: parsed.data.paymentPreference,
      items: quote.items.map((item) => ({
        sku: item.sku,
        name: item.product_name,
        packSize: item.pack_size,
        quantity: item.quantity,
        lineTotal: item.line_total,
      })),
    },
  };
}

/* ------------------------------------------------------------ track order */


/**
 * Both the order number AND the phone that placed it are required, and a
 * mismatch is indistinguishable from a wrong number — otherwise knowing that
 * JU-000128 exists would be enough to read it, and every order could be read
 * by counting upward.
 *
 * NOT YET HARDENED: there is no rate limit here. Guessing a six-digit number
 * and a nine-digit phone together is not a realistic attack, but a determined
 * script should still be slowed down. That belongs with the deployment that
 * gives us a shared store to count attempts in — recorded in
 * docs/TESTING_REQUIREMENTS.md.
 */
export async function trackOrderAction(
  _previous: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const orderNumber = String(formData.get("orderNumber") ?? "").trim().toUpperCase();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  if (!orderNumber || !rawPhone) {
    return { error: "Enter your order number and the phone number you ordered with.", order: null };
  }

  const phone = parseTanzanianPhone(rawPhone);
  if (!phone.ok) {
    return { error: phone.reason, order: null };
  }

  const { data, error } = await getPublicSupabase().rpc("jojo_track_order", {
    p_order_number: orderNumber,
    p_phone_e164: phone.value.e164,
  });

  if (error) {
    return { error: "We could not look that up just now. Try again in a moment.", order: null };
  }

  if (!data) {
    // Deliberately one message for "no such order" and "wrong phone".
    return {
      error: "We could not find an order with that number and phone number.",
      order: null,
    };
  }

  return { error: null, order: data as unknown as TrackedOrder };
}
