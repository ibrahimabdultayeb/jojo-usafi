import { notFound } from "next/navigation";
import { NextActionPanel } from "@/components/admin/NextActionPanel";
import {
  Card,
  DetailRow,
  MockNotice,
  PageHeader,
  Screen,
  SectionTitle,
  SyncBadge,
} from "@/components/admin/ui";
import { Icon, WhatsAppGlyph } from "@/components/ui/Icon";
import { cancellationReasonLabel, itemCount, PAYMENT_METHOD_LABEL, TIMELINE_STAGES } from "@/lib/admin/orders";
import { getOrder, getOrders } from "@/lib/admin/queries";
import type { Order } from "@/lib/admin/types";
import { formatPrice } from "@/lib/format";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return getOrders().map((order) => ({ id: order.id }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  return { title: id.toUpperCase() };
}

export default async function AdminOrderPage({ params }: { params: Params }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();

  const count = itemCount(order);
  const whatsapp = `https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello ${order.customerName}, this is Jojo Usafi about your order ${order.id}.`,
  )}`;

  return (
    <>
      <PageHeader
        title={order.id}
        subtitle={`Placed ${order.placedAt}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        action={<SyncBadge state={order.syncState} />}
      />

      <Screen>
        <MockNotice />

        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-5 lg:space-y-0">
          <div className="space-y-4">
            <NextActionPanel order={order} />

            {/* Customer — reaching them is the most common thing staff do. */}
            <Card>
              <SectionTitle>Customer</SectionTitle>
              <p className="font-display text-lg font-bold text-slate-900">{order.customerName}</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">{order.customerPhone}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 font-display text-sm font-bold text-white transition-[filter] hover:brightness-95"
                >
                  <WhatsAppGlyph className="h-5 w-5" />
                  WhatsApp
                </a>
                <a
                  href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 font-display text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <Icon name="phone" className="h-5 w-5" />
                  Call
                </a>
              </div>
            </Card>

            <Card>
              <SectionTitle>Delivery</SectionTitle>
              <dl className="divide-y divide-slate-100">
                <DetailRow label="Zone">{order.zoneName}</DetailRow>
                <DetailRow label="Address">{order.address}</DetailRow>
                <DetailRow label="Landmark">{order.landmark}</DetailRow>
                <DetailRow label="Delivery fee">
                  {order.deliveryFee === 0 ? "FREE" : formatPrice(order.deliveryFee)}
                </DetailRow>
              </dl>
            </Card>

            <Card>
              <SectionTitle>
                Items ({count} {count === 1 ? "item" : "items"})
              </SectionTitle>
              <ul className="divide-y divide-slate-100">
                {order.lines.map((line) => (
                  <li key={line.sku} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-slate-900">{line.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {line.packSize} · {line.sku}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {line.quantity} × {formatPrice(line.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-sm font-black whitespace-nowrap text-slate-900">
                      {formatPrice(line.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <SectionTitle>Total</SectionTitle>
              <dl className="divide-y divide-slate-100">
                <DetailRow label="Subtotal">{formatPrice(order.subtotal)}</DetailRow>
                <DetailRow label="Delivery">
                  {order.deliveryFee === 0 ? "FREE" : formatPrice(order.deliveryFee)}
                </DetailRow>
                <DetailRow label="Discount">
                  {order.discount > 0 ? `− ${formatPrice(order.discount)}` : "None"}
                </DetailRow>
              </dl>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-slate-900 pt-3">
                <span className="font-display text-base font-bold text-slate-900">To pay</span>
                <span className="font-display text-2xl font-black whitespace-nowrap text-slate-900">
                  {formatPrice(order.total)}
                </span>
              </div>
            </Card>

            <PaymentCard order={order} />

            <Card>
              <SectionTitle>What has happened</SectionTitle>
              <Timeline order={order} />
            </Card>
          </div>
        </div>
      </Screen>
    </>
  );
}

function PaymentCard({ order }: { order: Order }) {
  const paid = order.recordedPayment;
  return (
    <Card>
      <SectionTitle>Payment</SectionTitle>
      <dl className="divide-y divide-slate-100">
        <DetailRow label="Customer said">
          {order.paymentPreference === "cash" ? "Cash on delivery" : "Mobile money or card"}
        </DetailRow>
        <DetailRow label="Actually paid">
          {paid ? (
            PAYMENT_METHOD_LABEL[paid.method]
          ) : (
            <span className="font-semibold text-amber-700">Not paid yet</span>
          )}
        </DetailRow>
        {paid?.reference && <DetailRow label="Reference">{paid.reference}</DetailRow>}
        {paid && <DetailRow label="Recorded">{paid.recordedAt}</DetailRow>}
      </dl>
      {!paid && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-600">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          The payment is recorded when you complete the order.
        </p>
      )}
    </Card>
  );
}

function Timeline({ order }: { order: Order }) {
  const done = new Map(order.timeline.map((event) => [event.kind, event]));
  const cancelled = done.get("cancelled");
  const failed = done.get("delivery_failed");

  return (
    <ol className="space-y-0">
      {TIMELINE_STAGES.map((stage, index) => {
        const event = done.get(stage.kind);
        const reached = Boolean(event?.at);
        const pending = Boolean(event) && !event?.at;
        return (
          <li key={stage.kind} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  reached
                    ? "bg-brand-600 text-white"
                    : pending
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {reached ? <Icon name="check" className="h-4 w-4" /> : index + 1}
              </span>
              {index < TIMELINE_STAGES.length - 1 && (
                <span
                  className={`w-0.5 flex-1 ${reached ? "bg-brand-200" : "bg-slate-100"}`}
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <p
                className={`font-display text-sm font-bold ${
                  reached ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {stage.label}
              </p>
              {event?.at && (
                <p className="text-xs font-semibold text-slate-500">{event.at}</p>
              )}
              {event?.note && (
                <p className="mt-0.5 text-xs font-medium text-slate-500">{event.note}</p>
              )}
              {!event && <p className="text-xs font-medium text-slate-400">Not yet</p>}
            </div>
          </li>
        );
      })}

      {(cancelled || failed) && (
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Icon name="alert" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-slate-900">
              {cancelled ? "Cancelled" : "Delivery failed"}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {(cancelled ?? failed)?.at}
            </p>
            {order.cancellationReason && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Reason: {cancellationReasonLabel(order.cancellationReason)}
              </p>
            )}
            {(cancelled ?? failed)?.note && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {(cancelled ?? failed)?.note}
              </p>
            )}
            {failed && (
              <p className="mt-0.5 text-xs font-bold text-slate-700">
                Items returned:{" "}
                {order.itemsReturned === null
                  ? "not answered yet"
                  : order.itemsReturned
                    ? "Yes"
                    : "No"}
              </p>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}
