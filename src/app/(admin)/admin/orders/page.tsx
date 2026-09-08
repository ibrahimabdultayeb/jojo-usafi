import { OrdersBrowser } from "@/components/admin/OrdersBrowser";
import { MockNotice, PageHeader, Screen } from "@/components/admin/ui";
import { ORDER_FILTERS, type OrderFilter } from "@/lib/admin/orders";
import { getOrders } from "@/lib/admin/queries";

export const metadata = { title: "Orders" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requested = first(params.filter);
  const filter: OrderFilter = ORDER_FILTERS.some((f) => f.value === requested)
    ? (requested as OrderFilter)
    : "all";

  const orders = getOrders();

  return (
    <>
      <PageHeader title="Orders" subtitle="Everything customers have ordered." />
      <Screen>
        <MockNotice />
        <OrdersBrowser
          orders={orders}
          initialFilter={filter}
          initialQuery={first(params.q) ?? ""}
        />
      </Screen>
    </>
  );
}
