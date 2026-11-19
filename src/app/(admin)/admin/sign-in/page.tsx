import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Metadata } from "next";
import Link from "@/components/ui/LoadingLink";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdminSession, isActiveStaff, ownerExists } from "@/lib/admin/session";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { SignInForm } from "./SignInForm";
import { signOutAction } from "./actions";
import { AuthPanel as Panel } from "../AuthPanel";

export const metadata: Metadata = { title: "Sign in" };

/** Reads cookies and the database, so it is never prerendered. */
export const dynamic = "force-dynamic";

export default async function AdminSignInPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Panel title="Not connected yet">
        <p className="admin-auth-copy">
          This copy of Jojo Usafi has no Supabase settings, so there is nothing to sign in to.
          Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{" "}
          <code className="rounded bg-slate-100 px-1">.env.local</code> and fill it in.
        </p>
      </Panel>
    );
  }

  const [session, hasOwner] = await Promise.all([getAdminSession(), ownerExists()]);

  if (session && isActiveStaff(session)) {
    return (
      <Panel title="You are signed in">
        <p className="admin-auth-copy">
          Signed in as <span className="font-bold text-slate-100">{session.profile!.full_name}</span> —{" "}
          {ROLE_LABELS[session.profile!.role]}.
        </p>
        <Link
          href="/admin"
          className="admin-auth-submit mt-5"
        >
          Go to the dashboard
        </Link>
        <SignOutButton />
      </Panel>
    );
  }

  // Signed in, but this account is not staff — or was staff and is not any more.
  if (session) {
    const deactivated = session.profile !== null && !session.profile.active;

    return (
      <Panel title={deactivated ? "This account is switched off" : "No access"}>
        <p className="admin-auth-copy">
          {deactivated
            ? "Your Jojo Usafi account has been switched off. Ask the Owner to switch it back on."
            : "This account is signed in, but it is not a Jojo Usafi staff account. Ask the Owner to add you."}
        </p>
        <p className="admin-auth-copy mt-3">
          Signed in as <span className="font-semibold text-slate-100">{session.email}</span>.
        </p>
        {!hasOwner && (
          <Link
            href="/admin/setup"
            className="admin-auth-submit mt-5"
          >
            Set up the Owner account
          </Link>
        )}
        <SignOutButton />
      </Panel>
    );
  }

  return (
    <Panel title="Welcome back" subtitle="Sign in with your Jojo Usafi staff account.">
      <SignInForm />
      {!hasOwner && (
        <p className="admin-auth-note admin-auth-warning mt-6">
          This shop has no Owner account yet.{" "}
          <Link href="/admin/setup" className="font-bold underline">
            Set up the Owner account
          </Link>
          .
        </p>
      )}
    </Panel>
  );
}

function SignOutButton() {
  return (
    <form action={signOutAction} className="mt-3">
      <SubmitButton
        type="submit"
        className="admin-auth-submit admin-auth-secondary"
      >
        Sign out
      </SubmitButton>
    </form>
  );
}
