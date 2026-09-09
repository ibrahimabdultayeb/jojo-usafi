import Link from "next/link";
import { AdminPage } from "@/components/admin/AdminShell";
import { Card, EmptyState } from "@/components/admin/ui";
import { formatTsh, whenWords } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { getAdminCustomers } from "@/lib/admin/orders";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  // Real customers, read through the caller's own session: Row Level Security
  // decides that staff see them and nobody else does.
  const customers = await getAdminCustomers();

  return (
    <AdminPage title="Customers" subtitle="Everyone who has ordered. Tap to see their history.">
      {customers.length === 0 ? (
        <EmptyState
          icon="message"
          title="No customers yet"
          body="A customer appears here the moment they place their first order."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={"/admin/customers/" + customer.id}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                {customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{customer.name}</span>
                <span className="block truncate text-xs font-medium text-slate-500 tabular-nums">
                  {customer.phone}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">
                  {customer.orders} {customer.orders === 1 ? "order" : "orders"} · last{" "}
                  {whenWords(customer.lastOrder).toLowerCase()}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-black text-slate-900 tabular-nums">
                  {formatTsh(customer.spendTzs)}
                </span>
                <span className="block text-[11px] font-medium text-slate-400">spent</span>
              </span>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </Card>
      )}
    </AdminPage>
  );
}
