import { defaultLocale, type Locale } from "./config";
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
