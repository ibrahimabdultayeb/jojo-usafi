import { AdminPage } from "@/components/admin/AdminShell";
import { WebsiteSettings } from "@/components/admin/website/WebsiteSettings";
import { getShopSettings } from "@/lib/admin/settings";
import { currentStaff } from "@/lib/admin/authorize";

export const metadata = { title: "Website" };

export default async function AdminWebsitePage() {
  const [settings, staff] = await Promise.all([getShopSettings(), currentStaff()]);

  return (
    <AdminPage
      title="Website"
      subtitle="The words customers read, in both languages."
      back={{ href: "/admin/more", label: "More" }}
    >
      <WebsiteSettings content={settings.website} role={staff?.role ?? "order_staff"} />
    </AdminPage>
  );
}
