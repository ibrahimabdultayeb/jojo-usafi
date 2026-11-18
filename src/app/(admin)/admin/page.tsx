import { getAdminCatalogue } from "@/lib/catalogue/admin";
import { getAdminSnapshot, getRecentStockActivity } from "@/lib/admin/orders";
import { currentStaff } from "@/lib/admin/authorize";
import { can } from "@/lib/admin/permissions";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const metadata = { title: "Overview" };
export default async function AdminHomePage() {
  const staff = await currentStaff();
  const role = staff?.role ?? "order_staff";
  const showProducts = can(role,"products.view");
  const [catalogue,snapshot,stockActivity] = await Promise.all([
    showProducts?getAdminCatalogue():null,
    getAdminSnapshot(),
    showProducts?getRecentStockActivity(3):[],
  ]);
  const products = catalogue?.products.filter(p=>p.lifecycle!=="archived") ?? [];
  return <AdminOverview name={staff?.name ?? ""} role={role} snapshot={snapshot}
    lowStock={products.filter(p=>p.available>0 && p.available<=p.lowStockThreshold).length}
    outOfStock={products.filter(p=>p.available<=0).length}
    missingImages={products.filter(p=>p.missingImage).length}
    stockActivity={stockActivity} now={new Date().toISOString()}/>;
}
