/**
 * Jojo Usafi speaks English and Kiswahili.
 *
 * English is the default and lives at the bare path (`/shop`). Kiswahili is
 * prefixed (`/sw/shop`). Every customer-facing route exists in both languages,
 * so switching language never loses the page the shopper was on.
 *
 * Catalogue content — product names, pack sizes, categories — is owned by the
 * Product Master and exists in English only. It falls back to English rather
 * than being translated here, because inventing Kiswahili product copy would be
 * inventing catalogue data.
 */

export const locales = ["en", "sw"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** The URL segment each locale lives under. The default locale has none. */
export const localeSegment: Record<Locale, string> = {
  en: "",
  sw: "/sw",
};

/** BCP 47 tags for `<html lang>`, `hreflang` and `Intl`. */
export const localeTag: Record<Locale, string> = {
  en: "en",
  sw: "sw-TZ",
};

/** What each language calls itself, in itself. Never translated. */
export const localeName: Record<Locale, string> = {
  en: "English",
  sw: "Kiswahili",
};

export const localeShortName: Record<Locale, string> = {
  en: "EN",
  sw: "SW",
};

/** Remembered language preference. Read on first paint by the chooser. */
export const LOCALE_STORAGE_KEY = "jojo-usafi.locale.v1";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * `/shop` in the given language.
 *
 * `path` is always the canonical English-shaped route, so callers never have to
 * know which language they are in — `localePath("sw", "/cart")` is `/sw/cart`.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const segment = localeSegment[locale];
  if (!segment) return clean;
  return clean === "/" ? segment : `${segment}${clean}`;
}

/** The language a pathname belongs to. */
export function localeFromPathname(pathname: string): Locale {
  return pathname === "/sw" || pathname.startsWith("/sw/") ? "sw" : "en";
}

/** The same page with its language prefix removed: `/sw/cart` → `/cart`. */
export function stripLocale(pathname: string): string {
  if (pathname === "/sw") return "/";
  if (pathname.startsWith("/sw/")) return pathname.slice(3);
  return pathname || "/";
}

/**
 * Canonical and hreflang for one page, given its language-neutral path.
 * Search engines need every alternate plus an `x-default`.
 */
export function localeAlternates(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      en: localePath("en", path),
      "sw-TZ": localePath("sw", path),
      "x-default": localePath(defaultLocale, path),
    },
  };
}
