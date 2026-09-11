import type { MetadataRoute } from "next";
import { getPublicSupabase } from "@/lib/supabase/public";
import { isStaging } from "@/lib/environment";
import { site } from "@/lib/site";

/**
 * What a search engine should look at, once there is a shop to look at.
 *
 * WHAT IS IN IT: the homepage, the shop, the contact page, and one page per
 * PUBLISHED product — in both languages, each pair cross-referencing the other
 * with `alternates.languages`, so Google is told these are the same page in two
 * languages rather than two pages competing.
 *
 * WHAT IS DELIBERATELY NOT IN IT, and why each one:
 *
 *   /admin            the back office; also carries an `X-Robots-Tag`
 *   /cart /checkout   personal and transient — a crawler indexing a checkout
 *                     helps nobody and wastes the crawl budget
 *   /track-order      a lookup form whose results are private by construction
 *   /api/*            machines only
 *   withheld products `product_shelf` IS the definition of public, so a product
 *                     that is not on it is not in here either. There is no
 *                     second list to drift.
 *
 * ON STAGING IT IS EMPTY. `robots.txt` already disallows everything and the
 * pages carry `noindex`, but a sitemap is a positive invitation and shipping a
 * populated one from a staging host would be handing out the addresses of a
 * shop that is not open. Empty, rather than absent, so the route is exercised by
 * the same code path production will use.
 */

/** Ten minutes. The shelf itself is cached for five. */
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isStaging()) return [];

  const base = site.url.replace(/\/$/, "");

  /** One entry, with its other language pointed at from inside it. */
  const bothLanguages = (path: string, lastModified?: Date): MetadataRoute.Sitemap => {
    const english = `${base}${path}`;
    const kiswahili = `${base}/sw${path === "/" ? "" : path}`;
    const languages = { en: english, sw: kiswahili };

    return [
      { url: english, lastModified, alternates: { languages } },
      { url: kiswahili, lastModified, alternates: { languages } },
    ];
  };

  const pages: MetadataRoute.Sitemap = [
    ...bothLanguages("/"),
    ...bothLanguages("/shop"),
    ...bothLanguages("/contact"),
  ];

  // `product_shelf` decides what is public. Reading anything else here would be
  // a second definition of "published" that could disagree with the storefront.
  const { data, error } = await getPublicSupabase()
    .from("product_shelf")
    .select("slug")
    .order("sku");

  if (error || !data) return pages;

  for (const row of data) {
    if (row.slug) pages.push(...bothLanguages(`/product/${row.slug}`));
  }

  return pages;
}
