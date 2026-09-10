import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { Locale } from "@/lib/i18n";

/**
 * The homepage words and switches the Owner controls, as the storefront reads them.
 *
 * THE RULE, ONCE, HERE: a blank field is an ABSENCE OF AN INSTRUCTION, not an
 * instruction to say nothing. Every text field is an OVERRIDE of the designed,
 * translated copy in `src/lib/i18n`, so clearing a box restores that copy
 * rather than emptying the homepage. Two consequences follow, and both are
 * deliberate:
 *
 *   - A shop that has never opened the settings screen looks exactly as it
 *     does today. Wiring the screen up cannot regress the approved design.
 *   - Turning something OFF is a switch, never an empty box. That is what
 *     `showAnnouncement`, `promoBannerVisible` and the eight section flags are
 *     for, and why migration 0022 exists.
 *
 * LANGUAGE. A Kiswahili override is used on the Kiswahili site; when it is
 * blank the English override is used; when that is blank too, the dictionary
 * answers in the right language. So a shop that writes only English gets
 * English everywhere it typed and Kiswahili everywhere it did not — never a
 * machine translation, and never a blank.
 *
 * COST. One query, cached for five minutes under the same `catalogue` tag the
 * shelf uses, so saving on the settings screen drops both at once and the
 * homepage is correct immediately. A visitor costs nothing.
 */

export interface SectionFlags {
  readonly categories: boolean;
  readonly bestSellers: boolean;
  readonly featured: boolean;
  readonly categoryGrids: boolean;
  readonly trust: boolean;
  readonly deliveryBanner: boolean;
  readonly brands: boolean;
  readonly howItWorks: boolean;
}

export interface SiteContent {
  /** Null everywhere means "the website's own wording" — never "say nothing". */
  readonly announcement: string | null;
  readonly showAnnouncement: boolean;
  readonly heroHeading: string | null;
  readonly heroSub: string | null;
  readonly heroCtaLabel: string | null;
  readonly heroCtaHref: string | null;
  readonly promo: string | null;
  readonly showPromo: boolean;
  readonly sections: SectionFlags;
  readonly categoryOrder: readonly string[] | null;
}

/** What the site does when the row cannot be read: exactly what it does today. */
export const DEFAULT_CONTENT: SiteContent = {
  announcement: null,
  showAnnouncement: true,
  heroHeading: null,
  heroSub: null,
  heroCtaLabel: null,
  heroCtaHref: null,
  promo: null,
  showPromo: false,
  sections: {
    categories: true,
    bestSellers: true,
    featured: true,
    categoryGrids: true,
    trust: true,
    deliveryBanner: true,
    brands: true,
    howItWorks: true,
  },
  categoryOrder: null,
};

const REVALIDATE_SECONDS = 300;

const SELECT = `
  announcement_en, announcement_sw, show_announcement,
  hero_heading_en, hero_heading_sw, hero_sub_en, hero_sub_sw,
  hero_cta_label_en, hero_cta_label_sw, hero_cta_href,
  promo_banner_en, promo_banner_sw, promo_banner_visible,
  show_categories, show_best_sellers, show_featured, show_category_grids,
  show_trust, show_delivery_banner, show_brands, show_how_it_works,
  category_order
`;

export interface RawContent {
  announcement_en: string | null;
  announcement_sw: string | null;
  show_announcement: boolean;
  hero_heading_en: string | null;
  hero_heading_sw: string | null;
  hero_sub_en: string | null;
  hero_sub_sw: string | null;
  hero_cta_label_en: string | null;
  hero_cta_label_sw: string | null;
  hero_cta_href: string | null;
  promo_banner_en: string | null;
  promo_banner_sw: string | null;
  promo_banner_visible: boolean;
  show_categories: boolean;
  show_best_sellers: boolean;
  show_featured: boolean;
  show_category_grids: boolean;
  show_trust: boolean;
  show_delivery_banner: boolean;
  show_brands: boolean;
  show_how_it_works: boolean;
  category_order: string[] | null;
}

/**
 * One row, cached across visitors. Read with the public client rather than the
 * caller's session: `shop_settings` is publicly readable by policy, and a
 * cookie-bound client cannot live inside `unstable_cache`.
 */
const loadContent = unstable_cache(
  async (): Promise<RawContent | null> => {
    const { data, error } = await getPublicSupabase()
      .from("shop_settings")
      .select(SELECT)
      .eq("id", true)
      .maybeSingle();

    // A settings row that cannot be read must not take the shop down with it.
    // The caller falls back to the designed copy, which is a working homepage.
    if (error || !data) return null;
    return data as RawContent;
  },
  ["site-content"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalogue"] },
);

/** Blank is blank whether it is null, empty or spaces. */
const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Kiswahili if it was written, else English if it was, else the dictionary. */
const pick = (locale: Locale, en: string | null, sw: string | null): string | null =>
  locale === "sw" ? (text(sw) ?? text(en)) : text(en);

/**
 * The whole rule, as one pure function, so it can be proved without a database.
 * `getSiteContent` is this plus a cached read.
 */
export function resolveContent(row: RawContent | null, locale: Locale): SiteContent {
  if (!row) return DEFAULT_CONTENT;

  return {
    announcement: pick(locale, row.announcement_en, row.announcement_sw),
    showAnnouncement: row.show_announcement,
    heroHeading: pick(locale, row.hero_heading_en, row.hero_heading_sw),
    heroSub: pick(locale, row.hero_sub_en, row.hero_sub_sw),
    heroCtaLabel: pick(locale, row.hero_cta_label_en, row.hero_cta_label_sw),
    heroCtaHref: text(row.hero_cta_href),
    promo: pick(locale, row.promo_banner_en, row.promo_banner_sw),
    showPromo: row.promo_banner_visible,
    sections: {
      categories: row.show_categories,
      bestSellers: row.show_best_sellers,
      featured: row.show_featured,
      categoryGrids: row.show_category_grids,
      trust: row.show_trust,
      deliveryBanner: row.show_delivery_banner,
      brands: row.show_brands,
      howItWorks: row.show_how_it_works,
    },
    categoryOrder: row.category_order,
  };
}

export async function getSiteContent(locale: Locale): Promise<SiteContent> {
  return resolveContent(await loadContent(), locale);
}
