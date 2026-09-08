"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/i18n/client";
import { stripLocale } from "@/lib/i18n/config";

/** Floating layer: `z-40` — sticky, and below anything that floats over content. */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, openCart, hydrated } = useCart();
  const { t, path } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");

  const nav = [
    { label: t.nav.home, href: "/" },
    { label: t.nav.shop, href: "/shop" },
    { label: t.nav.track, href: "/track-order" },
    { label: t.nav.contact, href: "/contact" },
  ];

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    router.push(q ? `${path("/shop")}?q=${encodeURIComponent(q)}` : path("/shop"));
    setSearchOpen(false);
  }

  // Compared without the language prefix so the active state is the same in both.
  const here = stripLocale(pathname);
  const isActive = (href: string) => (href === "/" ? here === "/" : here.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/85 backdrop-blur-xl">
        <div className="shell flex h-14 items-center gap-1 sm:h-16 sm:gap-4 lg:h-20 lg:gap-6">
          <Logo />

          <nav className="hidden shrink-0 items-center gap-1 lg:flex" aria-label="Main">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={path(item.href)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form
            onSubmit={submitSearch}
            className="relative hidden max-w-md flex-1 md:block"
            role="search"
          >
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              type="search"
              placeholder={t.header.searchPlaceholder}
              aria-label={t.header.searchLabel}
              className="min-h-11 w-full rounded-full border border-transparent bg-slate-100/80 py-2.5 pr-5 pl-11 text-sm font-semibold transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
          </form>

          <div className="flex-1 md:hidden" />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher className="hidden lg:inline-flex" />

            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label={t.header.searchLabel}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 md:hidden"
            >
              <Icon name={searchOpen ? "close" : "search"} className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={openCart}
              aria-label={t.meta.cartTitle}
              className="relative flex h-11 items-center gap-2 rounded-full bg-slate-900 px-3.5 text-xs font-bold tracking-wide text-white shadow-md transition-colors hover:bg-brand-600 sm:px-5"
            >
              <Icon name="cart" className="h-4 w-4" />
              <span className="hidden lg:inline">{t.header.cart}</span>
              {hydrated && count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-black text-white ring-2 ring-white">
                  {count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t.header.openMenu}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <form onSubmit={submitSearch} className="shell fade-in pb-3 md:hidden" role="search">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                type="search"
                placeholder={t.header.searchPlaceholder}
                aria-label={t.header.searchLabel}
                className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pr-5 pl-11 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>
          </form>
        )}
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
