"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signInAction, type SignInState } from "./actions";

/**
 * Mobile first, and sized for a shop rather than a desk: 48px inputs and a
 * full-width primary button, both comfortably above the 44px touch target the
 * QA gate enforces. Nothing here is clever — a person signing in on a phone
 * with one hand wants two fields and one button.
 */

const INPUT =
  "min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-qa-anchor="admin-sign-in-submit"
      className="min-h-12 w-full rounded-full bg-slate-900 px-6 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, { error: null });

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
        <label htmlFor="email" className="block text-sm font-bold text-slate-900">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={INPUT}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-bold text-slate-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={INPUT}
        />
      </div>

      <SubmitButton />

      {/*
        Below the button, not beside the password field. Somebody who knows
        their password should reach the button first; somebody who does not
        will look past it. It says "Set" rather than "Reset" because a person
        who has just been added to the shop never had one to reset.
      */}
      <p className="pt-1 text-center text-sm text-slate-500">
        <Link href="/admin/forgot-password" className="font-bold text-slate-700 underline">
          Set or reset your password
        </Link>
      </p>
    </form>
  );
}
