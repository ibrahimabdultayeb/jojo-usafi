import { AdminPage } from "@/components/admin/AdminShell";
import { StaffManager } from "@/components/admin/staff/StaffManager";
import { getStaff } from "@/lib/admin/staff";
import { currentStaff } from "@/lib/admin/authorize";

export const metadata = { title: "Staff" };

export default async function AdminStaffPage() {
  const [staff, me] = await Promise.all([getStaff(), currentStaff()]);

  return (
    <AdminPage
      title="Staff"
      subtitle="Who can use this dashboard, and what each of them can do."
      back={{ href: "/admin/more", label: "More" }}
    >
      <StaffManager staff={staff} role={me?.role ?? "order_staff"} currentId={me?.adminId ?? null} />
    </AdminPage>
  );
}
