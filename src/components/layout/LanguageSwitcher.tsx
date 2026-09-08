"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import {
  LOCALE_STORAGE_KEY,
  localePath,
  localeShortName,
  locales,
  stripLocale,
  type Locale,
} from "@/lib/i18n/config";

/**
 * EN / SW switcher.
 *
 * Switching keeps the shopper on the page they were reading: the current path
 * is stripped of its language prefix and rebuilt in the other language, with the
 * query string (category, sort, search) carried across untouched. The cart is
 * stored against SKUs in `localStorage`, so it is language-independent and
 * survives the switch.
 */

/** Remember the choice, then move to the same page in the chosen language. */
export function switchLocale(locale: Locale, pathname: string) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A blocked storage quota must never stop the shopper changing language.
  }
  const search = window.location.search;
  // Each language has its own root layout, so this is a full navigation.
  window.location.assign(`${localePath(locale, stripLocale(pathname))}${search}`);
}

/**
 * The control is the same size in both languages by construction: EN and SW are
 * both two characters, and each button is a fixed 44px minimum square. Nothing
 * needs reserving here — it is the labels *around* it that move it, which is
 * what `StableText` in the header prevents.
 */
export function LanguageSwitcher({
  className = "",
  anchor,
}: {
  className?: string;
  /** Names this control for the QA locale-stability comparison. */
  anchor?: string;
}) {
  const { locale, t } = useLocale();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={t.language.switchLabel}
      data-qa-anchor={anchor}
      className={`items-center rounded-full bg-slate-100 p-1 ${className}`}
    >
      {locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            onClick={() => !active && switchLocale(option, pathname)}
            aria-pressed={active}
            className={`min-h-11 min-w-11 rounded-full px-3 text-xs font-black tracking-wide transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {localeShortName[option]}
          </button>
        );
      })}
    </div>
  );
}
