"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/layout/Logo";
import { getCategories } from "@/lib/catalogue/queries";
import { nav, site, whatsappLink } from "@/lib/site";
import { toneSet } from "@/lib/tones";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const categories = getCategories();

  return (
    <div className="fixed inset-0 z-60 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="sheet-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 sm:h-16">
          <Logo compact />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-4 py-5" aria-label="Mobile">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex min-h-14 items-center justify-between rounded-2xl px-4 font-display text-lg font-bold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  {item.label}
                  <Icon name="chevronRight" className="h-5 w-5 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-7 mb-3 px-4 text-[11px] font-black tracking-widest text-slate-400 uppercase">
            Shop by category
          </p>
          <ul className="space-y-1">
            {categories.map((category) => {
              const tone = toneSet(category.tone);
              return (
                <li key={category.id}>
                  <Link
                    href={`/shop?category=${category.slug}`}
                    onClick={onClose}
                    className="flex min-h-14 items-center gap-3 rounded-2xl px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.tile}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                        <path d={category.icon} />
                      </svg>
                    </span>
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            href={whatsappLink(`Hi ${site.name}, I need help with an order.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="whatsapp" className="h-5 w-5" />
            Chat with support
          </a>
          <p className="mt-3 text-center text-xs font-medium text-slate-500">
            Delivering across {site.serviceArea}
          </p>
        </div>
      </div>
    </div>
  );
}
