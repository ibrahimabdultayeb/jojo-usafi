import { getProductBySku, productName } from "@/lib/catalogue/queries";
import type {
  CancellationReason,
  Order,
  OrderEvent,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  SyncState,
} from "../types";
import { mockCustomers } from "./customers";
import { mockZones, zoneFee } from "./zones";

/**
 * MOCK ORDERS — invented, for the prototype only.
 *
 * No order backend exists. These orders are built from REAL catalogue products
 * (real SKUs, real names, real prices), so the screens show believable line
 * items and totals, but the customers and the orders themselves are invented.
 *
 * The prototype has no live clock: every time is a fixed display string, so the
 * screens render identically on the server and in the browser, and screenshots
 * are stable.
 */

/** The day this prototype pretends it is. Used by the Home dashboard. */
export const MOCK_TODAY = "Tuesday, 8 September";

interface OrderSeed {
  id: string;
  customerId: string;
  zoneId: string;
  addressIndex?: number;
  /** [SKU, quantity] against the real catalogue. */
  items: [string, number][];
  status: OrderStatus;
  paymentPreference: PaymentMethod;
  recordedPayment?: { method: PaymentMethod; reference?: string; at: string };
  discount?: number;
  placedAt: string;
  /** Higher is more recent. Keeps ordering explicit without a clock. */
  placedOrder: number;
  /** Which timeline stages have happened, with their display times. */
  events: { kind: OrderEvent["kind"]; at: string; note?: string }[];
  cancellationReason?: CancellationReason;
  cancellationNote?: string;
  itemsReturned?: boolean | null;
  syncState?: SyncState;
}

const SEEDS: OrderSeed[] = [
  {
    id: "JU-000148",
    customerId: "cus_hassan_ali",
    zoneId: "zone_upanga",
    items: [
      ["EP01-A02", 1],
      ["EP02-A06", 2],
    ],
    status: "new",
    paymentPreference: "cash",
    placedAt: "Today, 09:14",
    placedOrder: 148,
    events: [{ kind: "received", at: "Today, 09:14" }],
  },
  {
    id: "JU-000147",
    customerId: "cus_neema_mushi",
    zoneId: "zone_mikocheni",
    items: [
      ["EP04-A02", 1],
      ["EP05-A06", 1],
      ["EP19-A02", 1],
    ],
    status: "new",
    paymentPreference: "digital",
    placedAt: "Today, 08:52",
    placedOrder: 147,
    events: [{ kind: "received", at: "Today, 08:52" }],
  },
  {
    id: "JU-000146",
    customerId: "cus_juma_kileo",
    zoneId: "zone_kariakoo",
    items: [
      ["EP02-B02", 3],
      ["EP01-B06", 4],
    ],
    status: "awaiting_confirmation",
    paymentPreference: "cash",
    placedAt: "Today, 08:20",
    placedOrder: 146,
    events: [
      { kind: "received", at: "Today, 08:20" },
      { kind: "confirmed", at: "", note: "Called at 08:35, no answer. Trying again." },
    ],
    syncState: "pending",
  },
  {
    id: "JU-000145",
    customerId: "cus_asha_mbwana",
    zoneId: "zone_masaki",
    items: [
      ["EP06-A02", 2],
      ["EP07-A06", 1],
    ],
    status: "awaiting_confirmation",
    paymentPreference: "digital",
    placedAt: "Today, 07:58",
    placedOrder: 145,
    events: [
      { kind: "received", at: "Today, 07:58" },
      { kind: "confirmed", at: "", note: "Sent a WhatsApp message, waiting for a reply." },
    ],
  },
  {
    id: "JU-000144",
    customerId: "cus_grace_mwakalinga",
    zoneId: "zone_upanga",
    items: [
      ["EP01-C02", 2],
      ["EP03-A02", 1],
    ],
    status: "confirmed",
    paymentPreference: "cash",
    placedAt: "Today, 07:31",
    placedOrder: 144,
    events: [
      { kind: "received", at: "Today, 07:31" },
      { kind: "confirmed", at: "Today, 08:05", note: "Customer confirmed by phone." },
    ],
  },
  {
    id: "JU-000143",
    customerId: "cus_baraka_shirima",
    zoneId: "zone_mbezi",
    items: [
      ["EP01-A02", 4],
      ["EP02-A02", 2],
      ["EP04-B02", 1],
    ],
    status: "preparing",
    paymentPreference: "cash",
    placedAt: "Yesterday, 17:42",
    placedOrder: 143,
    events: [
      { kind: "received", at: "Yesterday, 17:42" },
      { kind: "confirmed", at: "Yesterday, 18:10" },
      { kind: "preparing", at: "Today, 08:40", note: "Packing started." },
    ],
  },
  {
    id: "JU-000142",
    customerId: "cus_said_omary",
    zoneId: "zone_kariakoo",
    items: [
      ["EP01-D06", 6],
      ["EP02-C06", 3],
    ],
    status: "preparing",
    paymentPreference: "digital",
    placedAt: "Yesterday, 16:05",
    placedOrder: 142,
    events: [
      { kind: "received", at: "Yesterday, 16:05" },
      { kind: "confirmed", at: "Yesterday, 16:30" },
      { kind: "preparing", at: "Today, 08:15" },
    ],
    syncState: "syncing",
  },
  {
    id: "JU-000141",
    customerId: "cus_rehema_lyimo",
    zoneId: "zone_mikocheni",
    items: [
      ["EP05-A02", 1],
      ["EP06-B06", 2],
    ],
    status: "out_for_delivery",
    paymentPreference: "cash",
    placedAt: "Yesterday, 14:22",
    placedOrder: 141,
    events: [
      { kind: "received", at: "Yesterday, 14:22" },
      { kind: "confirmed", at: "Yesterday, 14:45" },
      { kind: "preparing", at: "Yesterday, 15:30" },
      { kind: "out_for_delivery", at: "Today, 09:00", note: "With the rider." },
    ],
  },
  {
    id: "JU-000140",
    customerId: "cus_hassan_ali",
    zoneId: "zone_upanga",
    items: [
      ["EP02-A06", 2],
      ["EP07-A02", 1],
    ],
    status: "out_for_delivery",
    paymentPreference: "digital",
    placedAt: "Yesterday, 11:48",
    placedOrder: 140,
    events: [
      { kind: "received", at: "Yesterday, 11:48" },
      { kind: "confirmed", at: "Yesterday, 12:02" },
      { kind: "preparing", at: "Yesterday, 13:15" },
      { kind: "out_for_delivery", at: "Today, 08:30" },
    ],
    syncState: "issue",
  },
  {
    id: "JU-000139",
    customerId: "cus_neema_mushi",
    zoneId: "zone_mikocheni",
    items: [
      ["EP01-A02", 2],
      ["EP04-A02", 1],
    ],
    status: "completed",
    paymentPreference: "cash",
    recordedPayment: { method: "cash", at: "Today, 07:55" },
    placedAt: "Yesterday, 10:12",
    placedOrder: 139,
    events: [
      { kind: "received", at: "Yesterday, 10:12" },
      { kind: "confirmed", at: "Yesterday, 10:30" },
      { kind: "preparing", at: "Yesterday, 11:00" },
      { kind: "out_for_delivery", at: "Yesterday, 15:20" },
      { kind: "completed", at: "Today, 07:55", note: "Paid in cash on arrival." },
    ],
  },
  {
    id: "JU-000138",
    customerId: "cus_grace_mwakalinga",
    zoneId: "zone_upanga",
    items: [
      ["EP02-B02", 1],
      ["EP03-B02", 1],
      ["EP01-B06", 2],
    ],
    status: "completed",
    paymentPreference: "digital",
    recordedPayment: { method: "digital", reference: "MPESA-8F42QK71", at: "Today, 07:10" },
    discount: 2000,
    placedAt: "6 Sep, 16:40",
    placedOrder: 138,
    events: [
      { kind: "received", at: "6 Sep, 16:40" },
      { kind: "confirmed", at: "6 Sep, 17:05" },
      { kind: "preparing", at: "7 Sep, 09:20" },
      { kind: "out_for_delivery", at: "7 Sep, 14:10" },
      { kind: "completed", at: "Today, 07:10", note: "Paid by mobile money." },
    ],
  },
  {
    id: "JU-000137",
    customerId: "cus_asha_mbwana",
    zoneId: "zone_masaki",
    items: [["EP06-A02", 3]],
    status: "completed",
    paymentPreference: "cash",
    recordedPayment: { method: "cash", at: "6 Sep, 18:30" },
    placedAt: "6 Sep, 09:15",
    placedOrder: 137,
    events: [
      { kind: "received", at: "6 Sep, 09:15" },
      { kind: "confirmed", at: "6 Sep, 09:40" },
      { kind: "preparing", at: "6 Sep, 11:00" },
      { kind: "out_for_delivery", at: "6 Sep, 16:00" },
      { kind: "completed", at: "6 Sep, 18:30" },
    ],
  },
  {
    id: "JU-000136",
    customerId: "cus_juma_kileo",
    zoneId: "zone_kariakoo",
    items: [
      ["EP01-C06", 5],
      ["EP02-D06", 5],
    ],
    status: "completed",
    paymentPreference: "digital",
    recordedPayment: { method: "digital", reference: "TIGO-4471PP08", at: "5 Sep, 17:45" },
    placedAt: "5 Sep, 08:30",
    placedOrder: 136,
    events: [
      { kind: "received", at: "5 Sep, 08:30" },
      { kind: "confirmed", at: "5 Sep, 08:50" },
      { kind: "preparing", at: "5 Sep, 10:10" },
      { kind: "out_for_delivery", at: "5 Sep, 15:00" },
      { kind: "completed", at: "5 Sep, 17:45" },
    ],
  },
  {
    id: "JU-000135",
    customerId: "cus_said_omary",
    zoneId: "zone_kariakoo",
    items: [["EP04-B02", 2]],
    status: "delivery_failed",
    paymentPreference: "cash",
    placedAt: "5 Sep, 12:05",
    placedOrder: 135,
    events: [
      { kind: "received", at: "5 Sep, 12:05" },
      { kind: "confirmed", at: "5 Sep, 12:25" },
      { kind: "preparing", at: "5 Sep, 13:40" },
      { kind: "out_for_delivery", at: "5 Sep, 15:30" },
      {
        kind: "delivery_failed",
        at: "5 Sep, 18:15",
        note: "Nobody at the address. Rider waited 20 minutes.",
      },
    ],
    itemsReturned: null,
  },
  {
    id: "JU-000134",
    customerId: "cus_baraka_shirima",
    zoneId: "zone_mbezi",
    items: [["EP01-A02", 1]],
    status: "cancelled",
    paymentPreference: "cash",
    placedAt: "4 Sep, 19:22",
    placedOrder: 134,
    events: [
      { kind: "received", at: "4 Sep, 19:22" },
      {
        kind: "cancelled",
        at: "5 Sep, 08:05",
        note: "Customer changed mind — ordered the wrong size.",
      },
    ],
    cancellationReason: "customer_changed_mind",
  },
  {
    id: "JU-000133",
    customerId: "cus_rehema_lyimo",
    zoneId: "zone_mikocheni",
    items: [
      ["EP03-A02", 2],
      ["EP05-A06", 1],
    ],
    status: "cancelled",
    paymentPreference: "digital",
    placedAt: "4 Sep, 10:40",
    placedOrder: 133,
    events: [
      { kind: "received", at: "4 Sep, 10:40" },
      { kind: "cancelled", at: "4 Sep, 12:15", note: "We had run out and could not restock in time." },
    ],
    cancellationReason: "out_of_stock",
  },
];

/** Turns a seed into a full order, pricing it from the real catalogue. */
function buildOrder(seed: OrderSeed): Order | null {
  const customer = mockCustomers.find((c) => c.id === seed.customerId);
  const zone = mockZones.find((z) => z.id === seed.zoneId);
  if (!customer || !zone) return null;

  const lines: OrderLine[] = [];
  for (const [sku, quantity] of seed.items) {
    const product = getProductBySku(sku);
    // A SKU that is no longer publishable simply drops out of the mock order
    // rather than inventing a product that does not exist.
    if (!product) continue;
    lines.push({
      sku: product.sku,
      name: productName(product),
      packSize: product.packSize,
      unitPrice: product.price,
      quantity,
      lineTotal: product.price * quantity,
    });
  }
  if (lines.length === 0) return null;

  const address = customer.addresses[seed.addressIndex ?? 0] ?? customer.addresses[0];
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const delivery = zoneFee(zone);
  const discount = seed.discount ?? 0;

  const timeline: OrderEvent[] = seed.events.map((event) => ({
    kind: event.kind,
    at: event.at,
    note: event.note,
  }));

  return {
    id: seed.id,
    placedAt: seed.placedAt,
    placedOrder: seed.placedOrder,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    zoneId: zone.id,
    zoneName: zone.name,
    address: address.line,
    landmark: address.landmark,
    deliveryFee: delivery,
    lines,
    subtotal,
    discount,
    total: subtotal + delivery - discount,
    paymentPreference: seed.paymentPreference,
    recordedPayment: seed.recordedPayment
      ? {
          method: seed.recordedPayment.method,
          reference: seed.recordedPayment.reference,
          recordedAt: seed.recordedPayment.at,
        }
      : null,
    status: seed.status,
    cancellationReason: seed.cancellationReason,
    cancellationNote: seed.cancellationNote,
    itemsReturned: seed.itemsReturned ?? null,
    timeline,
    syncState: seed.syncState ?? "saved",
  };
}

export const mockOrders: Order[] = SEEDS.map(buildOrder)
  .filter((order): order is Order => order !== null)
  .sort((a, b) => b.placedOrder - a.placedOrder);
