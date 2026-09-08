/**
 * Supabase access, in three deliberately separate pieces:
 *
 *   client.ts  the browser, as the visitor          — anon key, RLS applies
 *   server.ts  the server, as the visitor           — anon key, RLS applies
 *   admin.ts   the server, as nobody                — service role, RLS BYPASSED
 *
 * Only the types and the environment helpers are re-exported here. The clients
 * are not: `server.ts` and `admin.ts` are `server-only`, and re-exporting them
 * from a shared barrel would drag that restriction into every file that wanted
 * a type, or worse, quietly relax it.
 *
 * Import the client you mean, from the file that means it.
 */

export type * from "./types";
export { isSupabaseConfigured } from "./env";
