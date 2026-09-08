/**
 * The server Supabase client, acting AS THE VISITOR.
 *
 * Server components, route handlers and server actions use this. It carries the
 * anon key and the request's auth cookies, so every query runs under the
 * visitor's own Row Level Security policies — a shopper sees shelf products, a
 * signed-in manager sees orders, and neither is decided by the code that wrote
 * the query.
 *
 * For the privileged, RLS-bypassing client, see `admin.ts`. The two are
 * separate files on purpose: reaching for the powerful one has to be a
 * deliberate act with a different import.
 *
 * NOT USED YET. No Supabase project exists.
 */

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv } from "./env";
import type { Database } from "./types";

/**
 * Per-request, never cached: the cookie store belongs to one request, and a
 * client shared between requests would answer as the wrong person.
 */
export async function getServerSupabase(): Promise<SupabaseClient<Database>> {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A server component cannot set cookies. Refreshing the session is
          // middleware's job; a read here is still valid, so this is not an
          // error worth failing a page render over.
        }
      },
    },
  });
}
