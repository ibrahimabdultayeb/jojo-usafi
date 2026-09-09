import { AdminPage } from "@/components/admin/AdminShell";
import { ProductsBrowser } from "@/components/admin/products/ProductsBrowser";
import { getAdminCatalogue } from "@/lib/catalogue/admin";

export const metadata = { title: "Products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  // Real products, read under the caller's own Row Level Security: staff see
  // all 201 including the withheld ones, anyone else sees only the public 95.
  const { products, complete } = await getAdminCatalogue();

  return (
    <AdminPage
      title="Products"
      subtitle={
        complete
          ? "Prices, stock and what shows on the website."
          : "Showing only products that are already public — sign in to see everything."
      }
    >
      <ProductsBrowser products={products} initialFilter={filter} />
    </AdminPage>
  );
}
