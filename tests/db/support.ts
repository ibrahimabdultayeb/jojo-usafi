/**
 * Support for the tests that need a REAL database.
 *
 * These are not the domain unit tests. `npm run test` proves the business rules
 * as pure functions with no I/O; this suite proves that PostgreSQL, PostgREST
 * and Supabase Auth actually behave the way those rules assume — that the CHECK
 * constraints fire, the triggers refuse, the generated column computes and,
 * above all, that Row Level Security lets exactly the right caller through.
 *
 * It runs against the hosted DEVELOPMENT project and nothing else. Every row it
 * writes is marked `ZZTEST` and removed afterwards.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database } from "@/lib/supabase/types";

/* ------------------------------------------------------------ environment */

/**
 * `.env.local` is read here rather than by a framework: this suite runs under
 * plain Vitest, with no Next.js around it to load the file.
 */
export function loadEnv(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Already loaded, or absent — requireEnv gives the useful message.
  }
}

function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. These tests need the hosted development project: ` +
        "copy .env.example to .env.local and fill it in. They are deliberately " +
        "not part of `npm run test`, which needs no database.",
    );
  }
  return value;
}

export const SUPABASE_URL = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_KEY = () => requireEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Refuse to run against anything but the development project.
 *
 * The whole suite writes, deletes and disables triggers. Pointing it at
 * production would be catastrophic and is exactly the kind of mistake a tired
 * evening makes, so it is checked rather than trusted.
 */
export const DEV_PROJECT_REF = "dyjhacbbedytcstxxjzl";

export function assertDevelopmentProject(): void {
  const url = SUPABASE_URL();
  if (!url.includes(DEV_PROJECT_REF)) {
    throw new Error(
      `Refusing to run database tests against ${url}. This suite is only ever ` +
        `run against the development project ${DEV_PROJECT_REF}: it writes ` +
        "fixtures, deletes rows and disables triggers.",
    );
  }
}

/* ---------------------------------------------------------------- clients */

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** The server. Bypasses Row Level Security entirely — used to build fixtures. */
export function serviceClient(): SupabaseClient<Database> {
  assertDevelopmentProject();
  return createClient<Database>(SUPABASE_URL(), SERVICE_KEY(), clientOptions);
}

/** A shopper who has not signed in. This is almost every real visitor. */
export function anonClient(): SupabaseClient<Database> {
  assertDevelopmentProject();
  return createClient<Database>(SUPABASE_URL(), ANON_KEY(), clientOptions);
}

/** A signed-in login, holding a real session token. */
export async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: testPassword(),
  });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return client;
}

/**
 * The password every fixture login shares.
 *
 * Derived from the project's own service-role key rather than written down, so
 * it is never a constant in the repository, differs between projects, and is
 * unknowable to anyone who does not already hold the key that would let them
 * bypass RLS anyway. The logins are deleted when the suite finishes.
 */
export function testPassword(): string {
  return `Zz!${createHash("sha256").update(`jojo-usafi-db-tests:${SERVICE_KEY()}`).digest("hex").slice(0, 28)}`;
}

/* -------------------------------------------------------------- assertions */

/** PostgreSQL error classes the schema relies on, by the name they read as. */
export const PG = {
  checkViolation: "23514",
  uniqueViolation: "23505",
  notNull: "23502",
  foreignKey: "23503",
  /** `raise ... using errcode = 'restrict_violation'` — the append-only and guard triggers. */
  restrictViolation: "23001",
  /** RLS refused an insert or update, or a column grant did. */
  insufficientPrivilege: "42501",
} as const;

export interface PostgrestErrorish {
  code?: string;
  message?: string;
  details?: string | null;
}

/** A PostgREST result that must have failed, with the reason it gave. */
export function errorOf(result: { error: PostgrestErrorish | null }): PostgrestErrorish {
  if (!result.error) {
    throw new Error("expected the database to refuse this, but it succeeded");
  }
  return result.error;
}

/**
 * The guard triggers raise with `errcode = 'restrict_violation'` (23001).
 * P0001 is the code a bare `raise exception` would carry, and is accepted so
 * that a future guard written without an explicit errcode still reads as
 * "the trigger refused" rather than as an unrelated failure.
 */
export function isRefusedByTrigger(error: PostgrestErrorish): boolean {
  return error.code === PG.restrictViolation || error.code === "P0001";
}
