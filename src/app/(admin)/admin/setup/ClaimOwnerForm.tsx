"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { claimOwnerAction, type ClaimState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-full bg-brand-600 px-6 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Setting up…" : "Make this the Owner account"}
    </button>
  );
}

export function ClaimOwnerForm({ suggestedName }: { suggestedName: string }) {
  const [state, formAction] = useActionState<ClaimState, FormData>(claimOwnerAction, {
    error: null,
    claimed: null,
  });

  if (state.claimed) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
          Done. <span className="font-bold">{state.claimed.fullName}</span> is now the{" "}
          {ROLE_LABELS[state.claimed.role]} of Jojo Usafi.
        </p>
        <p className="text-sm text-slate-600">
          Every other staff account is added from inside the dashboard. This setup screen is
          finished and will not appear again.
        </p>
        <Link
          href="/admin"
          className="flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-base font-bold text-white"
        >
          Go to the dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="fullName" className="block text-sm font-bold text-slate-900">
          Your full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={suggestedName}
          autoComplete="name"
          className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />
        <p className="text-xs text-slate-500">
          This is the name that appears beside everything you do in the shop&rsquo;s records.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
