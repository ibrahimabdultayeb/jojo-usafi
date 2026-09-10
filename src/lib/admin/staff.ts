import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type { Role } from "./permissions";

/**
 * Who can use the dashboard.
 *
 * Read through the caller's session: `admin_profiles` is readable by staff and
 * writable only by an Owner, and that is a policy in the database rather than a
 * check in this file. An Order staff account that reached the Staff screen sees
 * the list and can change nothing — and would be refused by PostgreSQL if it
 * tried anyway.
 */

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly role: Role;
  readonly active: boolean;
  readonly hasLogin: boolean;
  readonly lastSeenAt: string | null;
  readonly createdAt: string;
  /** True for the only remaining active Owner: the account nobody may remove. */
  readonly isLastOwner: boolean;
}

export async function getStaff(): Promise<StaffMember[]> {
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id, full_name, email, role, active, auth_user_id, last_seen_at, created_at")
    .order("role")
    .order("full_name");

  if (error) return [];

  const activeOwners = (data ?? []).filter((row) => row.role === "owner" && row.active);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role as Role,
    active: row.active,
    // A profile with no login cannot sign in yet — it is an invitation that has
    // not been accepted, which is a different thing from a deactivated account.
    hasLogin: row.auth_user_id !== null,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    isLastOwner: activeOwners.length === 1 && activeOwners[0].id === row.id,
  }));
}
