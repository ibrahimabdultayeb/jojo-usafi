import type { NextConfig } from "next";

/**
 * The Content-Security-Policy, written from a MEASUREMENT rather than a guess.
 *
 * Build 12 drove a browser through the deployed storefront, cart, checkout,
 * Track Order, contact, the Kiswahili site and the sign-in screen, and recorded
 * every request it made. The whole inventory was:
 *
 *   documents    self
 *   stylesheets  self
 *   fonts        self          — `next/font` self-hosts them; nothing reaches
 *                                fonts.gstatic.com, which a guessed policy
 *                                would have allowed for no reason
 *   images       self + the Supabase Storage origin
 *   scripts      self + vercel.live  (the preview toolbar, staging only)
 *   fetch        self + the Supabase origin, for the browser auth client
 *
 * THE ONE COMPROMISE, AND EXACTLY WHY
 *
 * `script-src` carries `'unsafe-inline'`. The App Router emits inline scripts
 * carrying the flight payload on every page, and the usual answer — a per-request
 * nonce — cannot work here: the storefront is statically prerendered and served
 * from a cache, so there is no per-request anything to put a nonce in. Buying a
 * nonce would mean making 217 static pages dynamic, which trades a real
 * performance property for a partial XSS mitigation.
 *
 * What the rest of the policy still buys, and it is not nothing: `connect-src`
 * means an injected script cannot send what it steals anywhere, `object-src
 * 'none'` kills plugin-based vectors, `base-uri 'self'` stops a tag rewriting
 * every relative URL on the page, and `form-action 'self'` stops a form being
 * repointed at somebody else's server.
 *
 * Nonce-based CSP is written down as future work in `docs/LAUNCH_CHECKLIST.md`,
 * with its cost stated, rather than half-done here.
 */
function contentSecurityPolicy(): string {
  // Whatever project this deployment is pointed at — never hard-coded, so a
  // production project with a different ref needs no edit here.
  const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const supabaseSocket = supabase.replace(/^https:/, "wss:");

  // The Vercel preview toolbar. It exists on preview deployments only, so
  // production gets the tighter policy without it.
  const isProduction = process.env.APP_ENV === "production";
  const toolbar = isProduction ? [] : ["https://vercel.live"];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    // `data:` for the tiny inline placeholders Next emits; `blob:` so an admin
    // can see the photograph they just chose before it is uploaded.
    "img-src": ["'self'", "data:", "blob:", supabase].filter(Boolean),
    "font-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": ["'self'", "'unsafe-inline'", ...toolbar],
    /*
     * Nothing this shop shows lives in an iframe, so production gets `'none'`.
     *
     * Staging needs one exception, found by running the QA gate after the
     * policy was first enforced: the Vercel preview toolbar frames
     * `vercel.live`, and with no `frame-src` set the browser falls back to
     * `default-src 'self'` and blocks it — a console error on every page.
     * Harmless, but noise that would hide a real one.
     */
    "frame-src": toolbar.length > 0 ? toolbar : ["'none'"],
    "connect-src": ["'self'", supabase, supabaseSocket, ...toolbar].filter(Boolean),
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

/**
 * Response headers, applied to every route.
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
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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
