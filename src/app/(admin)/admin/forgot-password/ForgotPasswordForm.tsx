"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useFormStatus } from "react-dom";
import { requestPasswordLinkAction, type ForgotState } from "./actions";

/**
 * Two lines and one button, sized for a phone held in one hand — the same
 * shape as the sign-in form beside it, because somebody arrives here from
 * there and should not feel they have changed application.
 */

const INPUT = "admin-auth-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending} aria-busy={pending}
      className="admin-auth-submit"
    >
      {pending && <Spinner className="mr-2" />}
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
          className="admin-auth-note"
        >
          If that address has a Jojo Usafi account, a link is on its way. Open it on this phone or
          computer and you will be asked to choose a password.
        </p>
        <p className="admin-auth-copy">
          The link works once and stops working after an hour. If it does not arrive, check the
          spam folder and then ask for another.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="admin-auth-form">
      {/*
        Sent here by the callback when a link could not be honoured. It never
        says which of the four reasons applied — expired, already used, forged,
        mistyped — because telling somebody holding a stolen link how close they
        are is the one thing this screen must not do.
      */}
      {problem === "link" && (
        <p
          role="alert"
          className="admin-auth-note admin-auth-warning"
        >
          That link did not work. It may have been used already, or it may have expired. Ask for a
          new one below.
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="admin-auth-note admin-auth-error"
        >
          {state.error}
        </p>
      )}

      <div className="admin-auth-field">
        <label htmlFor="email" className="admin-auth-label">
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
