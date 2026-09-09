import { AdminPage } from "@/components/admin/AdminShell";
import { ZonesManager } from "@/components/admin/zones/ZonesManager";
import { getAdminZones } from "@/lib/admin/orders";
import { currentStaff } from "@/lib/admin/authorize";

export const metadata = { title: "Delivery zones" };

export default async function AdminZonesPage() {
  const [zones, staff] = await Promise.all([getAdminZones(), currentStaff()]);

  return (
    <AdminPage
      title="Delivery zones"
      subtitle="The areas you deliver to, and what each one costs."
      back={{ href: "/admin/more", label: "More" }}
    >
      <ZonesManager zones={zones} role={staff?.role ?? "order_staff"} />
    </AdminPage>
  );
}
