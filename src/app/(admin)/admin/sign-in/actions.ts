"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export interface SignInState {
  readonly error: string | null;
}

/**
 * Sign in to the admin dashboard.
 *
 * Uses the shared Supabase SSR client to establish the session and write
 * cookies through the server response. Cookie policy belongs to that client.
 *
 * Supabase's own messages are replaced with plain language. "Invalid login
 * credentials" is developer wording; somebody standing in a shop needs to be
 * told what to do about it. The replacement is deliberately the same for a
 * wrong email and a wrong password, because saying which one was wrong tells a
 * stranger which email addresses have accounts.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) return { error: "Type the email address you use for Jojo Usafi." };
  if (!password) return { error: "Type your password." };

  let error;
  try {
    const supabase = await getServerSupabase();
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    return { error: "Could not connect to sign in. Please try again." };
  }

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return {
        error:
          "This account has not been confirmed yet. Open the email Supabase sent you and follow the link, then try again.",
      };
    }
    if (/invalid login credentials/i.test(error.message)) {
      return { error: "That email address and password do not match an account." };
    }
    if (/rate limit|too many/i.test(error.message)) {
      return { error: "Too many attempts. Wait a minute and try again." };
    }
    return { error: "Could not sign in right now. Please try again." };
  }

  redirect("/admin");
}

/** Sign out and come back to the sign-in screen. */
export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/sign-in");
}
