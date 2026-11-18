import { AdminPage } from "@/components/admin/AdminShell";
import { CatalogueWorkspace } from "@/components/admin/CatalogueWorkspace";
import { authorize } from "@/lib/admin/authorize";
import { getAdminCatalogue } from "@/lib/catalogue/admin";
export const metadata={title:"Media library"};
export default async function MediaPage(){
 const access=await authorize("products.view");
 if(!access.ok)return <AdminPage title="Media library" subtitle={access.message}>{null}</AdminPage>;
 const {products}=await getAdminCatalogue();
 return <AdminPage title="Media library" subtitle="Review product photographs. Open a product to upload or replace its image."><CatalogueWorkspace products={products} mode="media"/></AdminPage>;
}
