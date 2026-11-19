"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "@/components/ui/LoadingLink";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { signInAction, type SignInState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      data-qa-anchor="admin-sign-in-submit" className="admin-auth-submit">
      {pending && <Spinner />}
      {pending ? "Signing in…" : "Open your workspace"}
      {!pending && <Icon name="arrowRight" />}
    </button>
  );
}

export function SignInForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, { error: null });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <form action={formAction} className="admin-auth-form">
        {state.error && <p role="alert" className="admin-auth-note admin-auth-error">{state.error}</p>}
        <div className="admin-auth-field">
          <label htmlFor="email" className="admin-auth-label">Email address</label>
          <input id="email" name="email" type="email" autoComplete="username" inputMode="email"
            autoCapitalize="none" spellCheck={false} required className="admin-auth-input" />
        </div>
        <div className="admin-auth-field">
          <label htmlFor="password" className="admin-auth-label">Password</label>
          <div className="admin-auth-password">
            <input id="password" name="password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" required className="admin-auth-input" />
            <button type="button" className="admin-auth-reveal" aria-controls="password"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </div>
        </div>
        <Link href="/admin/forgot-password" className="admin-auth-link admin-auth-forgot">Forgot password?</Link>
        <SubmitButton />
      </form>
      <p className="admin-auth-help">Need access? Ask the Owner to add you as a staff member.<br />Your workspace password is separate from your email password.</p>
    </>
  );
}
