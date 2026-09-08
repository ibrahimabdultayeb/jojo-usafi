import Link from "next/link";
import { AdminPage } from "@/components/admin/AdminShell";
import { Badge, Card } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { can, currentUser, ROLE_LABELS, type Capability } from "@/lib/admin/permissions";

export const metadata = { title: "More" };

const ITEMS: {
  href: string;
  label: string;
  hint: string;
  icon: IconName;
  capability: Capability;
  soon?: boolean;
}[] = [
  {
    href: "/admin/more/delivery-zones",
    label: "Delivery zones",
    hint: "Areas you deliver to and what each costs",
    icon: "truck",
    capability: "delivery.manage",
  },
  {
    href: "/admin/more/website",
    label: "Website",
    hint: "Announcement, banner and what shows on the homepage",
    icon: "sparkle",
    capability: "website.manage",
  },
  {
    href: "/admin/more/analytics",
    label: "Reports",
    hint: "Sales and product performance",
    icon: "star",
    capability: "analytics.view",
    soon: true,
  },
  {
    href: "/admin/more/staff",
    label: "Staff",
    hint: "Who can use this dashboard",
    icon: "shield",
    capability: "staff.manage",
    soon: true,
  },
  {
    href: "/admin/more/settings",
    label: "Settings",
    hint: "Shop details and preferences",
    icon: "wallet",
    capability: "settings.manage",
    soon: true,
  },
];

/**
 * The overflow menu.
 *
 * Entries are filtered by capability rather than hard-coded, so when Build 06
 * introduces real roles an Order staff account simply sees a shorter list —
 * no screen needs redesigning.
 */
export default function AdminMorePage() {
  const allowed = ITEMS.filter((item) => can(currentUser.role, item.capability));

  return (
    <AdminPage title="More" subtitle="Everything else you can change.">
      <Card className="mb-5 divide-y divide-slate-100">
        {allowed.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-16 items-center gap-3 p-4 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{item.label}</span>
                {item.soon && <Badge tone="neutral">Coming soon</Badge>}
              </span>
              <span className="block text-xs font-medium text-slate-500">{item.hint}</span>
            </span>
            <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">Signed in as {currentUser.name}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          {ROLE_LABELS[currentUser.role]} — you can see everything.
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
          Signing in is switched on in a later build. Owners will be able to add Managers and Order
          staff, who see fewer of these settings.
        </p>
      </Card>
    </AdminPage>
  );
}
