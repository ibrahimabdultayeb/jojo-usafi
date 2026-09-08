import { ComingSoon } from "@/components/admin/ComingSoon";
import { RoleSwitcher } from "@/components/admin/RoleSwitcher";
import { Card, DetailRow, PageHeader, Screen, SectionTitle } from "@/components/admin/ui";
import { site } from "@/lib/site";

export const metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Shop details and preferences."
        back={{ href: "/admin/more", label: "More" }}
      />
      <Screen>
        <div className="space-y-4">
          <Card>
            <SectionTitle>Preview a role</SectionTitle>
            <RoleSwitcher />
          </Card>

          <Card>
            <SectionTitle>Shop details</SectionTitle>
            <p className="mb-2 text-sm font-medium text-slate-500">
              These are placeholders until the real business details are provided.
            </p>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Shop name">{site.name}</DetailRow>
              <DetailRow label="WhatsApp">{site.phone}</DetailRow>
              <DetailRow label="Email">{site.email}</DetailRow>
              <DetailRow label="Address">{site.addressLine}</DetailRow>
              <DetailRow label="Opening hours">{site.hours}</DetailRow>
              <DetailRow label="Delivery area">{site.serviceArea}</DetailRow>
            </dl>
          </Card>

          <ComingSoon
            icon="gear"
            what="Changing the shop details, opening hours and ordering rules yourself."
            waitingFor="the database, so a change can be saved"
            bullets={[
              "Shop name, phone, WhatsApp and email",
              "Opening hours and the same-day cut-off",
              "Whether customers can order something out of stock",
              "Free-delivery threshold, once it is decided",
            ]}
          />
        </div>
      </Screen>
    </>
  );
}
