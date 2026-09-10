/**
 * The email links a staff member arrives on, against real Supabase Auth.
 *
 * Build 10 shipped an invitation that went nowhere: `inviteUserByEmail` sends a
 * link back to the site's own URL and nothing answered it. Build 11 built the
 * three screens that do. What is proved here is the half that a browser test
 * cannot reach — that Supabase really mints these links, that they verify
 * exactly once, and that a verified link produces a session which can then set
 * a password that really works.
 *
 * NO EMAIL IS SENT. `generateLink` returns the same token the email would have
 * carried, without delivering anything, which is what makes this testable at
 * all on a project with no SMTP configured.
 *
 * NOTHING HERE TOUCHES A REAL PERSON. Every account is created with this run's
 * token in its address and is deleted by id at the end. The real Owner is never
 * read, never modified and never counted.
 */

import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { anonClient, serviceClient, SUPABASE_URL, ANON_KEY } from "./support";
import { NAMES } from "./fixtures";

const db = serviceClient();

/** Auth users this file creates, removed by exact id. */
const created: string[] = [];

async function makeUser(label: string): Promise<{ id: string; email: string }> {
  const email = NAMES.email(`link-${label}`);
  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { fixture: "build-11-password-links" },
  });
  if (error || !data.user) throw new Error(`could not create ${email}: ${error?.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email };
}

/** A fresh client with no cookies — a link opened in a browser nobody has used. */
function visitor() {
  return createClient(SUPABASE_URL(), ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

afterAll(async () => {
  for (const id of created) {
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
});

/* ------------------------------------------------------------- invitation */

describe("an invitation link", () => {
  it("is minted with a token that verifies to a real session", async () => {
    const email = NAMES.email("link-invite");

    const { data, error } = await db.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: "http://localhost:3000/admin/set-password" },
    });

    expect(error, error?.message).toBeNull();
    expect(data?.user?.id).toBeTruthy();
    created.push(data!.user!.id);

    const hash = data!.properties!.hashed_token;
    expect(hash, "an invitation must carry a token").toBeTruthy();

    // Exactly what `/admin/auth/callback` does with `?token_hash=&type=`.
    const guest = visitor();
    const verified = await guest.auth.verifyOtp({ token_hash: hash, type: "invite" });

    expect(verified.error, verified.error?.message).toBeNull();
    expect(verified.data.session, "verifying an invitation must produce a session").toBeTruthy();
    expect(verified.data.user?.email).toBe(email);
  });

  it("cannot be used twice", async () => {
    const email = NAMES.email("link-once");

    const { data } = await db.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: "http://localhost:3000/admin/set-password" },
    });
    created.push(data!.user!.id);
    const hash = data!.properties!.hashed_token;

    const first = await visitor().auth.verifyOtp({ token_hash: hash, type: "invite" });
    expect(first.error).toBeNull();

    // The second attempt is the one that matters: a link forwarded, screenshotted
    // or left in a browser's history must be spent.
    const second = await visitor().auth.verifyOtp({ token_hash: hash, type: "invite" });
    expect(second.error, "a spent invitation must be refused").not.toBeNull();
    expect(second.data.session).toBeNull();
  });
});

/* ------------------------------------------------------------- recovery */

describe("a set-or-reset-password link", () => {
  it("verifies, and the session it produces can change the password", async () => {
    const person = await makeUser("recover");
    const password = `Zz${NAMES.token}-first-password`;

    const { data, error } = await db.auth.admin.generateLink({
      type: "recovery",
      email: person.email,
      options: { redirectTo: "http://localhost:3000/admin/auth/callback" },
    });

    expect(error, error?.message).toBeNull();
    const hash = data!.properties!.hashed_token;

    const guest = visitor();
    const verified = await guest.auth.verifyOtp({ token_hash: hash, type: "recovery" });
    expect(verified.error, verified.error?.message).toBeNull();
    expect(verified.data.session).toBeTruthy();

    // What `/admin/set-password` does once it has a session.
    const updated = await guest.auth.updateUser({ password });
    expect(updated.error, updated.error?.message).toBeNull();

    // And the whole point: the password now signs in, which is the thing that
    // was impossible before Build 11.
    const signIn = await visitor().auth.signInWithPassword({
      email: person.email,
      password,
    });
    expect(signIn.error, signIn.error?.message).toBeNull();
    expect(signIn.data.session, "the new password must actually work").toBeTruthy();
  });

  it("is refused when the token is wrong", async () => {
    const person = await makeUser("forged");

    const { data } = await db.auth.admin.generateLink({
      type: "recovery",
      email: person.email,
      options: { redirectTo: "http://localhost:3000/admin/auth/callback" },
    });

    // One character different. The callback must not accept a near miss.
    const real = data!.properties!.hashed_token;
    const forged = real.slice(0, -1) + (real.endsWith("a") ? "b" : "a");

    const attempt = await visitor().auth.verifyOtp({ token_hash: forged, type: "recovery" });
    expect(attempt.error, "a forged token must be refused").not.toBeNull();
    expect(attempt.data.session).toBeNull();
  });
});

/* ------------------------------------------------- what it does not reveal */

describe("asking for a link", () => {
  it("says nothing about whether the address has an account", async () => {
    // The server action answers success either way; this proves Supabase does
    // not contradict it by erroring on an unknown address, which would leak the
    // answer through a timing or status difference.
    const unknown = await anonClient().auth.resetPasswordForEmail(
      NAMES.email("nobody-at-all"),
      { redirectTo: "http://localhost:3000/admin/auth/callback" },
    );

    // Supabase deliberately reports success for an unknown address. If this ever
    // starts failing, the server action's "always say the same thing" promise
    // needs re-examining rather than the test relaxing.
    expect(unknown.error, "an unknown address must not be distinguishable").toBeNull();
  });
});
