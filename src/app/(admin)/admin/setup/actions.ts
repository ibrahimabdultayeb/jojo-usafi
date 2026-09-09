"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import type { AdminRoleValue } from "@/lib/supabase/types";

export interface ClaimState {
  readonly error: string | null;
  readonly claimed: { readonly fullName: string; readonly role: AdminRoleValue } | null;
}

/**
 * Claim the Owner seat for the signed-in account.
 *
 * This does almost nothing, on purpose. It reads a name from a form and hands
 * it to `public.jojo_claim_first_owner`, which is where every rule actually
 * lives: the account must be signed in, no active Owner may already exist, an
 * advisory lock stops two simultaneous callers both succeeding, and an
 * `audit_events` row records that it happened.
 *
 * Putting those rules here instead would put them in one caller. In the
 * database they hold for every caller — this form, a script, psql, or a
 * `curl` at the REST endpoint.
 *
 * Note what is NOT here: the service-role client. The claim runs under the
 * caller's own session, so `auth.uid()` is the account being made Owner and
 * cannot be anybody else.
 */
export async function claimOwnerAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!fullName) {
    return { error: "Type your full name, so the shop knows who the Owner is.", claimed: null };
  }

  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "You are not signed in any more. Sign in and try again.",
      claimed: null,
    };
  }

  const { data, error } = await supabase.rpc("jojo_claim_first_owner", {
    p_full_name: fullName,
  });

  if (error) {
    // The database's own messages are already written for a person — "Jojo
    // Usafi already has an Owner. Ask the Owner to add you as staff instead."
    // — so they are shown as they are rather than translated twice.
    return { error: error.message, claimed: null };
  }

  if (!data) {
    return { error: "The Owner account was not created. Try again.", claimed: null };
  }

  return { error: null, claimed: { fullName: data.full_name, role: data.role } };
}
