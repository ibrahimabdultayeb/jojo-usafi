"use client";

import Link from "@/components/ui/LoadingLink";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { StableText } from "@/components/ui/StableText";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n";
import { stripLocale } from "@/lib/i18n/config";

/**
 * Floating layer: `z-40` — sticky, and below anything that floats over content.
 *
 * LANGUAGE STABILITY
 *   The header is the one piece of chrome on every page, so it is where a
 *   language switch is most obvious. Each nav label and the cart label reserve
 *   the width of their longest translation (`StableText`), which pins the nav
 *   block and therefore everything measured from it: the search field keeps its
 *   width, and the language control and cart button keep their position.
 *   Switching EN ↔ SW changes the words inside the frame and not the frame.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, openCart, hydrated } = useCart();
  const { t, path } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, startSearch] = useTransition();
  const [term, setTerm] = useState("");

  // `pick` is how each slot finds its own translations, so the reserved width
  // follows the dictionary instead of a number written down here.
  const nav: { key: string; label: string; pick: (d: Dictionary) => string; href: string }[] = [
    { key: "home", label: t.nav.home, pick: (d) => d.nav.home, href: "/" },
    { key: "shop", label: t.nav.shop, pick: (d) => d.nav.shop, href: "/shop" },
    { key: "track", label: t.nav.track, pick: (d) => d.nav.track, href: "/track-order" },
    { key: "contact", label: t.nav.contact, pick: (d) => d.nav.contact, href: "/contact" },
  ];

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    startSearch(() => router.push(q ? `${path("/shop")}?q=${encodeURIComponent(q)}` : path("/shop")));
  }

  // Compared without the language prefix so the active state is the same in both.
  const here = stripLocale(pathname);
  const isActive = (href: string) => (href === "/" ? here === "/" : here.startsWith(href));

  return (
    <>
      <header className="showroom-header sticky top-0 z-40 w-full">
        <div className="showroom-wrap showroom-header-row flex items-center">
          <Logo />

          <nav
            data-qa-anchor="nav"
            className="showroom-header-nav hidden shrink-0 items-center lg:flex"
            aria-label="Main"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={path(item.href)}
                data-qa-anchor={`nav-${item.key}`}
                aria-current={isActive(item.href) ? "page" : undefined}
                className="showroom-nav-link transition-colors"
              >
                <StableText pick={item.pick}>{item.label}</StableText>
              </Link>
            ))}
          </nav>

          <form
            onSubmit={submitSearch}
            data-qa-anchor="search"
            className="showroom-header-search relative hidden md:block"
            role="search" aria-busy={searching}
          >
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-0 h-[19px] w-[19px] -translate-y-1/2 text-slate-500"
            />
            {searching && <span className="absolute right-1 top-3"><Spinner /></span>}
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              type="search"
              placeholder={t.header.searchPlaceholder}
              aria-label={t.header.searchLabel}
              className="min-h-11 w-full py-2 pl-7 pr-7 text-sm placeholder:text-slate-500"
            />
          </form>

          <div className="flex-1 md:hidden" />

          <div className="showroom-header-actions flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher className="showroom-language hidden lg:inline-flex" anchor="language" />

            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label={t.header.searchLabel}
              data-qa-anchor="search-toggle"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 md:hidden"
            >
              <Icon name={searchOpen ? "close" : "search"} className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={openCart}
              aria-label={t.meta.cartTitle}
              data-qa-anchor="cart"
              className="showroom-cart-button relative flex h-11 w-11 items-center justify-center rounded-xl text-white transition-colors"
            >
              <Icon name="bag" className="h-5 w-5" />
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
              data-qa-anchor="menu"
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
              {searching && <span className="absolute right-4 top-4"><Spinner /></span>}
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
