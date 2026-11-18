import { AdminPage } from "@/components/admin/AdminShell";
import { CatalogueWorkspace } from "@/components/admin/CatalogueWorkspace";
import { authorize } from "@/lib/admin/authorize";
import { getAdminCatalogue } from "@/lib/catalogue/admin";
export const metadata={title:"Inventory"};
export default async function InventoryPage(){
 const access=await authorize("products.view");
 if(!access.ok)return <AdminPage title="Inventory" subtitle={access.message}>{null}</AdminPage>;
 const {products}=await getAdminCatalogue();
 return <AdminPage title="Inventory" subtitle="Available stock is on hand minus the quantities reserved for orders."><CatalogueWorkspace products={products} mode="inventory"/></AdminPage>;
}
