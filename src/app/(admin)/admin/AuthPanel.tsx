import type { ReactNode } from "react";

/**
 * The card every signed-out admin screen sits in.
 *
 * Sign in, set a password, and claim the Owner seat are three different jobs
 * that a person meets in sequence, often within a minute of each other. They
 * were three separate copies of this markup until Build 11 added the third and
 * fourth; one component is how they stay the same card rather than drifting
 * into three that almost match.
 *
 * Centred, one column, `max-w-md`: this is read on a phone far more often than
 * on a desk.
 */
export function AuthPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
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
