import { AdminPage } from "@/components/admin/AdminShell";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <AdminPage title={"Settings"} back={{ href: "/admin/more", label: "More" }}>
      <ComingSoon
        icon="wallet"
        title={"Shop settings arrive with the live shop"}
        body={"Your shop phone number, WhatsApp number, opening hours, and how long an unconfirmed order may hold stock."}
        bullets={["Shop contact details", "How long an order holds stock before you are warned", "Payment methods you accept"]}
      />
    </AdminPage>
  );
}
