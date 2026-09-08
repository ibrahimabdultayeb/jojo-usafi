import Link from "next/link";
import { PageHeader, Screen } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { adminEn } from "@/lib/admin/copy";

export const metadata = { title: "More" };

const items: { href: string; label: string; hint: string; icon: IconName }[] = [
  {
    href: "/admin/delivery-zones",
    label: adminEn.nav.deliveryZones,
    hint: "Where you deliver and what it costs",
    icon: "pin",
  },
  {
    href: "/admin/website",
    label: adminEn.nav.website,
    hint: "Homepage words, banners and what customers see",
    icon: "image",
  },
  { href: "/admin/reports", label: adminEn.nav.reports, hint: "Sales and stock reports", icon: "chart" },
  { href: "/admin/staff", label: adminEn.nav.staff, hint: "Who can use this admin", icon: "users" },
  { href: "/admin/settings", label: adminEn.nav.settings, hint: "Shop details and preferences", icon: "gear" },
];

/** The rest of the admin, one tap from the bottom bar. */
export default function AdminMorePage() {
  return (
    <>
      <PageHeader title="More" />
      <Screen>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[4.5rem] items-center gap-4 rounded-3xl border border-slate-200 bg-white px-4 shadow-sm transition-colors hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold text-slate-900">
                    {item.label}
                  </span>
                  <span className="block text-sm font-medium text-slate-500">{item.hint}</span>
                </span>
                <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      </Screen>
    </>
  );
}
