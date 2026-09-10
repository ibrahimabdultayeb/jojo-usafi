import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdminSession } from "@/lib/admin/session";
import { SetPasswordForm } from "./SetPasswordForm";
import { AuthPanel } from "../AuthPanel";

export const metadata: Metadata = { title: "Choose a password" };

/** Reads cookies, and the answer changes per person. Never prerendered. */
export const dynamic = "force-dynamic";

/**
 * The end of an email link.
 *
 * Two ways to arrive, and the page has to work for both:
 *
 *   `/admin/auth/callback` exchanged a `?code=` and set a session cookie, so
 *   the server already knows who this is.
 *
 *   An invitation link put the session in the URL **fragment**, which never
 *   reaches a server — so as far as this component can tell, nobody is signed
 *   in, and the browser has to sort it out.
 *
 * The server therefore reports what it can see and lets the client decide. It
 * does NOT redirect a caller it cannot identify: doing so would throw away the
 * fragment, which is the only copy of the invitation's tokens that exists.
 */
export default async function SetPasswordPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AuthPanel title="Not connected yet">
        <p className="text-sm text-slate-600">
          This copy of Jojo Usafi has no Supabase settings, so there is no account to set a
          password for.
        </p>
      </AuthPanel>
    );
  }

  const session = await getAdminSession();

  return (
    <AuthPanel
      title="Choose a password"
      subtitle={
        session?.email
          ? `For ${session.email}. You will use it to sign in from now on.`
          : "You will use it to sign in from now on."
      }
    >
      <SetPasswordForm alreadySignedIn={session !== null} />
    </AuthPanel>
  );
}
