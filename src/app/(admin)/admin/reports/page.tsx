import { ComingSoon } from "@/components/admin/ComingSoon";
import { PageHeader, Screen } from "@/components/admin/ui";

export const metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="How the shop is doing."
        back={{ href: "/admin/more", label: "More" }}
      />
      <Screen>
        <ComingSoon
          icon="chart"
          what="Sales and stock reports over a period you choose, so you can see what is selling and what is sitting."
          waitingFor="real orders in the database"
          bullets={[
            "Sales by day, week and month",
            "Best and worst selling products",
            "Delivery zones by order count",
            "Stock that has not moved",
            "Cancelled and failed deliveries, with reasons",
          ]}
        />
      </Screen>
    </>
  );
}
