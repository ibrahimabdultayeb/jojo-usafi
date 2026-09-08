import Link from "next/link";
import { MockNotice, PageHeader, Screen } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { getCustomers } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Customers" };

/** A list, not a CRM. Who they are, how to reach them, what they have bought. */
export default function AdminCustomersPage() {
  const customers = getCustomers();

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} people have ordered.`} />
      <Screen>
        <MockNotice />
        <ul className="space-y-3">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/admin/customers/${customer.id}`}
                className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 sm:p-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-lg font-black text-brand-700">
                  {customer.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold text-slate-900">
                    {customer.name}
                  </span>
                  <span className="block text-sm font-semibold text-slate-500">
                    {customer.phone}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"} ·{" "}
                    {formatPrice(customer.totalSpend)} spent
                    {customer.lastOrderAt && ` · last ${customer.lastOrderAt}`}
                  </span>
                </span>
                <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      </Screen>
    </>
  );
}
