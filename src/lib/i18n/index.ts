import { defaultLocale, locales, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { sw } from "./dictionaries/sw";

export * from "./config";
export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { en, sw };

/**
 * The copy for one language. Server components take the locale from their route
 * segment; client components take it from `useLocale()`.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/**
 * Fills `{name}` placeholders in a dictionary string.
 *
 *   fill(t.hero.body, { area: site.serviceArea })
 *
 * A placeholder with no matching value is left alone rather than blanked, so a
 * mistake shows up loudly in QA instead of silently deleting copy.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * The same piece of copy in every language Jojo Usafi speaks.
 *
 *   localeVariants((t) => t.nav.shop)   →   ["Shop All", "Bidhaa Zote"]
 *
 * This exists so the interface can reserve room for the longest translation
 * instead of resizing around whichever one is on screen — see `StableText`.
 * Taking a picker rather than a key string keeps it type-checked: a renamed
 * dictionary key is a compile error here rather than a silently empty slot.
 *
 * Duplicates are dropped, so a string that is identical in both languages
 * reserves its own width once and nothing more.
 */
export function localeVariants(pick: (t: Dictionary) => string): string[] {
  const seen = new Set<string>();
  for (const locale of locales) seen.add(pick(dictionaries[locale]));
  return [...seen];
}
