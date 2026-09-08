import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    /**
     * Product photography is pre-processed deterministically by
     * `scripts/build-catalogue.mjs` — square, white-background, 800px WebP,
     * committed to `public/products/`. Re-encoding it at request time would
     * add a runtime dependency and change nothing, so the built-in optimiser
     * is off and the committed asset is served as-is.
     */
    unoptimized: true,
  },
};

export default nextConfig;
