import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { ProductPhoto } from "@/components/admin/products/ProductPhoto";
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
      {/*
        The photograph comes first. 106 of the 201 products are held off the
        website for want of one, so for most products this is the only thing on
        the screen that changes anything.
      */}
      <ProductPhoto
        sku={product.sku}
        name={product.name}
        image={product.image}
        isPublic={!product.missingImage && product.visible && product.lifecycle === "active"}
        blockedReason={
          product.suspiciousPrice
            ? "The price has not been confirmed, so it is held back."
            : !product.visible
              ? "It is switched off for the website."
              : product.lifecycle !== "active"
                ? `Its status is ${product.lifecycle}.`
                : null
        }
        role={staff?.role ?? "order_staff"}
      />

      <ProductEditor product={product} role={staff?.role ?? "order_staff"} />
    </AdminPage>
  );
}
