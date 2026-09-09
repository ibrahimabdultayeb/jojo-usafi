import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv } from "./env";
import type { Database } from "./types";

/**
 * The catalogue reader: Supabase as an anonymous shopper, with no session.
 *
 * `server.ts` is the right client when the answer depends on WHO is asking — it
 * carries the request's cookies, which makes every page that touches it
 * dynamic. The public catalogue does not depend on who is asking: the shelf is
 * the same for everyone, so reading it through a session client would buy
 * nothing and cost the ability to cache.
 *
 * It carries the anon key and therefore reads under exactly the policies a
 * shopper's browser would. That is the point: if a product reaches this client,
 * Row Level Security has already decided it is public — the storefront cannot
 * accidentally publish something the database considers hidden, because it has
 * no way to see it.
 */
let cached: SupabaseClient<Database> | null = null;

export function getPublicSupabase(): SupabaseClient<Database> {
  if (cached) return cached;
  const env = readPublicEnv();
  cached = createClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

/** The public URL of an object in a public bucket, built without a round trip. */
export function publicStorageUrl(bucket: string, path: string): string {
  const { url } = readPublicEnv();
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
