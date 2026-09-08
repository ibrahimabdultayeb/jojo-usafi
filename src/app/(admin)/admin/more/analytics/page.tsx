import { AdminPage } from "@/components/admin/AdminShell";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata = { title: "Reports" };

export default function AdminAnalyticsPage() {
  return (
    <AdminPage title={"Reports"} back={{ href: "/admin/more", label: "More" }}>
      <ComingSoon
        icon="star"
        title={"Reports arrive once orders are live"}
        body={"Once real orders start coming in, this is where you will see sales, your best products and how quickly orders are going out."}
        bullets={["Sales by day and month", "Best and slowest products", "Cancellations and failed deliveries"]}
      />
    </AdminPage>
  );
}
