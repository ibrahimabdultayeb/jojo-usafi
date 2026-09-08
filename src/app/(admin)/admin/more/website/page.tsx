import { AdminPage } from "@/components/admin/AdminShell";
import { WebsiteEditor } from "@/components/admin/website/WebsiteEditor";

export const metadata = { title: "Website" };

export default function AdminWebsitePage() {
  return (
    <AdminPage
      title="Website"
      subtitle="Change what the shop says, in English and Kiswahili."
      back={{ href: "/admin/more", label: "More" }}
    >
      <WebsiteEditor />
    </AdminPage>
  );
}
