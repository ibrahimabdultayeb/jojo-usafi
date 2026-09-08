/**
 * THE PRIVILEGED CLIENT. Read this comment before using it.
 *
 * This client carries the service-role key. It BYPASSES ROW LEVEL SECURITY
 * COMPLETELY: it can read every customer's phone number and rewrite any order,
 * and no policy will stop it. It is the one place in Jojo Usafi where the
 * authorization boundary does not apply.
 *
 * `import "server-only"` below makes importing this file from a client
 * component a build error rather than a leak.
 *
 * Use it ONLY where there is no user to act as:
 *
 *   - the Google Sheet synchronisation worker
 *   - scheduled maintenance and reconciliation jobs
 *   - one-off administrative scripts
 *
 * Never use it to "fix" a query that RLS refused. That refusal is the system
 * working; the answer is a policy, not a bigger key.
 *
 * Every write made through this client MUST also write an `audit_events` row
 * saying who asked for it and why, because nothing else is watching.
 *
 * NOT USED YET. No Supabase project and no service-role key exist.
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv, readServiceRoleKey } from "./env";
import type { Database } from "./types";

export function getServiceRoleSupabase(): SupabaseClient<Database> {
  const env = readPublicEnv();
  const serviceRoleKey = readServiceRoleKey();

  return createClient<Database>(env.url, serviceRoleKey, {
    auth: {
      // There is no user and no browser here. Persisting or refreshing a
      // session would be meaningless, and writing one to disk in a serverless
      // function would be a hazard.
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        // Makes privileged traffic identifiable in the Supabase logs.
        "x-jojo-usafi-client": "service-role",
      },
    },
  });
}
