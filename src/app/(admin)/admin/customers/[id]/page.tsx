import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { Badge, Card, SectionTitle, StatTile } from "@/components/admin/ui";
import { formatTsh } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { customers, orderTotals, orders, STAGE_LABEL, STAGE_TONE } from "@/mocks/admin/data";

export function generateStaticParams() {
  return customers.map((customer) => ({ id: customer.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();

  const history = orders.filter((o) => o.customer.id === customer.id);
  const digits = customer.phone.replace(/[^0-9]/g, "");
  const waHref = "https://wa.me/" + digits;
  const telHref = "tel:" + customer.phone.replace(/\s/g, "");

  return (
    <AdminPage
      title={customer.name}
      subtitle={customer.phone}
      back={{ href: "/admin/customers", label: "All customers" }}
    >
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-display text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          <Icon name="whatsapp" className="h-4 w-4" />
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

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile label="Orders" value={String(customer.orderCount)} />
        <StatTile label="Total spent" value={formatTsh(customer.totalSpend)} />
        <StatTile label="Last order" value={customer.lastOrder} />
      </div>

      <SectionTitle>Contact and addresses</SectionTitle>
      <Card className="mb-5 p-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Phone</dt>
            <dd className="text-right font-bold text-slate-900 tabular-nums">{customer.phone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-slate-500">Email</dt>
            <dd className="text-right font-bold text-slate-900">{customer.email ?? "Not given"}</dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {customer.addresses.map((address) => (
            <li key={address.line} className="flex gap-2.5 text-sm">
              <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <span className="block font-bold text-slate-900">{address.zone}</span>
                <span className="block font-medium text-slate-500">{address.line}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>Order history</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {history.length === 0 ? (
          <p className="p-4 text-sm font-medium text-slate-500">No orders yet.</p>
        ) : (
          history.map((order) => {
            const totals = orderTotals(order);
            return (
              <Link
                key={order.id}
                href={"/admin/orders/" + order.id}
                className="flex items-center gap-3 p-3.5 transition-colors hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-slate-900">{order.number}</span>
                    <Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">{order.placed}</span>
                </span>
                <span className="shrink-0 text-sm font-black text-slate-900 tabular-nums">
                  {formatTsh(totals.total)}
                </span>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            );
          })
        )}
      </Card>
    </AdminPage>
  );
}
