import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader, Screen } from "@/components/admin/ui";
import { getAdminProduct, getAdminProducts } from "@/lib/admin/queries";
import { productName } from "@/lib/catalogue/queries";

type Params = Promise<{ sku: string }>;

export function generateStaticParams() {
  return getAdminProducts().map((entry) => ({ sku: entry.product.sku }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { sku } = await params;
  const entry = getAdminProduct(sku);
  return { title: entry ? productName(entry.product) : "Product" };
}

export default async function AdminProductPage({ params }: { params: Params }) {
  const { sku } = await params;
  const entry = getAdminProduct(sku);
  if (!entry) notFound();

  return (
    <>
      <PageHeader
        title="Edit product"
        subtitle={`${entry.brandName} · ${entry.product.packSize}`}
        back={{ href: "/admin/products", label: "Products" }}
      />
      <Screen>
        <ProductEditor entry={entry} />
      </Screen>
    </>
  );
}
