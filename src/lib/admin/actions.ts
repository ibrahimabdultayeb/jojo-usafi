"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { authorize } from "./authorize";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Json, OrderStateValue, PaymentMethodValue } from "@/lib/supabase/types";

/**
 * Every write a staff member can make, as one authorised server action each.
 *
 * The shape is the same throughout:
 *
 *   authorize(capability)          who is this, and may they?
 *     → call the tested operation  the database does the work
 *       → revalidate              the screens that now say something stale
 *
 * NOTHING HERE DOES ARITHMETIC. Reservation maths, transition legality and the
 * payment rules all live in the SQL functions Build 08 proved, so a second
 * implementation cannot drift from the first. These actions decide only WHO may
 * ask, and translate the database's refusal into a sentence.
 *
 * The order operations need the service-role key because they write across
 * orders, inventory and two ledgers in one transaction. That key never leaves
 * the server, and it is only reached after `authorize()` has already said yes.
 */

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
}

const failed = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });

/** Database messages are already written for a person. Show them as they are. */
function readable(error: { message: string }): string {
  return error.message.replace(/^INSUFFICIENT_STOCK:\s*/, "");
}

function refreshOrder(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ orders */

export async function advanceOrderAction(
  orderId: string,
  toState: OrderStateValue,
): Promise<ActionResult> {
  const auth = await authorize("orders.advance");
  if (!auth.ok) return failed(auth.message);

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_advance_order", {
    p_order_id: orderId,
    p_to_state: toState,
    p_actor_admin_id: auth.staff.adminId,
  });

  if (error) return failed(readable(error));
  refreshOrder(orderId);

  const result = data as { order_number: string; already: boolean };
  return done(
    result.already
      ? `${result.order_number} was already there.`
      : `${result.order_number} updated.`,
  );
}

export async function completeOrderAction(
  orderId: string,
  method: PaymentMethodValue,
  reference: string,
): Promise<ActionResult> {
  const auth = await authorize("orders.recordPayment");
  if (!auth.ok) return failed(auth.message);

  // Completion and payment are ONE call, because they are one transaction in
  // the database. Recording the payment first and hoping completion follows
  // would leave a paid order that never completed if the second call failed.
  const { data, error } = await getServiceRoleSupabase().rpc("jojo_advance_order", {
    p_order_id: orderId,
    p_to_state: "completed",
    p_actor_admin_id: auth.staff.adminId,
    p_payment_method: method,
    p_payment_reference: reference.trim() || undefined,
  });

  if (error) return failed(readable(error));
  refreshOrder(orderId);

  const result = data as { order_number: string; sold: number };
  return done(`${result.order_number} completed. ${result.sold} item(s) left the shop.`);
}

export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<ActionResult> {
  const auth = await authorize("orders.cancel");
  if (!auth.ok) return failed(auth.message);

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
    p_actor_admin_id: auth.staff.adminId,
    p_actor_label: auth.staff.name,
  });

  if (error) return failed(readable(error));
  refreshOrder(orderId);

  const result = data as { order_number: string; released: number; already: boolean };
  return done(
    result.already
      ? `${result.order_number} was already cancelled.`
      : `${result.order_number} cancelled. ${result.released} item(s) back on the shelf.`,
  );
}

export async function failDeliveryAction(
  orderId: string,
  itemsReturned: boolean,
  reason: string,
): Promise<ActionResult> {
  const auth = await authorize("orders.cancel");
  if (!auth.ok) return failed(auth.message);

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_fail_delivery", {
    p_order_id: orderId,
    p_items_returned: itemsReturned,
    p_reason: reason,
    p_actor_admin_id: auth.staff.adminId,
  });

  if (error) return failed(readable(error));
  refreshOrder(orderId);

  const result = data as { order_number: string; lost: number };
  return done(
    itemsReturned
      ? `${result.order_number} marked failed. The items came back, so the stock is unchanged.`
      : `${result.order_number} marked failed. ${result.lost} item(s) written off.`,
  );
}

/* -------------------------------------------------------------- amendment */

export interface AmendLine {
  readonly sku: string;
  readonly quantity: number;
}

/**
 * Change what is in an order, before it leaves.
 *
 * The whole final list goes to the database, not a diff: the caller says what
 * the order should now contain and `jojo_amend_order` works out what that means
 * for stock. No arithmetic happens here — not the totals, not the reservation
 * delta, not whether there is enough. A second implementation of any of those
 * is a second answer waiting to disagree with the first.
 */
export async function amendOrderAction(
  orderId: string,
  lines: readonly AmendLine[],
  reason: string,
): Promise<ActionResult> {
  const auth = await authorize("orders.advance");
  if (!auth.ok) return failed(auth.message);

  if (reason.trim().length === 0) {
    return failed("Say why the order is changing — it goes on the record.");
  }
  if (lines.length === 0) {
    return failed("An order cannot be left with nothing in it. Cancel it instead.");
  }
  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)) {
    return failed("Every item needs a whole number, one or more. Remove it instead of setting zero.");
  }

  const { data, error } = await getServiceRoleSupabase().rpc("jojo_amend_order", {
    p_order_id: orderId,
    p_items: lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
    p_reason: reason.trim(),
    p_actor_admin_id: auth.staff.adminId,
  });

  if (error) return failed(readable(error));
  refreshOrder(orderId);

  const result = data as {
    order_number: string;
    added: number;
    changed: number;
    removed: number;
    total_tzs: number;
  };

  const parts: string[] = [];
  if (result.added) parts.push(`${result.added} added`);
  if (result.changed) parts.push(`${result.changed} changed`);
  if (result.removed) parts.push(`${result.removed} removed`);

  return done(
    `${result.order_number} updated${parts.length ? ` — ${parts.join(", ")}` : ""}. New total TSh ${result.total_tzs.toLocaleString("en-TZ")}.`,
  );
}

/* ---------------------------------------------------------------- products */

export interface ProductPatch {
  priceTzs: number;
  offerPriceTzs: number | null;
  storefrontVisible: boolean;
  featured: boolean;
  bestSeller: boolean;
  lifecycle: "active" | "hidden" | "archived";
}

export async function saveProductAction(
  productId: string,
  patch: ProductPatch,
): Promise<ActionResult> {
  const auth = await authorize("products.editPricing");
  if (!auth.ok) return failed(auth.message);

  if (!Number.isInteger(patch.priceTzs) || patch.priceTzs < 0) {
    return failed("A price is a whole number of shillings.");
  }
  if (patch.offerPriceTzs !== null && patch.offerPriceTzs >= patch.priceTzs) {
    return failed("An offer price has to be lower than the normal price.");
  }

  // Written through the CALLER'S session, not the service role: the product
  // policies already say Owner and Manager only, so this is RLS enforcing the
  // rule rather than the application asserting it a second time.
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("products")
    .update({
      price_tzs: patch.priceTzs,
      offer_price_tzs: patch.offerPriceTzs,
      storefront_visible: patch.storefrontVisible,
      featured: patch.featured,
      best_seller: patch.bestSeller,
      lifecycle: patch.lifecycle,
    })
    .eq("id", productId);

  if (error) return failed(readable(error));

  await writeAudit("product.updated", "products", productId, auth.staff.adminId, auth.staff.name, {
    price_tzs: patch.priceTzs,
    offer_price_tzs: patch.offerPriceTzs,
    storefront_visible: patch.storefrontVisible,
    lifecycle: patch.lifecycle,
  });

  // The shelf is cached for five minutes; a price change must not wait.
  revalidateTag("catalogue");
  revalidatePath("/admin/products");

  return done("Saved.");
}

/* ------------------------------------------------------------------- stock */

export async function addStockAction(
  productId: string,
  quantity: number,
  reference: string,
): Promise<ActionResult> {
  const auth = await authorize("products.editStock");
  if (!auth.ok) return failed(auth.message);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("jojo_add_stock", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reference: reference.trim() || undefined,
  });

  if (error) return failed(readable(error));
  revalidateTag("catalogue");
  revalidatePath("/admin/products");

  const result = data as { available: number };
  return done(`Added. ${result.available} now available.`);
}

export async function countStockAction(
  productId: string,
  counted: number,
  reason: string,
): Promise<ActionResult> {
  const auth = await authorize("products.editStock");
  if (!auth.ok) return failed(auth.message);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("jojo_count_stock", {
    p_product_id: productId,
    p_counted: counted,
    p_reason: reason,
  });

  if (error) return failed(readable(error));
  revalidateTag("catalogue");
  revalidatePath("/admin/products");

  const result = data as { available: number; delta: number; changed: boolean };
  return done(
    result.changed
      ? `Counted. ${result.delta > 0 ? "+" : ""}${result.delta} recorded, ${result.available} available.`
      : "The count matched the system. Nothing to record.",
  );
}

/* ---------------------------------------------------------- delivery zones */

export interface ZonePatch {
  name: string;
  feeTzs: number;
  freeDelivery: boolean;
  active: boolean;
  sortPriority: number;
}

function zoneSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function saveZoneAction(
  zoneId: string | null,
  patch: ZonePatch,
): Promise<ActionResult> {
  const auth = await authorize("delivery.manage");
  if (!auth.ok) return failed(auth.message);

  const name = patch.name.trim();
  if (name.length < 2) return failed("Give the area a name.");

  // A free area charges nothing. The database has the same CHECK, but saying it
  // here means the operator sees a sentence rather than a constraint name.
  const fee = patch.freeDelivery ? 0 : patch.feeTzs;
  if (!Number.isInteger(fee) || fee < 0) return failed("A delivery fee is a whole number of shillings.");

  const supabase = await getServerSupabase();
  const row = {
    name,
    fee_tzs: fee,
    free_delivery: patch.freeDelivery,
    active: patch.active,
    sort_priority: patch.sortPriority,
  };

  const { error } = zoneId
    ? await supabase.from("delivery_zones").update(row).eq("id", zoneId)
    : await supabase.from("delivery_zones").insert({ ...row, slug: zoneSlug(name) });

  if (error) return failed(readable(error));

  revalidatePath("/admin/more/delivery-zones");
  revalidatePath("/checkout");
  revalidatePath("/sw/checkout");

  return done(zoneId ? "Saved." : `${name} added.`);
}

/* ------------------------------------------------------------------ audit */

/**
 * Audit rows are written with the service role on purpose: `audit_events` has
 * no INSERT policy for anybody holding a browser token, because an audit trail
 * a client can append to is not an audit trail.
 */
async function writeAudit(
  action: string,
  table: string,
  entityId: string,
  adminId: string,
  adminName: string,
  after: Record<string, Json>,
): Promise<void> {
  await getServiceRoleSupabase().from("audit_events").insert({
    action,
    entity_table: table,
    entity_id: entityId,
    actor_type: "staff",
    actor_admin_id: adminId,
    actor_label: adminName,
    source: "admin",
    after_data: after,
  });
}
