/**
 * The browser Supabase client.
 *
 * Used by client components — the cart, the checkout form, anything that reads
 * or writes as the person sitting in front of the browser. It carries the anon
 * key, which is public by design; Row Level Security is what decides what that
 * key can actually see.
 *
 * IN USE BY ONE SCREEN, AND FOR A SPECIFIC REASON. `/admin/set-password`
 * needs it, because an invitation link delivers its session in the URL
 * **fragment** — which is never sent to a server, so no server component or
 * action can ever see it. `createBrowserClient` reads that fragment and writes
 * the session to cookies, which is what lets the rest of the dashboard, all of
 * which reads on the server, work afterwards.
 *
 * Everywhere else still signs in through a server action, so the access token
 * is never handed to JavaScript running in the page.
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
