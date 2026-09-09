import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdminSession, ownerExists } from "@/lib/admin/session";
import { ClaimOwnerForm } from "./ClaimOwnerForm";

export const metadata: Metadata = { title: "Set up the Owner account" };

/**
 * The one-time first-Owner screen.
 *
 * IT DISABLES ITSELF. The first thing it does is ask the database whether an
 * Owner already exists, and if one does there is no form on this page at all —
 * only a note saying the shop is already set up.
 *
 * That gate is deliberately a QUESTION ABOUT STATE rather than a deleted file
 * or a revoked privilege, because the answer differs per environment. This
 * development project has an Owner; a fresh production project will not, and it
 * will need exactly this screen on its first day. A migration that revoked the
 * bootstrap once it had been used here would arrive in production having
 * already disabled the thing production needs.
 *
 * The database is the other half of the same gate, and the stricter one:
 * `jojo_claim_first_owner` takes an advisory lock, re-checks for an Owner, and
 * raises for every caller once the seat is taken. Hiding this form is a
 * courtesy to whoever is looking at it; the function is what makes it true.
 */
export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Panel title="Not connected yet">
        <p className="text-sm text-slate-600">
          This copy of Jojo Usafi has no Supabase settings, so there is no shop to set up.
        </p>
      </Panel>
    );
  }

  const [hasOwner, session] = await Promise.all([ownerExists(), getAdminSession()]);

  if (hasOwner) {
    return (
      <Panel title="Already set up">
        <p className="text-sm text-slate-600">
          Jojo Usafi already has an Owner, so this screen has nothing left to do. New staff are
          added by the Owner from inside the dashboard.
        </p>
        <Link
          href="/admin/sign-in"
          className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-base font-bold text-white"
        >
          Sign in
        </Link>
      </Panel>
    );
  }

  if (!session) {
    return (
      <Panel title="Sign in first">
        <p className="text-sm text-slate-600">
          The Owner account is given to whoever is signed in, so sign in with the email address
          Jojo Usafi should be owned by — then come back here.
        </p>
        <Link
          href="/admin/sign-in"
          className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-base font-bold text-white"
        >
          Sign in
        </Link>
      </Panel>
    );
  }

  // A reasonable first guess, and nothing more — the Owner types their real
  // name over it. The email's local part is a poor name but a true one.
  const suggestedName = (session.email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();

  return (
    <Panel
      title="Set up the Owner account"
      subtitle="This happens once. The Owner can then add every other staff member."
    >
      <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        You are signed in as <span className="font-bold text-slate-900">{session.email}</span>.
        This is the account that will own the shop.
      </p>
      <ClaimOwnerForm suggestedName={suggestedName} />
    </Panel>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 mb-6 text-sm text-slate-600">{subtitle}</p>
        ) : (
          <div className="mb-5" />
        )}
        {children}
      </div>
    </main>
  );
}
