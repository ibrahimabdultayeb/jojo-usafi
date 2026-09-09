"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { currentUser, ROLE_LABELS } from "@/lib/admin/permissions";

/**
 * The admin frame.
 *
 * Bottom navigation on phones — five destinations, thumb-height, safe-area
 * aware — and a left sidebar from `lg` up with the identical information
 * architecture. Nothing lives only on desktop.
 */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "sparkle" },
  { href: "/admin/orders", label: "Orders", icon: "package" },
  { href: "/admin/products", label: "Products", icon: "cart" },
  { href: "/admin/customers", label: "Customers", icon: "message" },
  { href: "/admin/more", label: "More", icon: "menu" },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/**
 * The sign-in and first-Owner screens sit inside `/admin` so they share its root
 * layout, fonts and design tokens — but they must not wear the dashboard's
 * chrome. Offering a nav bar to somebody who is not signed in advertises
 * destinations they cannot reach, and the bottom navigation would cover a
 * password field on a phone.
 */
const BARE_ROUTES = ["/admin/sign-in", "/admin/setup"];

function isBareRoute(pathname: string) {
  return BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  if (isBareRoute(pathname)) {
    return <div className="min-h-svh bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-svh bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500">
            <span className="font-display text-lg leading-none font-bold text-white">J</span>
          </span>
          <span className="font-display text-sm leading-tight font-bold text-slate-900">
            Jojo Usafi
            <span className="block text-[11px] font-semibold text-slate-400">Shop admin</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
              {currentUser.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">{currentUser.name}</span>
              <span className="block text-[11px] font-semibold text-slate-400">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        {/* z-40: the sticky-header layer of the contract in globals.css. */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 lg:hidden">
              <span className="font-display text-lg leading-none font-bold text-white">J</span>
            </span>

            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              className="flex min-h-11 flex-1 items-center gap-2.5 rounded-xl bg-slate-100 px-3.5 text-left text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200"
            >
              <Icon name="search" className="h-4 w-4 shrink-0" />
              <span className="truncate">Search orders, products, customers…</span>
            </button>

            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white lg:hidden sm:flex">
              {currentUser.initials}
            </span>
          </div>

          {searchOpen && (
            <div className="border-t border-slate-100 px-4 pb-4 sm:px-6">
              <input
                autoFocus
                type="search"
                placeholder="Order number, phone, product name, SKU or barcode"
                aria-label="Search the shop"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base font-semibold placeholder:font-medium placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-2 text-xs font-medium text-slate-500">
                Search is switched on in a later build. It will find an order number, a phone
                number, a customer, a product, an SKU or a barcode.
              </p>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold transition-colors ${
                    active ? "text-brand-700" : "text-slate-500"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Page header used by every admin screen. */
export function AdminPage({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </>
  );
}
