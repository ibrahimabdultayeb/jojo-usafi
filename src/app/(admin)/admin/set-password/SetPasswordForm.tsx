"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Choosing a password, at the end of an email link.
 *
 * WHY THIS IS A CLIENT COMPONENT, WHICH THE REST OF THIS DASHBOARD IS NOT
 *
 * Supabase's default invitation template sends the session in the URL
 * **fragment** — `#access_token=…&refresh_token=…`. A fragment is never
 * transmitted to a server. That is not a Supabase quirk, it is what a fragment
 * is, and it means no server component, route handler or server action can ever
 * see an invitation link's tokens. Only the browser can.
 *
 * `createBrowserClient` reads that fragment on load and writes the session to
 * cookies, which is what makes the rest of the dashboard work afterwards. This
 * component waits for that to happen and then asks for a password.
 *
 * The `?code=` shape is handled server-side instead, in `/admin/auth/callback`,
 * and arrives here already signed in — so both paths end at the same form.
 *
 * WHAT IT REFUSES
 *
 * A password shorter than Supabase's own minimum, and two boxes that disagree.
 * Nothing more: an eight-character minimum with no character-class rules is
 * what current guidance actually says, and a rule demanding a capital letter
 * and a symbol produces `Password1!` in a shop rather than a better password.
 */

const INPUT =
  "min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base " +
  "text-slate-900 outline-none placeholder:text-slate-400 " +
  "focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30";

/** Supabase's own default. Stated here so the message can be specific. */
const MINIMUM = 8;

type Stage = "checking" | "ready" | "no-session" | "saving" | "done";

export function SetPasswordForm({ alreadySignedIn }: { alreadySignedIn: boolean }) {
  const [stage, setStage] = useState<Stage>(alreadySignedIn ? "ready" : "checking");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (alreadySignedIn) return;

    const supabase = getBrowserSupabase();
    let cancelled = false;

    const settle = (found: boolean) => {
      if (cancelled) return;
      setStage(found ? "ready" : "no-session");
    };

    /** Take the tokens out of the address bar; history and screenshots keep it otherwise. */
    const clearHash = () => window.history.replaceState(null, "", window.location.pathname);

    async function adopt() {
      // Already signed in — the `?code=` path came through the callback route.
      const existing = await supabase.auth.getSession();
      if (existing.data.session) return settle(true);

      /*
       * THE FRAGMENT, READ BY HAND, AND THIS IS NOT BELT AND BRACES.
       *
       * `@supabase/ssr` builds its browser client with `flowType: "pkce"`, and
       * a PKCE client's own URL detection looks for `?code=` and ignores hash
       * tokens entirely. An invitation has no PKCE verifier — the person
       * accepting it is not the person who sent it — so Supabase delivers its
       * session in the fragment, and nothing picks it up unless this does.
       *
       * This was found by driving a real browser through a real link, which is
       * the only way it could have been: every server-side test passes while a
       * person still lands on a page that says their link is broken.
       */
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);

      // An expired or already-used link says so here rather than in the query.
      if (params.get("error") || params.get("error_description")) {
        clearHash();
        return settle(false);
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        clearHash();
        return settle(Boolean(data.session) && !error);
      }

      settle(false);
    }

    void adopt();

    return () => {
      cancelled = true;
    };
  }, [alreadySignedIn]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MINIMUM) {
      setError(`Use at least ${MINIMUM} characters. Longer is better than complicated.`);
      return;
    }
    if (password !== again) {
      setError("The two passwords are not the same.");
      return;
    }

    setStage("saving");
    const { error: failed } = await getBrowserSupabase().auth.updateUser({ password });

    if (failed) {
      setStage("ready");
      setError(
        /should be different|same as the old/i.test(failed.message)
          ? "That is the password you already had. Choose a different one."
          : `It could not be saved: ${failed.message}`,
      );
      return;
    }

    setStage("done");

    /*
     * A FULL PAGE LOAD, AND ONLY AFTER THE SESSION IS READABLE.
     *
     * `updateUser` rotates the session, and the browser client writes the new
     * cookie asynchronously. A client-side `router.push` sent immediately after
     * it raced that write: the request for `/admin` arrived at middleware with
     * no usable cookie, and a staff member who had just chosen a password was
     * bounced to `/admin/sign-in?next=/admin`. It looked exactly like a broken
     * password.
     *
     * Asking for the session first waits for the write to settle, and
     * `location.assign` leaves the router's cache out of it entirely — the
     * browser makes a fresh request with the cookies it now has.
     */
    await getBrowserSupabase().auth.getSession();
    window.setTimeout(() => window.location.assign("/admin"), 600);
  }

  if (stage === "checking") {
    return <p className="text-sm font-medium text-slate-500">Checking your link…</p>;
  }

  if (stage === "no-session") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          This link is not valid any more. It may have been used already, or it may have expired.
        </p>
        <Link
          href="/admin/forgot-password"
          className="flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-base font-bold text-white"
        >
          Send me a new one
        </Link>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <p
        role="status"
        className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900"
      >
        Saved. Taking you to the dashboard…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-bold text-slate-900">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={INPUT}
        />
        <p className="text-xs font-medium text-slate-500">
          At least {MINIMUM} characters. A few words you will remember beats something clever you
          will not.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="again" className="block text-sm font-bold text-slate-900">
          Type it again
        </label>
        <input
          id="again"
          type="password"
          autoComplete="new-password"
          required
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          className={INPUT}
        />
      </div>

      <button
        type="submit"
        disabled={stage === "saving"}
        className="min-h-12 w-full rounded-full bg-slate-900 px-6 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {stage === "saving" ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
