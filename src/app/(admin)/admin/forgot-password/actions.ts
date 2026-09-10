"use server";

import { getServerSupabase } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export interface ForgotState {
  readonly sent: boolean;
  readonly error: string | null;
}

/**
 * Ask Supabase to email a link that lets somebody set a password.
 *
 * IT ALWAYS SAYS THE SAME THING. Whether the address belongs to an account, to
 * a switched-off account, or to nobody at all, the answer is "if that address
 * has an account, a link is on its way". Anything else turns this form into a
 * way of discovering which email addresses work here, which is worth more to a
 * stranger than it sounds.
 *
 * A server action rather than a browser call, deliberately: `@supabase/ssr`
 * stores the PKCE code verifier as a cookie when the flow starts, and starting
 * it on the server means that cookie is HttpOnly. The link then comes back to
 * `/admin/auth/callback`, which is the only place able to exchange it.
 */
export async function requestPasswordLinkAction(
  _previous: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) return { sent: false, error: "Type the email address you use for Jojo Usafi." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { sent: false, error: "That is not an email address." };
  }

  const supabase = await getServerSupabase();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site.url}/admin/auth/callback`,
  });

  // Rate limiting is the one failure worth saying out loud: it is temporary,
  // it is the person's own doing, and waiting is the fix.
  if (error && /rate limit|too many|for security purposes/i.test(error.message)) {
    return { sent: false, error: "Too many requests. Wait a minute and try again." };
  }

  // Every other failure — including "no such user" — is answered as success.
  return { sent: true, error: null };
}
