import { ComingSoon } from "@/components/admin/ComingSoon";
import { Card, PageHeader, Screen, SectionTitle } from "@/components/admin/ui";
import { roleDescription, roleLabel, roles } from "@/lib/admin/permissions";

export const metadata = { title: "Staff" };

export default function AdminStaffPage() {
  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Who can use this admin, and what they can do."
        back={{ href: "/admin/more", label: "More" }}
      />
      <Screen>
        <div className="space-y-4">
          <ComingSoon
            icon="users"
            what="Adding people, giving them a role, and removing them when they leave."
            waitingFor="sign-in, which arrives with the database"
            bullets={[
              "Invite someone by phone number",
              "Give them a role",
              "See who changed what",
              "Remove access immediately",
            ]}
          />

          <Card>
            <SectionTitle>The three roles</SectionTitle>
            <p className="mb-3 text-sm font-medium text-slate-500">
              These are already built into every screen — buttons a role cannot use are hidden
              rather than shown and refused.
            </p>
            <ul className="space-y-2">
              {roles.map((role) => (
                <li key={role} className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-display text-sm font-bold text-slate-900">
                    {roleLabel[role]}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    {roleDescription[role]}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Screen>
    </>
  );
}
