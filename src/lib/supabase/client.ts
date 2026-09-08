/**
 * The browser Supabase client.
 *
 * Used by client components — the cart, the checkout form, anything that reads
 * or writes as the person sitting in front of the browser. It carries the anon
 * key, which is public by design; Row Level Security is what decides what that
 * key can actually see.
 *
 * NOT USED YET. No Supabase project exists; the storefront still reads the
 * committed catalogue artifact through `src/lib/catalogue/queries.ts`.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv } from "./env";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

/**
 * One client per browser tab. `createBrowserClient` is safe to call repeatedly,
 * but a single instance keeps one auth listener and one realtime socket rather
 * than one per component that asks.
 */
export function getBrowserSupabase(): SupabaseClient<Database> {
  if (cached) return cached;
  const env = readPublicEnv();
  cached = createBrowserClient<Database>(env.url, env.anonKey);
  return cached;
}
