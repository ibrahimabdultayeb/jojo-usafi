import { AdminPage } from "@/components/admin/AdminShell";
import { OrdersBrowser } from "@/components/admin/orders/OrdersBrowser";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stage = Array.isArray(params.stage) ? params.stage[0] : params.stage;

  return (
    <AdminPage title="Orders" subtitle="Newest first. Tap an order to work on it.">
      <OrdersBrowser initialStage={stage} />
    </AdminPage>
  );
}
