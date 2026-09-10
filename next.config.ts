import type { NextConfig } from "next";

/**
 * Response headers, applied to every route.
 *
 * Chosen to be the ones that are unambiguously right for a shop and cannot
 * break it. There is deliberately NO Content-Security-Policy here yet: this
 * application loads product photography from Supabase Storage, talks to a
 * Supabase project over XHR and websockets, and serves two Google fonts, so a
 * CSP written without measuring those origins would break images, sign-in or
 * both — and a broken CSP is usually discovered by a customer. It is written
 * down as final-hardening work in `docs/STAGING.md` instead of shipped blind.
 *
 * `Strict-Transport-Security` carries no `preload`. Preloading is a commitment
 * made on behalf of a domain that has not been chosen yet, and it is difficult
 * to undo.
 */
const SECURITY_HEADERS = [
  // No part of this application is meant to be framed by anybody.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Nothing here uses a camera, a microphone, a location or a payment API.
    // Saying so is free, and it means an injected script cannot ask either.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    /**
     * Product photography lives in Supabase Storage, already square, white
     * background and 800px WebP — processed deterministically by
     * `scripts/build-catalogue.mjs` before it was uploaded. Re-encoding it at
     * request time would add a runtime dependency and change nothing, so the
     * built-in optimiser is off and the stored asset is served as-is. This also
     * means no `remotePatterns` allow-list is required for it.
     */
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // The dashboard is never a search result, on any deployment. This is
        // separate from the staging-wide rule in `src/app/robots.ts`, because
        // it must survive the day this shop becomes production.
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
