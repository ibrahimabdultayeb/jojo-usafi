import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Where an email link lands.
 *
 * Supabase sends three kinds of link to a staff member — an invitation, a
 * password reset, and an email-change confirmation — and until Build 11 nothing
 * in this application answered any of them. A person followed the link, arrived
 * at the storefront homepage, and nothing happened.
 *
 * THE TWO SHAPES, AND WHY BOTH EXIST
 *
 * `?code=…` is the PKCE shape. It appears when the flow was STARTED in this
 * browser — the forgot-password form does that — because the matching code
 * verifier is sitting in a cookie that only this browser has. It is exchanged
 * here, server side, and the session is written as an HttpOnly cookie.
 *
 * `?token_hash=…&type=…` is the shape an ADMIN-generated link takes when the
 * email template is pointed here directly. There is no PKCE verifier for an
 * invitation, because the person accepting it is not the person who sent it, so
 * the token is verified instead of exchanged.
 *
 * There is a third shape this route deliberately cannot handle: tokens in the
 * URL **fragment**, which is what Supabase's default invitation template
 * produces. A fragment is never sent to a server — that is what a fragment is —
 * so it is picked up in the browser by `/admin/set-password` instead.
 *
 * IT NEVER REPORTS WHY IT FAILED. An expired link, a spent link, a forged one
 * and a mistyped one all end at the same sentence. Distinguishing them tells
 * somebody holding a stolen link how close they are.
 */

export const dynamic = "force-dynamic";

/** Where a person goes once the link has been honoured. */
const NEXT = "/admin/set-password";

/** One sentence for every kind of failure, on the screen that can act on it. */
const REFUSED = "/admin/forgot-password?problem=link";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Supabase reports its own failures this way — an expired invitation, most
  // often. It is not an error worth a stack trace; the person needs a new link.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL(REFUSED, request.url));
  }

  const supabase = await getServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(REFUSED, request.url));
    return NextResponse.redirect(new URL(NEXT, request.url));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // `invite`, `recovery`, `email_change` and `signup` all arrive here. The
      // value is passed through rather than mapped, so a type this application
      // has not thought about is refused by Supabase rather than guessed at.
      type: type as "invite" | "recovery" | "email_change" | "signup",
    });
    if (error) return NextResponse.redirect(new URL(REFUSED, request.url));
    return NextResponse.redirect(new URL(NEXT, request.url));
  }

  /*
   * NOTHING IN THE QUERY STRING — which is not the same as nothing at all.
   *
   * Supabase appends the session to the **fragment** when the link was made by
   * the admin API, because there is no PKCE verifier for a link one person
   * sends to another. A fragment is never transmitted to a server, so from here
   * an invitation and a typed-in URL look identical.
   *
   * Refusing would therefore throw away a perfectly good invitation. Forwarding
   * costs nothing instead: a browser carries the fragment across a redirect, so
   * a real link arrives at the screen that can read it, and a typed URL arrives
   * at a screen that says the link is not valid and offers a new one. Both end
   * somewhere useful, and neither reveals which happened.
   */
  return NextResponse.redirect(new URL(NEXT, request.url));
}
