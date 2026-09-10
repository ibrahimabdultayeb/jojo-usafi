import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type { AdminOrder, OrderStage, TimelineEntry } from "@/lib/admin/model";

/**
 * Real orders, in the shape the approved admin screens already read.
 *
 * Read through the CALLER'S session, so Row Level Security decides what comes
 * back: staff see every order, and anybody else sees none. The service-role
 * client is deliberately not imported — a read path that could bypass RLS would
 * turn a policy mistake into a data leak instead of an empty screen.
 *
 * The shape matches `AdminOrder` in `src/lib/admin/model.ts` exactly. That is not
 * laziness: the screens were designed and approved around it, and mapping here
 * means the UI keeps its layout, its labels and its one-obvious-next-action
 * while the data underneath became real.
 */

const PREFERENCE_LABEL = {
  cash_on_delivery: "Cash on delivery",
  digital_on_delivery: "Pay digitally on delivery",
} as const;

/** The columns every list card and detail screen needs. */
const ORDER_SELECT = `
  id, order_number, state, placed_at, customer_id,
  customer_name, customer_phone_e164, customer_phone_display, customer_email,
  delivery_zone_name, delivery_address, delivery_landmark, delivery_instructions,
  delivery_fee_tzs, subtotal_tzs, discount_tzs, total_tzs,
  payment_preference, payment_status, payment_method, payment_reference,
  customer_note, staff_note,
  confirmed_at, preparing_at, dispatched_at, completed_at, cancelled_at, failed_at,
  cancellation_reason, delivery_failure_reason,
  order_items ( sku, product_name, variant_label, pack_size_label, quantity, unit_price_tzs, line_total_tzs, position )
`;

type OrderRow = {
  id: string;
  order_number: string;
  state: string;
  placed_at: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone_e164: string;
  customer_phone_display: string | null;
  customer_email: string | null;
  delivery_zone_name: string;
  delivery_address: string;
  delivery_fee_tzs: number;
  subtotal_tzs: number;
  discount_tzs: number;
  total_tzs: number;
  payment_preference: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  customer_note: string | null;
  order_items: {
    sku: string;
    product_name: string;
    variant_label: string | null;
    pack_size_label: string | null;
    quantity: number;
    unit_price_tzs: number;
    position: number;
  }[];
};

function toAdminOrder(row: OrderRow): AdminOrder {
  return {
    id: row.id,
    number: row.order_number,
    stage: row.state as OrderStage,
    placed: row.placed_at,
    customer: {
      id: row.customer_id ?? "",
      name: row.customer_name,
      phone: row.customer_phone_display ?? row.customer_phone_e164,
    },
    delivery: {
      zone: row.delivery_zone_name,
      address: row.delivery_address,
      fee: row.delivery_fee_tzs,
      freeDelivery: row.delivery_fee_tzs === 0,
    },
    lines: [...(row.order_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        sku: item.sku,
        name: item.product_name,
        size: item.pack_size_label ?? item.variant_label ?? "",
        quantity: item.quantity,
        unitPrice: item.unit_price_tzs,
      })),
    payment: {
      preference:
        PREFERENCE_LABEL[row.payment_preference as keyof typeof PREFERENCE_LABEL] ??
        "Cash on delivery",
      received:
        row.payment_status === "paid" && row.payment_method
          ? {
              method: row.payment_method === "digital" ? "Mobile money" : "Cash",
              reference: row.payment_reference ?? undefined,
              amount: row.total_tzs,
            }
          : null,
    },
    note: row.customer_note ?? undefined,
  };
}

export async function getAdminOrders(limit = 200): Promise<AdminOrder[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("placed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not read the orders: ${error.message}`);
  return (data as unknown as OrderRow[]).map(toAdminOrder);
}

export async function getAdminOrder(id: string): Promise<AdminOrder | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();

  if (error) throw new Error(`Could not read that order: ${error.message}`);
  return data ? toAdminOrder(data as unknown as OrderRow) : null;
}

/**
 * The order's real history, in words.
 *
 * `order_events` is a ledger, and it is written for the ledger's benefit: the
 * `kind` is a machine vocabulary (`state_changed`, `stock_reserved`) and the
 * `summary` a state transition spelled the way the database spells it
 * (`preparing → out_for_delivery`). An operator must never be shown either —
 * see `docs/ADMIN_UX.md`, "no database jargon".
 *
 * So the sentence is composed here, from `to_state` and `kind`, and the stored
 * summary is used only for the events whose summary is genuinely a person's
 * sentence: a cancellation reason, a failed delivery, a note.
 */
const EVENT_LABEL: Record<string, string> = {
  order_created: "Order placed on the website",
  state_changed: "Order moved on",
  confirmed: "Order confirmed",
  cancelled: "Order cancelled",
  delivery_failed: "Delivery did not succeed",
  payment_recorded: "Payment recorded",
  stock_reserved: "Stock set aside for this order",
  stock_released: "Stock returned to the shelf",
  order_amended: "Order changed",
  note_added: "Note added",
  whatsapp_opened: "WhatsApp opened",
  staff_action: "Staff action",
};

/** What ARRIVING at a state means, said the way a shopkeeper would say it. */
const ARRIVED_AT: Record<string, string> = {
  new: "Order received",
  awaiting_confirmation: "Waiting for the customer to confirm",
  confirmed: "Order confirmed",
  preparing: "Being prepared",
  out_for_delivery: "Sent out for delivery",
  completed: "Delivered and paid",
  cancelled: "Order cancelled",
  delivery_failed: "Delivery did not succeed",
};

/**
 * The kinds whose stored summary is written for a person and worth showing —
 * a cancellation reason, what went wrong with a delivery, a staff note.
 */
const SUMMARY_IS_HUMAN = new Set([
  "cancelled",
  "delivery_failed",
  "payment_recorded",
  "note_added",
  "stock_released",
  "order_amended",
]);

interface EventRow {
  kind: string;
  summary: string | null;
  to_state: string | null;
  actor_label: string | null;
  actor_type: string | null;
  occurred_at: string;
}

function sentenceFor(event: EventRow): string {
  if (SUMMARY_IS_HUMAN.has(event.kind) && event.summary?.trim()) return event.summary.trim();
  if (event.to_state && ARRIVED_AT[event.to_state]) return ARRIVED_AT[event.to_state];
  return EVENT_LABEL[event.kind] ?? "Order updated";
}

/** Who did it. `system` and `checkout` are actor codes, not names. */
function actorFor(event: EventRow): string {
  const label = event.actor_label?.trim();
  if (label && label !== "system" && label !== "checkout") return label;
  if (event.actor_type === "customer" || label === "checkout") return "Website";
  return "Jojo Usafi";
}

const EVENT_SELECT = "kind, summary, to_state, actor_label, actor_type, occurred_at";

export async function getOrderTimeline(orderId: string): Promise<TimelineEntry[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("order_events")
    .select(EVENT_SELECT)
    .eq("order_id", orderId)
    .order("occurred_at", { ascending: true });

  if (error) throw new Error(`Could not read the order history: ${error.message}`);

  return (data as unknown as EventRow[] | null ?? []).map((event) => ({
    label: sentenceFor(event),
    at: event.occurred_at,
    by: actorFor(event),
    done: true,
  }));
}

/* ------------------------------------------------------------------- home */

export interface AdminSnapshot {
  todayOrders: number;
  todaySalesTzs: number;
  needsAttention: { label: string; count: number; href: string; tone: "urgent" | "warn" | "calm"; hint: string }[];
  recent: AdminOrder[];
}

/**
 * What needs attention right now — counted from the real orders and the real
 * shelf, and showing an honest zero when the answer is zero.
 */
export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const supabase = await getServerSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [orders, todays, lowStock, outOfStock] = await Promise.all([
    getAdminOrders(20),
    supabase
      .from("orders")
      .select("total_tzs, state")
      .gte("placed_at", startOfDay.toISOString()),
    supabase
      .from("product_shelf")
      .select("sku", { count: "exact", head: true })
      .eq("low_stock", true),
    supabase
      .from("product_shelf")
      .select("sku", { count: "exact", head: true })
      .eq("in_stock", false),
  ]);

  const countIn = (states: string[]) => orders.filter((order) => states.includes(order.stage)).length;
  const todayRows = todays.data ?? [];

  return {
    todayOrders: todayRows.length,
    todaySalesTzs: todayRows
      .filter((row) => row.state === "completed")
      .reduce((sum, row) => sum + row.total_tzs, 0),
    needsAttention: [
      { label: "New orders", count: countIn(["new"]), href: "/admin/orders?stage=new", tone: "urgent", hint: "Waiting to be confirmed" },
      { label: "Awaiting confirmation", count: countIn(["awaiting_confirmation"]), href: "/admin/orders?stage=awaiting_confirmation", tone: "urgent", hint: "Customer contacted, not confirmed" },
      { label: "Preparing", count: countIn(["preparing"]), href: "/admin/orders?stage=preparing", tone: "calm", hint: "Being packed now" },
      { label: "Out for delivery", count: countIn(["out_for_delivery"]), href: "/admin/orders?stage=out_for_delivery", tone: "calm", hint: "On the way to the customer" },
      { label: "Delivery failed", count: countIn(["delivery_failed"]), href: "/admin/orders?stage=delivery_failed", tone: "warn", hint: "Needs a decision" },
      { label: "Out of stock", count: outOfStock.count ?? 0, href: "/admin/products?filter=out-of-stock", tone: "warn", hint: "Cannot be ordered" },
      { label: "Low stock", count: lowStock.count ?? 0, href: "/admin/products?filter=low-stock", tone: "warn", hint: "Running out soon" },
    ],
    recent: orders.slice(0, 5),
  };
}

/* --------------------------------------------------------------- activity */

export interface ActivityEntry {
  at: string;
  text: string;
  by: string;
  href?: string;
}

/**
 * What has happened in the shop lately, in words.
 *
 * Read from `order_events`, the append-only ledger every order operation
 * already writes to — not from a separate activity table that could disagree
 * with it. `audit_events` is deliberately not read here: Order staff cannot see
 * it, and a feed that silently empties itself for one role is worse than a feed
 * that shows the same thing to everybody.
 */
export async function getRecentActivity(limit = 8): Promise<ActivityEntry[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("order_events")
    .select(`${EVENT_SELECT}, order_id, orders ( order_number )`)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  // An empty feed is a fine answer; a broken home page is not.
  if (error) return [];

  type ActivityRow = EventRow & {
    order_id: string | null;
    orders: { order_number: string } | { order_number: string }[] | null;
  };

  return ((data as unknown as ActivityRow[] | null) ?? []).map((event) => {
    const order = Array.isArray(event.orders) ? event.orders[0] : event.orders;
    const sentence = sentenceFor(event);
    return {
      at: event.occurred_at,
      text: order ? `${order.order_number} — ${sentence}` : sentence,
      by: actorFor(event),
      href: event.order_id ? `/admin/orders/${event.order_id}` : undefined,
    };
  });
}

/* -------------------------------------------------------------- customers */

export interface AdminCustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  orders: number;
  spendTzs: number;
  lastOrder: string | null;
}

export async function getAdminCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = await getServerSupabase();

  const [{ data: customers, error }, { data: orders }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone_e164, phone_display, email, last_ordered_at")
      .order("last_ordered_at", { ascending: false, nullsFirst: false }),
    supabase.from("orders").select("customer_id, total_tzs, state"),
  ]);

  if (error) throw new Error(`Could not read the customers: ${error.message}`);

  const byCustomer = new Map<string, { orders: number; spend: number }>();
  for (const order of orders ?? []) {
    if (!order.customer_id) continue;
    const entry = byCustomer.get(order.customer_id) ?? { orders: 0, spend: 0 };
    entry.orders += 1;
    // Spend counts what was actually collected, not what was hoped for.
    if (order.state === "completed") entry.spend += order.total_tzs;
    byCustomer.set(order.customer_id, entry);
  }

  return (customers ?? []).map((customer) => ({
    id: customer.id,
    name: customer.full_name,
    phone: customer.phone_display ?? customer.phone_e164,
    email: customer.email,
    orders: byCustomer.get(customer.id)?.orders ?? 0,
    spendTzs: byCustomer.get(customer.id)?.spend ?? 0,
    lastOrder: customer.last_ordered_at,
  }));
}

export async function getAdminCustomer(
  id: string,
): Promise<{ customer: AdminCustomerRow; orders: AdminOrder[] } | null> {
  const all = await getAdminCustomers();
  const customer = all.find((row) => row.id === id);
  if (!customer) return null;

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", id)
    .order("placed_at", { ascending: false });

  return { customer, orders: (data as unknown as OrderRow[] | null ?? []).map(toAdminOrder) };
}

/* ---------------------------------------------------------- delivery zones */

export interface AdminZoneRow {
  id: string;
  slug: string;
  name: string;
  feeTzs: number;
  freeDelivery: boolean;
  active: boolean;
  sortPriority: number;
  /** Development placeholders carry a note saying so — surfaced, not hidden. */
  isDevelopmentFixture: boolean;
}

export async function getAdminZones(): Promise<AdminZoneRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id, slug, name, fee_tzs, free_delivery, active, sort_priority, notes")
    .order("sort_priority")
    .order("name");

  if (error) throw new Error(`Could not read the delivery areas: ${error.message}`);

  return (data ?? []).map((zone) => ({
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    feeTzs: zone.fee_tzs,
    freeDelivery: zone.free_delivery,
    active: zone.active,
    sortPriority: zone.sort_priority,
    isDevelopmentFixture: (zone.notes ?? "").startsWith("DEVELOPMENT FIXTURE"),
  }));
}

/* ------------------------------------------------------- amendable products */

/**
 * What may be ADDED to an existing order.
 *
 * Deliberately `product_shelf` and nothing else. That view is what
 * `jojo_resolve_lines` calls `orderable`, so a product offered here is a
 * product the amendment function will accept — the picker cannot suggest
 * something the database then refuses.
 *
 * The price is the effective one (offer price when there is one), for the same
 * reason: it is the figure the database will charge. The screen still labels
 * its own arithmetic an estimate, because availability may move between the
 * search and the save.
 */
export interface AmendableProductRow {
  sku: string;
  name: string;
  packSize: string;
  priceTzs: number;
  available: number;
}

export async function getAmendableProducts(): Promise<AmendableProductRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("product_shelf")
    .select("sku, display_name, pack_size_label, effective_price_tzs, available")
    .order("display_name");

  if (error) throw new Error(`Could not read what can be added: ${error.message}`);

  // A view's columns are all nullable to the generated types, whatever the
  // underlying NOT NULL says. A row without a SKU could not be ordered anyway,
  // so it is dropped rather than asserted away.
  return (data ?? []).flatMap((row) =>
    row.sku && row.display_name
      ? [{
          sku: row.sku,
          name: row.display_name,
          packSize: row.pack_size_label ?? "",
          priceTzs: row.effective_price_tzs ?? 0,
          available: row.available ?? 0,
        }]
      : [],
  );
}
