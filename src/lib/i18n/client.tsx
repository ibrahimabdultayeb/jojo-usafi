"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getDictionary, localePath, type Dictionary } from "./index";
import { defaultLocale, type Locale } from "./config";

/**
 * Client-side access to the current language.
 *
 * Each locale has its own root layout, so the locale is a literal known at build
 * time and is handed down through this provider rather than sniffed from the
 * pathname. That keeps statically prerendered pages correct with no hydration
 * guesswork.
 */

interface LocaleValue {
  locale: Locale;
  t: Dictionary;
  /** `/cart` in the current language. */
  path: (path: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      path: (path: string) => localePath(locale, path),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  // A client component rendered outside a locale root still has to work.
  if (!ctx) {
    return {
      locale: defaultLocale,
      t: getDictionary(defaultLocale),
      path: (path: string) => localePath(defaultLocale, path),
    };
  }
  return ctx;
}
