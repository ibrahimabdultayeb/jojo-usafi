import { AdminPage } from "@/components/admin/AdminShell";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata = { title: "Staff" };

export default function AdminStaffPage() {
  return (
    <AdminPage title={"Staff"} back={{ href: "/admin/more", label: "More" }}>
      <ComingSoon
        icon="shield"
        title={"Staff accounts arrive with sign-in"}
        body={"You will create an account for each person who helps run the shop, and choose how much they can see."}
        bullets={["Owner — everything, including staff and reports", "Manager — orders, products, customers and delivery", "Order staff — orders and customer contact only"]}
      />
    </AdminPage>
  );
}
