import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { OrderActions } from "@/components/admin/orders/OrderActions";
import { Badge, Card, SectionTitle } from "@/components/admin/ui";
import { formatTsh } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { orderTotals, orders, STAGE_LABEL, STAGE_TONE, timelineFor } from "@/mocks/admin/data";

export function generateStaticParams() {
  return orders.map((order) => ({ id: order.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = orders.find((o) => o.id === id);
  return { title: order ? order.number : "Order" };
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  const totals = orderTotals(order);
  const timeline = timelineFor(order);
  const digits = order.customer.phone.replace(/[^0-9]/g, "");
  const telHref = "tel:" + order.customer.phone.replace(/\s/g, "");
  const waText = encodeURIComponent(
    "Hello " + order.customer.name + ", this is Jojo Usafi about your order " + order.number + ".",
  );
  const waHref = "https://wa.me/" + digits + "?text=" + waText;

  return (
    <AdminPage
      title={order.number}
      subtitle={"Placed " + order.placed.toLowerCase()}
      back={{ href: "/admin/orders", label: "All orders" }}
      action={<Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>}
    >
      {/* The next action sits at the top: it is why the screen was opened. */}
      <div className="mb-5">
        <OrderActions order={order} />
      </div>

      <SectionTitle>Customer</SectionTitle>
      <Card className="mb-5 p-4">
        <p className="font-display text-base font-bold text-slate-900">{order.customer.name}</p>
        <p className="text-sm font-semibold text-slate-500 tabular-nums">{order.customer.phone}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-display text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            <WhatsAppIcon className="h-5 w-5" />
            WhatsApp customer
          </a>
          <a
            href={telHref}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 font-display text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            <Icon name="phone" className="h-4 w-4" />
            Call customer
          </a>
        </div>
        {order.note && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{order.note}</p>
        )}
      </Card>

      <SectionTitle>Delivery</SectionTitle>
      <Card className="mb-5 p-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Area</dt>
            <dd className="text-right font-bold text-slate-900">{order.delivery.zone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 font-semibold text-slate-500">Address</dt>
            <dd className="text-right font-semibold text-slate-900">{order.delivery.address}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Delivery fee</dt>
            <dd className="text-right font-bold text-slate-900 tabular-nums">
              {order.delivery.freeDelivery ? <Badge tone="good">Free delivery</Badge> : formatTsh(order.delivery.fee)}
            </dd>
          </div>
        </dl>
      </Card>

      <SectionTitle>Items</SectionTitle>
      <Card className="mb-5">
        <ul className="divide-y divide-slate-100">
          {order.lines.map((item) => (
            <li key={item.sku} className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 tabular-nums">
                {item.quantity}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{item.name}</span>
                <span className="block text-xs font-medium text-slate-500">
                  {item.size} · {item.sku}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm font-black text-slate-900 tabular-nums">
                {formatTsh(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-slate-100 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="font-semibold text-slate-500">Subtotal</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{formatTsh(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-slate-500">Delivery</dt>
            <dd className="font-bold text-slate-900 tabular-nums">
              {totals.delivery === 0 ? "Free" : formatTsh(totals.delivery)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <dt className="font-display text-base font-bold text-slate-900">Total</dt>
            <dd className="font-display text-lg font-black text-slate-900 tabular-nums">{formatTsh(totals.total)}</dd>
          </div>
        </dl>
      </Card>

      <SectionTitle>Payment</SectionTitle>
      <Card className="mb-5 p-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Customer chose</dt>
            <dd className="text-right font-bold text-slate-900">{order.payment.preference}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Actually received</dt>
            <dd className="text-right font-bold text-slate-900">
              {order.payment.received ? (
                <>
                  {formatTsh(order.payment.received.amount)} · {order.payment.received.method}
                  {order.payment.received.reference && (
                    <span className="block text-xs font-semibold text-slate-500">
                      {order.payment.received.reference}
                    </span>
                  )}
                </>
              ) : (
                <Badge tone="warn">Not paid yet</Badge>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <SectionTitle>What has happened</SectionTitle>
      <Card className="p-4">
        <ol className="space-y-3">
          {timeline.map((entry) => (
            <li key={entry.label} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  entry.done ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-300"
                }`}
              >
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${entry.done ? "text-slate-900" : "text-slate-400"}`}>
                  {entry.label}
                </span>
                {entry.done && (
                  <span className="block text-xs font-medium text-slate-500">
                    {entry.at} · {entry.by}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </AdminPage>
  );
}
