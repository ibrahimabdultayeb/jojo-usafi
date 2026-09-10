"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordLinkAction, type ForgotState } from "./actions";

/**
 * Two lines and one button, sized for a phone held in one hand — the same
 * shape as the sign-in form beside it, because somebody arrives here from
 * there and should not feel they have changed application.
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
      className="min-h-12 w-full rounded-full bg-slate-900 px-6 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Email me a link"}
    </button>
  );
}

export function ForgotPasswordForm({ problem }: { problem?: string }) {
  const [state, formAction] = useActionState<ForgotState, FormData>(requestPasswordLinkAction, {
    sent: false,
    error: null,
  });

  if (state.sent) {
    return (
      <div className="space-y-3">
        <p
          role="status"
          className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900"
        >
          If that address has a Jojo Usafi account, a link is on its way. Open it on this phone or
          computer and you will be asked to choose a password.
        </p>
        <p className="text-sm text-slate-500">
          The link works once and stops working after an hour. If it does not arrive, check the
          spam folder and then ask for another.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/*
        Sent here by the callback when a link could not be honoured. It never
        says which of the four reasons applied — expired, already used, forged,
        mistyped — because telling somebody holding a stolen link how close they
        are is the one thing this screen must not do.
      */}
      {problem === "link" && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          That link did not work. It may have been used already, or it may have expired. Ask for a
          new one below.
        </p>
      )}

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

      <SubmitButton />
    </form>
  );
}
