import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCard } from "@/components/admin/OrderCard";
import { Card, DetailRow, MockNotice, PageHeader, Screen, SectionTitle } from "@/components/admin/ui";
import { Icon, WhatsAppGlyph } from "@/components/ui/Icon";
import { getCustomer, getCustomerOrders, getCustomers } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/format";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return getCustomers().map((customer) => ({ id: customer.id }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  return { title: getCustomer(id)?.name ?? "Customer" };
}

export default async function AdminCustomerPage({ params }: { params: Params }) {
  const { id } = await params;
  const customer = getCustomer(id);
  if (!customer) notFound();

  const orders = getCustomerOrders(customer.id);
  const whatsapp = `https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello ${customer.name}, this is Jojo Usafi.`,
  )}`;

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={customer.phone}
        back={{ href: "/admin/customers", label: "Customers" }}
      />
      <Screen>
        <MockNotice />

        <div className="space-y-4 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
          <div className="space-y-4">
            <Card>
              <div className="grid grid-cols-2 gap-2">
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
                  href={`tel:${customer.phone.replace(/\s/g, "")}`}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 font-display text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <Icon name="phone" className="h-5 w-5" />
                  Call
                </a>
              </div>

              <dl className="mt-4 divide-y divide-slate-100">
                <DetailRow label="Phone">{customer.phone}</DetailRow>
                <DetailRow label="Email">
                  {customer.email ?? <span className="font-semibold text-slate-400">None</span>}
                </DetailRow>
                <DetailRow label="Orders">{customer.orderCount}</DetailRow>
                <DetailRow label="Total spent">{formatPrice(customer.totalSpend)}</DetailRow>
                <DetailRow label="Last order">
                  {customer.lastOrderId ? (
                    <Link
                      href={`/admin/orders/${customer.lastOrderId}`}
                      className="text-brand-700 hover:text-brand-800"
                    >
                      {customer.lastOrderId} · {customer.lastOrderAt}
                    </Link>
                  ) : (
                    "None"
                  )}
                </DetailRow>
              </dl>
            </Card>

            <Card>
              <SectionTitle>Addresses</SectionTitle>
              <ul className="space-y-3">
                {customer.addresses.map((address) => (
                  <li key={address.label} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                      {address.label}
                    </p>
                    <p className="mt-0.5 font-display text-sm font-bold text-slate-900">
                      {address.line}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">{address.zoneName}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{address.landmark}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div>
            <SectionTitle>Order history</SectionTitle>
            <ul className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </ul>
          </div>
        </div>
      </Screen>
    </>
  );
}
