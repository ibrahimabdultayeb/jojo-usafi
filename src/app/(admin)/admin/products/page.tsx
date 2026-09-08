import { ProductsBrowser, type ProductFilter } from "@/components/admin/ProductsBrowser";
import { MockNotice, PageHeader, Screen } from "@/components/admin/ui";
import { getAdminProducts } from "@/lib/admin/queries";
import { DEMO_STOCK_SKUS } from "@/lib/admin/mock/inventory";

export const metadata = { title: "Products" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: ProductFilter[] = [
  "all",
  "low-stock",
  "out-of-stock",
  "not-on-website",
  "missing-image",
  "sync-issue",
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requested = first(params.filter) as ProductFilter | undefined;
  const filter: ProductFilter = requested && FILTERS.includes(requested) ? requested : "all";

  const products = getAdminProducts();
  const onWebsite = products.filter((entry) => entry.onWebsite).length;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${products.length} products · ${onWebsite} on the website`}
      />
      <Screen>
        <MockNotice>
          Products, prices, item codes and photos are real, from the Product Master. Stock for{" "}
          {DEMO_STOCK_SKUS.length} products has been set to sample low or out-of-stock figures so
          those states can be seen.
        </MockNotice>
        <ProductsBrowser
          products={products}
          initialFilter={filter}
          initialQuery={first(params.q) ?? ""}
        />
      </Screen>
    </>
  );
}
