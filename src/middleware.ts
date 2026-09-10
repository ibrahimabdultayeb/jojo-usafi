import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, readPublicEnv } from "@/lib/supabase/env";

/**
 * Keeps the admin session alive.
 *
 * Supabase access tokens are short-lived and the refresh token is rotated. If
 * nothing refreshes them between requests, a signed-in staff member is silently
 * signed out after an hour — which, on a phone in a shop, reads as "the app is
 * broken" rather than as a security feature. This runs before every `/admin`
 * request, asks Supabase who the caller is, and writes back any rotated cookies.
 *
 * SCOPE: `/admin` only. The storefront is untouched — it is statically rendered
 * in two languages and has no session to refresh, and putting middleware in
 * front of 325 prerendered pages to do nothing would be a cost with no benefit.
 *
 * THIS IS NOT THE AUTHORIZATION BOUNDARY. It refreshes a session; it does not
 * decide what that session may see. Row Level Security does that, in the
 * database, for every query — see `docs/DATA_MODEL.md`.
 */
export async function middleware(request: NextRequest) {
  // A checkout of this repository with no `.env.local` must still be able to
  // open the admin prototype. Supabase not being configured is a normal state
  // for a fresh clone, not an error worth a 500 on every page.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const env = readPublicEnv();

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` rather than `getSession()`: it verifies the token with Supabase
  // instead of trusting whatever the cookie claims, and it is what triggers the
  // refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // THE GUARD.
  //
  // Build 06 deliberately left these screens open because they showed invented
  // data and there was nothing to protect. Build 07 gave them real prices and
  // stock, and Build 08 gives them real orders and real writes, so that
  // reasoning has expired.
  //
  // This checks only "is anybody signed in". Whether that person is STAFF is
  // decided by Row Level Security in the database and re-checked by each page,
  // because a middleware that decided authorisation would be a second opinion
  // that could drift from the first. Its job is to send a stranger somewhere
  // useful instead of showing them an empty dashboard.
  const path = request.nextUrl.pathname;

  /**
   * The routes a person must reach WITHOUT a session, because reaching them is
   * how they get one.
   *
   * The last three are Build 11's and each would be broken by the redirect
   * below in a different way:
   *
   *   forgot-password  the person cannot sign in — that is why they are here
   *   auth/callback    carries the one-time code; a redirect spends it for
   *                    nothing and the link cannot be used twice
   *   set-password     an invitation link delivers its tokens in the URL
   *                    FRAGMENT, which never reaches a server. Redirecting
   *                    loses it silently, and the person is bounced to a
   *                    sign-in form for an account with no password yet
   */
  const isPublicAdminRoute =
    path.startsWith("/admin/sign-in") ||
    path.startsWith("/admin/setup") ||
    path.startsWith("/admin/forgot-password") ||
    path.startsWith("/admin/auth/") ||
    path.startsWith("/admin/set-password");

  if (!user && !isPublicAdminRoute) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/admin/sign-in";
    signIn.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(signIn);
  }

  /*
   * SIGNED IN IS NOT THE SAME AS STAFF, and until Build 11 this file treated
   * them as if they were.
   *
   * A Supabase account that has never been added to the shop reached `/admin`
   * and was shown the dashboard frame: the greeting, the navigation, the search
   * box, and the counts that come from the public shelf. Row Level Security
   * held — every order, customer and staff row came back empty — so it was not
   * a data breach. It was worse in a quieter way: the application told somebody
   * they were in the back office when they were not, and the sign-in screen's
   * carefully written "No access" panel was never reached, because signing in
   * redirects to `/admin` and nothing sent them back.
   *
   * So the check happens here, where "is anybody signed in" already happens.
   * It costs one query on admin routes only, and `admin_profiles_self_read` is
   * what makes it answerable: a person may always read the row that says who
   * they are, including the row that says they have been switched off.
   *
   * THIS IS STILL NOT THE AUTHORIZATION BOUNDARY. It decides who is shown a
   * dashboard, not what that dashboard may read — Row Level Security decides
   * that, per query, and `authorize()` re-checks every write. What this stops
   * is a stranger being handed the furniture.
   */
  if (user && !isPublicAdminRoute) {
    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile?.active) {
      const signIn = request.nextUrl.clone();
      signIn.pathname = "/admin/sign-in";
      // No `next`: sending them back to a page they may not have is a loop
      // dressed up as helpfulness. The sign-in screen explains which of the two
      // situations this is — not staff at all, or switched off.
      signIn.search = "";
      return NextResponse.redirect(signIn);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
