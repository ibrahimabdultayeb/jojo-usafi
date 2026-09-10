import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { AuthPanel } from "../AuthPanel";

export const metadata: Metadata = { title: "Set a password" };

/** Reads the query string and writes a cookie, so it is never prerendered. */
export const dynamic = "force-dynamic";

/**
 * How somebody who cannot sign in gets in.
 *
 * Two audiences, one screen, deliberately. Somebody who has forgotten a
 * password and somebody who has just been added to the shop and never had one
 * both need exactly the same thing — an email with a link in it — and giving
 * them two screens to choose between would be asking them to know the
 * difference between "reset" and "set", which is our vocabulary and not theirs.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { problem } = await searchParams;

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

  return (
    <AuthPanel
      title="Set a password"
      subtitle="New here, or forgotten yours? Both work the same way."
    >
      <ForgotPasswordForm problem={problem} />

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/admin/sign-in" className="font-bold text-slate-700 underline">
          Back to sign in
        </Link>
      </p>
    </AuthPanel>
  );
}
