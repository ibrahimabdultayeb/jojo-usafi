import "server-only";

import { getAdminSession, isActiveStaff, type AdminSession } from "./session";
import { can, type Capability, type Role } from "./permissions";

/**
 * The gate every admin write goes through.
 *
 * Three questions, in order, and the order matters:
 *
 *   1. is anybody signed in?          → no: send them to sign in
 *   2. are they ACTIVE staff?         → no: say so plainly, do not pretend
 *   3. does their role allow this?    → no: refuse by name
 *
 * WHY THIS IS NOT THE ONLY CHECK. Everything here is a courtesy to the person
 * using the dashboard: it decides what to draw and gives a sentence instead of
 * a stack trace. The real boundary is Row Level Security, and the operations
 * that need the service-role key are reachable only from server actions that
 * have already passed through here. A request that skipped the dashboard
 * entirely still meets the database's own answer.
 *
 * `can()` is the same frozen matrix `src/lib/admin/permissions.ts` uses to
 * decide which buttons exist, so a button that is drawn and an action that is
 * allowed cannot drift apart.
 */

export interface Authorized {
  readonly session: AdminSession;
  readonly adminId: string;
  readonly role: Role;
  readonly name: string;
}

export type AuthorizeResult =
  | { ok: true; staff: Authorized }
  | { ok: false; reason: "signed_out" | "not_staff" | "forbidden"; message: string };

export async function authorize(capability: Capability): Promise<AuthorizeResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, reason: "signed_out", message: "Please sign in again." };
  }

  if (!isActiveStaff(session)) {
    return {
      ok: false,
      reason: "not_staff",
      message: session.profile
        ? "Your account has been switched off. Ask the Owner to switch it back on."
        : "This account is not a Jojo Usafi staff account.",
    };
  }

  const profile = session.profile!;
  const role = profile.role as Role;

  if (!can(role, capability)) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Your account cannot do that. Ask the Owner or a Manager.",
    };
  }

  return {
    ok: true,
    staff: { session, adminId: profile.id, role, name: profile.full_name },
  };
}

/** For read paths that only need to know whether to render a control. */
export async function currentStaff(): Promise<Authorized | null> {
  const session = await getAdminSession();
  if (!isActiveStaff(session) || !session?.profile) return null;
  return {
    session,
    adminId: session.profile.id,
    role: session.profile.role as Role,
    name: session.profile.full_name,
  };
}
