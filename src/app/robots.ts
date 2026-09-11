import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/environment";
import { site } from "@/lib/site";

/** No trailing slash, so the sitemap URL below never doubles one. */
const SITE_BASE = site.url.replace(/\/+$/, "");

/**
 * What a search engine may look at.
 *
 * ON STAGING, NOTHING. A staging shop carries unconfirmed prices, development
 * orders and a catalogue that is still being decided; indexed, it competes with
 * the real shop for its own name and shows customers figures nobody has agreed
 * to. `Disallow: /` is paired with the `noindex` in the page metadata, because
 * robots.txt asks a crawler not to *fetch* a page while `noindex` tells it not
 * to *list* one — a page linked from elsewhere can be listed without ever being
 * fetched, so neither is sufficient alone.
 *
 * ON PRODUCTION, everything except the dashboard, which is additionally covered
 * by an `X-Robots-Tag` header in `next.config.ts` so the rule survives a
 * robots.txt somebody edits later.
 *
 * `APP_ENV` decides which of the two applies. Unset means staging — see
 * `src/lib/environment.ts` for why the default falls that way.
 */
export default function robots(): MetadataRoute.Robots {
  if (isStaging()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  /*
   * The private routes, by name.
   *
   * `/admin` is also covered by an `X-Robots-Tag` header in `next.config.ts`,
   * deliberately: this file can be edited, and a rule that only lives in a text
   * file a crawler may choose to ignore is not a boundary.
   *
   * `/cart`, `/checkout` and `/track-order` are excluded because they are
   * personal and transient. A crawler indexing an empty checkout helps nobody
   * and spends the crawl budget that the 95 product pages need.
   */
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/cart", "/checkout", "/track-order", "/sw/cart", "/sw/checkout", "/sw/track-order"],
      },
    ],
    sitemap: `${SITE_BASE}/sitemap.xml`,
  };
}
