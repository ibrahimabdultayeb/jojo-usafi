import { AdminPage } from "@/components/admin/AdminShell";
import { ProductsBrowser } from "@/components/admin/products/ProductsBrowser";
import { adminProducts } from "@/mocks/admin/data";

export const metadata = { title: "Products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = Array.isArray(params.filter) ? params.filter[0] : params.filter;

  return (
    <AdminPage title="Products" subtitle="Prices, stock and what shows on the website.">
      <ProductsBrowser products={adminProducts()} initialFilter={filter} />
    </AdminPage>
  );
}
