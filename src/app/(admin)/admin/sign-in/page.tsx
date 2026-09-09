import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAdminSession, isActiveStaff, ownerExists } from "@/lib/admin/session";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { SignInForm } from "./SignInForm";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

/** Reads cookies and the database, so it is never prerendered. */
export const dynamic = "force-dynamic";

export default async function AdminSignInPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Panel title="Not connected yet">
        <p className="text-sm text-slate-600">
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
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-bold text-slate-900">{session.profile!.full_name}</span> —{" "}
          {ROLE_LABELS[session.profile!.role]}.
        </p>
        <Link
          href="/admin"
          className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-base font-bold text-white"
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
        <p className="text-sm text-slate-600">
          {deactivated
            ? "Your Jojo Usafi account has been switched off. Ask the Owner to switch it back on."
            : "This account is signed in, but it is not a Jojo Usafi staff account. Ask the Owner to add you."}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Signed in as <span className="font-semibold text-slate-700">{session.email}</span>.
        </p>
        {!hasOwner && (
          <Link
            href="/admin/setup"
            className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-brand-600 px-6 text-base font-bold text-white"
          >
            Set up the Owner account
          </Link>
        )}
        <SignOutButton />
      </Panel>
    );
  }

  return (
    <Panel title="Jojo Usafi admin" subtitle="Sign in to manage orders, products and customers.">
      <SignInForm />
      {!hasOwner && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
      <button
        type="submit"
        className="min-h-12 w-full rounded-full border border-slate-300 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-100"
      >
        Sign out
      </button>
    </form>
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
        {subtitle && <p className="mt-1.5 mb-6 text-sm text-slate-600">{subtitle}</p>}
        {!subtitle && <div className="mb-5" />}
        {children}
      </div>
    </main>
  );
}
