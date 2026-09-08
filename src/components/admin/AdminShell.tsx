"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { useRole } from "@/components/admin/RoleContext";
import { adminEn } from "@/lib/admin/copy";
import { roleLabel } from "@/lib/admin/permissions";

/**
 * The admin frame.
 *
 * Phones get a bottom navigation bar — the five things staff actually do —
 * because it is where a thumb already is. Desktop gets the same information
 * architecture as a sidebar. Nothing is available on one and missing on the
 * other.
 */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Also treat these path prefixes as "here", so deep pages keep the tab lit. */
  match?: string[];
}

const PRIMARY: NavItem[] = [
  { href: "/admin", label: adminEn.nav.home, icon: "home" },
  { href: "/admin/orders", label: adminEn.nav.orders, icon: "receipt" },
  { href: "/admin/products", label: adminEn.nav.products, icon: "box" },
  { href: "/admin/customers", label: adminEn.nav.customers, icon: "users" },
];

const MORE: NavItem[] = [
  { href: "/admin/delivery-zones", label: adminEn.nav.deliveryZones, icon: "pin" },
  { href: "/admin/website", label: adminEn.nav.website, icon: "image" },
  { href: "/admin/reports", label: adminEn.nav.reports, icon: "chart" },
  { href: "/admin/staff", label: adminEn.nav.staff, icon: "users" },
  { href: "/admin/settings", label: adminEn.nav.settings, icon: "gear" },
];

const MORE_HREFS = MORE.map((item) => item.href);

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();

  const moreActive =
    pathname === "/admin/more" || MORE_HREFS.some((href) => pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {/* Desktop sidebar — same destinations, no extra powers. */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500">
            <span className="font-display text-lg leading-none font-bold text-white">J</span>
          </span>
          <span className="font-display text-base leading-tight font-bold text-slate-900">
            Jojo Usafi
            <span className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              Admin
            </span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Admin sections">
          <ul className="space-y-1">
            {PRIMARY.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActive(pathname, item)} />
              </li>
            ))}
          </ul>
          <p className="mt-6 mb-2 px-3 text-[11px] font-black tracking-widest text-slate-400 uppercase">
            {adminEn.nav.more}
          </p>
          <ul className="space-y-1">
            {MORE.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActive(pathname, item)} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
            Signed in as
            <span className="mt-0.5 block font-display text-sm font-bold text-slate-900">
              {roleLabel[role]}
            </span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-lg">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 lg:hidden">
              <span className="font-display text-lg leading-none font-bold text-white">J</span>
            </span>
            <AdminSearch />
          </div>
        </header>

        {/* Space at the bottom clears the mobile navigation bar. */}
        <main className="min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation. */}
      <nav
        aria-label="Admin"
        data-qa="admin-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(15_23_42/0.08)] backdrop-blur-lg lg:hidden"
      >
        <ul className="flex items-stretch">
          {PRIMARY.map((item) => (
            <li key={item.href} className="flex-1">
              <BottomLink item={item} active={isActive(pathname, item)} />
            </li>
          ))}
          <li className="flex-1">
            <BottomLink
              item={{ href: "/admin/more", label: adminEn.nav.more, icon: "dots" }}
              active={moreActive}
            />
          </li>
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-colors ${
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon name={item.icon} className="h-5 w-5 shrink-0" />
      {item.label}
    </Link>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-bold transition-colors ${
        active ? "text-brand-700" : "text-slate-500"
      }`}
    >
      <span
        className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
          active ? "bg-brand-50" : ""
        }`}
      >
        <Icon name={item.icon} className="h-5 w-5" />
      </span>
      {item.label}
    </Link>
  );
}
