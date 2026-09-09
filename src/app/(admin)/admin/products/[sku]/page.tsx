import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { getAdminCatalogue } from "@/lib/catalogue/admin";
import { currentStaff } from "@/lib/admin/authorize";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return { title: sku };
}

export default async function AdminProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const [{ products }, staff] = await Promise.all([getAdminCatalogue(), currentStaff()]);
  const product = products.find((p) => p.sku === sku);
  if (!product) notFound();

  // The role decides which controls are worth drawing. It is not the boundary:
  // every write goes through `authorize()` and then Row Level Security, so a
  // control that should not exist would still be refused if it were forced.
  return (
    <AdminPage title="Edit product" back={{ href: "/admin/products", label: "All products" }}>
      <ProductEditor product={product} role={staff?.role ?? "order_staff"} />
    </AdminPage>
  );
}
