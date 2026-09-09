import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type { AdminProfileRow } from "@/lib/supabase/types";

/**
 * Who is signed in to the admin dashboard, and what may they do.
 *
 * Everything here reads through the caller's OWN session — the anon key plus
 * their cookies — so Row Level Security answers every question. The
 * service-role client is deliberately not imported: if this file could bypass
 * RLS, then a bug here would be a hole rather than an empty screen.
 *
 * The three states are different and the dashboard must tell them apart:
 *
 *   null                    nobody is signed in            → the sign-in page
 *   { profile: null }       signed in, but not staff       → "no access", plainly
 *   { profile: {...} }      signed in staff                → the dashboard
 *
 * The middle one is not an error. A customer who later has an account is a
 * perfectly ordinary signed-in person with no business in the back office.
 */

export interface AdminSession {
  readonly userId: string;
  readonly email: string | null;
  /** Null when the signed-in account has no staff profile, or was deactivated. */
  readonly profile: AdminProfileRow | null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await getServerSupabase();

  // `getUser()` verifies the token with Supabase rather than trusting the
  // cookie's own claims, which is the difference that matters on the server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // `admin_profiles_self_read` is what lets this succeed, and it deliberately
  // does not require the profile to be active — a deactivated staff member must
  // still be able to read the row that says they are deactivated, so the
  // dashboard can say so instead of showing an empty screen.
  const { data } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { userId: user.id, email: user.email ?? null, profile: data ?? null };
}

/**
 * Has anybody taken the Owner seat yet?
 *
 * Answerable before signing in — `jojo_owner_exists()` is granted to `anon` for
 * exactly this reason — because the setup screen has to choose between "claim
 * the Owner account" and "sign in" while nobody is signed in. It reveals whether
 * an Owner exists and never who.
 */
export async function ownerExists(): Promise<boolean> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("jojo_owner_exists");
  if (error) throw new Error(`Could not reach Supabase: ${error.message}`);
  return data === true;
}

/** A staff member is only staff while their profile is active. */
export function isActiveStaff(session: AdminSession | null): boolean {
  return Boolean(session?.profile?.active);
}
