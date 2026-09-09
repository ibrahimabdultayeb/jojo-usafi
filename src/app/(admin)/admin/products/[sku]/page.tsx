import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { getAdminCatalogue } from "@/lib/catalogue/admin";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return { title: sku };
}

export default async function AdminProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const { products } = await getAdminCatalogue();
  const product = products.find((p) => p.sku === sku);
  if (!product) notFound();

  return (
    <AdminPage
      title="Edit product"
      back={{ href: "/admin/products", label: "All products" }}
    >
      <ProductEditor product={product} />
    </AdminPage>
  );
}
