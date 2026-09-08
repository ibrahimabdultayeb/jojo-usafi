import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { adminProducts } from "@/mocks/admin/data";

export function generateStaticParams() {
  return adminProducts().map((product) => ({ sku: product.sku }));
}

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return { title: sku };
}

export default async function AdminProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = adminProducts().find((p) => p.sku === sku);
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
