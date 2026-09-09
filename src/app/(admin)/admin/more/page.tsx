import Link from "next/link";
import { AdminPage } from "@/components/admin/AdminShell";
import { Badge, Card } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { can, ROLE_LABELS, type Capability, type Role } from "@/lib/admin/permissions";
import { currentStaff } from "@/lib/admin/authorize";
import { signOutAction } from "../sign-in/actions";

export const metadata = { title: "More" };

/** What each role can do, said once, in the words an operator would use. */
const ROLE_SUMMARY: Record<Role, string> = {
  owner: "you can see and change everything.",
  manager: "you can run the shop, but not add or remove staff.",
  order_staff: "you can work on orders and see customers.",
};

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
    href: "/admin/more/catalogue-sync",
    label: "Catalogue sync",
    hint: "Keep the product sheet and the shop saying the same thing",
    icon: "sparkle",
    capability: "catalogue.sync",
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
 * Entries are filtered by the signed-in staff member's real capabilities, so an
 * Order staff account simply sees a shorter list. Hiding an entry is a courtesy
 * to the reader, not the boundary: the pages behind them are governed by Row
 * Level Security, and every write additionally passes `authorize()`.
 */
export default async function AdminMorePage() {
  const staff = await currentStaff();
  const role = staff?.role ?? "order_staff";
  const allowed = ITEMS.filter((item) => can(role, item.capability));

  return (
    <AdminPage
      title="More"
      subtitle={
        allowed.length > 0
          ? "Everything else you can change."
          : "Your account is set up for orders and customers."
      }
    >
      {/*
        An Order staff account manages none of these, so the card would be an
        empty box. Saying why is kinder than showing nothing, and it is the
        truth: they are not missing anything, they simply do not do this part.
      */}
      {allowed.length === 0 && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-bold text-slate-900">Nothing to change here</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Prices, stock, delivery areas and the website are looked after by the Owner and
            Managers. Your work is on the Orders and Customers screens.
          </p>
        </Card>
      )}

      <Card className={`mb-5 divide-y divide-slate-100 ${allowed.length === 0 ? "hidden" : ""}`}>
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
        <p className="text-sm font-bold text-slate-900">
          {staff ? `Signed in as ${staff.name}` : "Not signed in"}
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          {staff
            ? `${ROLE_LABELS[role]} — ${ROLE_SUMMARY[role]}`
            : "Sign in to see and change anything here."}
        </p>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 font-display text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            {staff ? "Sign out" : "Go to sign in"}
          </button>
        </form>
      </Card>
    </AdminPage>
  );
}
