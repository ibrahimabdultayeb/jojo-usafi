import { ZoneManager } from "@/components/admin/ZoneManager";
import { MockNotice, PageHeader, Screen } from "@/components/admin/ui";
import { getZones } from "@/lib/admin/queries";

export const metadata = { title: "Delivery Zones" };

export default function AdminZonesPage() {
  const zones = getZones();

  return (
    <>
      <PageHeader
        title="Delivery Zones"
        subtitle="Where you deliver, and what the customer pays."
        back={{ href: "/admin/more", label: "More" }}
      />
      <Screen>
        <MockNotice>
          Sample zones and fees. The real areas Jojo Usafi serves, and what each one costs, are
          still to be decided — nothing here is agreed pricing.
        </MockNotice>
        <ZoneManager zones={zones} />
      </Screen>
    </>
  );
}
