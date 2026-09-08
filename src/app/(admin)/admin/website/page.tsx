import { WebsiteEditor } from "@/components/admin/WebsiteEditor";
import { MockNotice, PageHeader, Screen } from "@/components/admin/ui";
import { getWebsiteContent } from "@/lib/admin/queries";
import { getCategories, getProductBySku, productName } from "@/lib/catalogue/queries";

export const metadata = { title: "Website" };

export default function AdminWebsitePage() {
  const content = getWebsiteContent();

  // Staff should never be shown a bare SKU or slug where a name will do.
  const productNames: Record<string, string> = {};
  for (const sku of [...content.featuredSkus, ...content.bestSellerSkus]) {
    const product = getProductBySku(sku);
    if (product) productNames[sku] = `${productName(product)} ${product.packSize}`;
  }

  const categoryNames: Record<string, string> = {};
  for (const category of getCategories()) categoryNames[category.slug] = category.name;

  return (
    <>
      <PageHeader
        title="Website"
        subtitle="What customers read on the homepage."
        back={{ href: "/admin/more", label: "More" }}
      />
      <Screen>
        <MockNotice>
          Prototype — changes are not saved and the live website still shows its built-in
          content.
        </MockNotice>
        <WebsiteEditor
          content={content}
          productNames={productNames}
          categoryNames={categoryNames}
        />
      </Screen>
    </>
  );
}
