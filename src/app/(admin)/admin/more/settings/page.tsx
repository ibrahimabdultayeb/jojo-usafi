import { AdminPage } from "@/components/admin/AdminShell";
import { ShopSettingsEditor } from "@/components/admin/settings/ShopSettingsEditor";
import { getShopSettings, launchGaps } from "@/lib/admin/settings";
import { currentStaff } from "@/lib/admin/authorize";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [settings, staff] = await Promise.all([getShopSettings(), currentStaff()]);

  return (
    <AdminPage
      title="Settings"
      subtitle="The shop's own details, and how long an order holds stock."
      back={{ href: "/admin/more", label: "More" }}
    >
      <ShopSettingsEditor
        business={settings.business}
        reservation={settings.reservation}
        gaps={launchGaps(settings)}
        role={staff?.role ?? "order_staff"}
      />
    </AdminPage>
  );
}
