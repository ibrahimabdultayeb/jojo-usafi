/**
 * Localized catalogue content.
 *
 * Interface copy lives in `src/lib/i18n/dictionaries` and always exists in both
 * languages — the i18n parity check enforces that. Catalogue content is
 * different: the Product Master is English-only, so a Kiswahili product name
 * exists only when somebody has actually written one.
 *
 * The rule is therefore FALL BACK, NEVER INVENT. A missing translation shows
 * the English text; it never shows a machine-translated guess and never shows
 * an empty product name.
 */

import { z } from "zod";
import { locales, defaultLocale, type Locale } from "@/lib/i18n/config";
import { err, ok, type Result } from "./result";

export const localeSchema = z.enum(locales);

export function parseLocale(input: unknown): Result<Locale> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return err("invalid_locale", "That is not a language this store speaks.");
  return ok(parsed.data);
}

export const productContentSchema = z.object({
  locale: localeSchema,
  name: z
    .string({ message: "A product needs a name." })
    .trim()
    .min(2, { message: "A product needs a name." })
    .max(160, { message: "That product name is too long for a product card." }),
  description: z.string().trim().max(2000).nullable().default(null),
  usageNotes: z.string().trim().max(2000).nullable().default(null),
});

export type ProductContentInput = z.infer<typeof productContentSchema>;

export const categoryContentSchema = z.object({
  locale: localeSchema,
  name: z.string().trim().min(2, { message: "A category needs a name." }).max(80),
  blurb: z.string().trim().max(240).nullable().default(null),
});

export type CategoryContentInput = z.infer<typeof categoryContentSchema>;

export function parseProductContent(input: unknown): Result<ProductContentInput> {
  const parsed = productContentSchema.safeParse(input);
  if (!parsed.success) {
    return err("invalid_locale", parsed.error.issues[0]?.message ?? "That product content is not valid.");
  }
  return ok(parsed.data);
}

/**
 * Pick the row to show: the requested language if it exists, otherwise English.
 * Returns null only when there is no content at all, which is a catalogue
 * problem for the validation report rather than something to paper over.
 */
export function resolveContent<T extends { locale: Locale }>(
  rows: readonly T[],
  locale: Locale,
): T | null {
  return rows.find((row) => row.locale === locale)
    ?? rows.find((row) => row.locale === defaultLocale)
    ?? null;
}

/** Which languages this row is still missing. Feeds the catalogue report. */
export function missingLocales(rows: readonly { locale: Locale }[]): Locale[] {
  const present = new Set(rows.map((row) => row.locale));
  return locales.filter((locale) => !present.has(locale));
}
