import { AdminPage } from "@/components/admin/AdminShell";
import { ZonesManager } from "@/components/admin/zones/ZonesManager";

export const metadata = { title: "Delivery zones" };

export default function AdminZonesPage() {
  return (
    <AdminPage
      title="Delivery zones"
      subtitle="The areas you deliver to, and what each one costs."
      back={{ href: "/admin/more", label: "More" }}
    >
      <ZonesManager />
    </AdminPage>
  );
}
