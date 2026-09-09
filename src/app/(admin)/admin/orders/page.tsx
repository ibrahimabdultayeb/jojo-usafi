import { AdminPage } from "@/components/admin/AdminShell";
import { OrdersBrowser } from "@/components/admin/orders/OrdersBrowser";
import { getAdminOrders } from "@/lib/admin/orders";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stage = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const orders = await getAdminOrders();

  return (
    <AdminPage title="Orders" subtitle="Newest first. Tap an order to work on it.">
      <OrdersBrowser orders={orders} initialStage={stage} />
    </AdminPage>
  );
}
