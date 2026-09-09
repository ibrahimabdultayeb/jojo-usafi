import { AdminPage } from "@/components/admin/AdminShell";
import { SyncManager } from "@/components/admin/sync/SyncManager";
import { getOpenConflicts, getSyncOverview } from "@/lib/sheets/status";
import { currentStaff } from "@/lib/admin/authorize";

export const metadata = { title: "Catalogue sync" };

export default async function CatalogueSyncPage() {
  const [overview, conflicts, staff] = await Promise.all([
    getSyncOverview(),
    getOpenConflicts(),
    currentStaff(),
  ]);

  return (
    <AdminPage
      title="Catalogue sync"
      subtitle="Keeping the product sheet and Jojo Usafi saying the same thing."
      back={{ href: "/admin/more", label: "More" }}
    >
      <SyncManager overview={overview} conflicts={conflicts} role={staff?.role ?? "order_staff"} />
    </AdminPage>
  );
}
