import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/environment";

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

  // No `sitemap:` line: this shop has no sitemap route yet, and pointing a
  // crawler at a 404 is worse than saying nothing. It is on the launch list.
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }] };
}
