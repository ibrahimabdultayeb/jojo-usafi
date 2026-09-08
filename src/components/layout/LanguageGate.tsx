"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { switchLocale } from "@/components/layout/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/client";
import {
  LOCALE_STORAGE_KEY,
  isLocale,
  localeName,
  locales,
  type Locale,
} from "@/lib/i18n/config";

/**
 * First-visit language chooser, and the remembered preference.
 *
 * Rules:
 *   - No stored preference → ask once, on the first page of the visit.
 *   - Stored preference that differs from the page being viewed → honour it
 *     once per session, then get out of the way. Navigating inside the site
 *     never redirects, so a shopper who switches language mid-visit stays put.
 *   - A shared link always wins over a stored preference after that first hop,
 *     because the URL is an explicit request for a language.
 *
 * Nothing renders on the server: the choice lives in `localStorage`, so the
 * dialog only appears after mount and cannot cause a hydration mismatch.
 */

const SESSION_APPLIED_KEY = "jojo-usafi.locale.applied.v1";

export function LanguageGate() {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    let applied: string | null = null;
    try {
      stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      applied = window.sessionStorage.getItem(SESSION_APPLIED_KEY);
    } catch {
      // Storage blocked: fall through and simply show the page as requested.
      return;
    }

    if (stored && isLocale(stored)) {
      if (stored !== locale && !applied) {
        try {
          // Set the guard BEFORE navigating so this can never loop.
          window.sessionStorage.setItem(SESSION_APPLIED_KEY, "1");
        } catch {
          return;
        }
        switchLocale(stored, pathname);
        return;
      }
      try {
        window.sessionStorage.setItem(SESSION_APPLIED_KEY, "1");
      } catch {
        // Nothing to do — the preference simply is not remembered this session.
      }
      return;
    }

    setOpen(true);
  }, [locale, pathname]);

  useEffect(() => {
    if (!open) return;
    firstButton.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") choose(locale);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // `choose` is stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locale]);

  function choose(chosen: Locale) {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, chosen);
      window.sessionStorage.setItem(SESSION_APPLIED_KEY, "1");
    } catch {
      // Carry on: the shopper still gets the language they asked for.
    }
    if (chosen === locale) {
      setOpen(false);
      return;
    }
    switchLocale(chosen, pathname);
  }

  if (!open) return null;

  const continueLabel: Record<Locale, string> = {
    en: t.language.continueEnglish,
    sw: t.language.continueSwahili,
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-4 sm:items-center">
      <div aria-hidden className="fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-chooser-title"
        className="rise relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 font-display text-xl font-black text-brand-700">
          J
        </span>

        <h2
          id="language-chooser-title"
          className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900"
        >
          {t.language.chooserTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed font-medium text-slate-500">
          {t.language.chooserBody}
        </p>

        <div className="mt-6 space-y-3">
          {locales.map((option, i) => (
            <button
              key={option}
              ref={i === 0 ? firstButton : undefined}
              type="button"
              lang={option}
              onClick={() => choose(option)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 px-5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <span>
                <span className="block font-display text-base font-bold text-slate-900">
                  {localeName[option]}
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {continueLabel[option]}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-white uppercase">
                {option}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-xs font-medium text-slate-400">
          {t.language.chooserNote}
        </p>
      </div>
    </div>
  );
}
