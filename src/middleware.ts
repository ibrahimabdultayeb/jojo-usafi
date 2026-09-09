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
  const isPublicAdminRoute =
    path.startsWith("/admin/sign-in") || path.startsWith("/admin/setup");

  if (!user && !isPublicAdminRoute) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/admin/sign-in";
    signIn.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
