/**
 * Supabase environment variables, validated rather than assumed.
 *
 * NO SUPABASE PROJECT EXISTS YET. Nothing in the application calls these
 * functions, and no value here has a default: a wrong URL that silently falls
 * back to a placeholder is worse than a missing one that says so.
 *
 * The two public values are safe in the browser — the anon key is designed to
 * be public, and Row Level Security is what protects the data behind it. The
 * service-role key is not: it bypasses RLS entirely, so it is read only by
 * `admin.ts`, which is `server-only`.
 *
 * Variable names live in `.env.example`. Values never enter the repository.
 */

export interface SupabasePublicEnv {
  readonly url: string;
  readonly anonKey: string;
}

/**
 * Read at module scope in Next so the values are inlined into the client
 * bundle. `process.env.NEXT_PUBLIC_*` must be written out in full — a computed
 * lookup is not replaced at build time and reads as undefined in the browser.
 */
export function readPublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0 || !url || !anonKey) {
    throw new Error(
      `Supabase is not configured. Missing ${missing.join(" and ")}. ` +
        "Copy .env.example to .env.local and fill in the development project's values.",
    );
  }

  assertLooksLikeSupabaseUrl(url);
  return { url, anonKey };
}

/**
 * The service-role key. Server only, never in a browser bundle, never in a
 * `NEXT_PUBLIC_` variable. Importing this from a client component is a mistake
 * the `server-only` import in `admin.ts` turns into a build error.
 */
export function readServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required only for privileged " +
        "server work — migrations, the Google Sheet sync worker — and must never " +
        "be exposed to the browser.",
    );
  }
  return key;
}

/**
 * Catches the two mistakes that actually happen: pasting the dashboard URL
 * instead of the API URL, and pasting a key into the URL field.
 */
function assertLooksLikeSupabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be https, except for a local development stack.");
  }
  if (parsed.hostname.endsWith("supabase.com")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL looks like the Supabase dashboard address. " +
        "Use the project API URL, which ends in .supabase.co.",
    );
  }
}

/** Whether Supabase is configured at all, for a graceful message rather than a crash. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
