import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Per-run identity for the database tests.
 *
 * WHY THIS EXISTS
 *
 * Build 06's fixtures were marked with a fixed `ZZTEST` / `zztest-` prefix and
 * teardown deleted anything carrying it. That is a *class* marker, not a *run*
 * marker, and it drifted into deleting things by what they were rather than by
 * who made them — one rule matched `audit_events` on
 * `action = 'admin_profile.first_owner_claimed'` and destroyed Jojo Usafi's real
 * audit row the first time the real bootstrap ran.
 *
 * So every run now mints a token — eight hex characters — and every row a test
 * creates carries it in a field teardown can match exactly:
 *
 *     products.sku              ZZ1A2B3C4D-P1
 *     delivery_zones.slug       zz1a2b3c4d-zone
 *     admin_profiles.email      zz1a2b3c4d-owner@jojo-usafi.test
 *     customers.phone_e164      +2557xxxxxxxx   (derived from the token)
 *     media_assets.storage_path zz1a2b3c4d/...
 *     analytics_events.session  zz1a2b3c4d-session
 *
 * Teardown then deletes exactly this run's token and nothing else. It never
 * matches on a role, an action, a business state or a shared email domain.
 *
 * The token lives in a manifest file rather than an environment variable
 * because Vitest's `globalSetup` runs in the main process and the test files
 * run in worker processes, which do not inherit variables set after launch.
 *
 * The manifest also carries a snapshot of every REAL row that must survive
 * untouched — see `05-real-data-untouched.test.ts`.
 */

const DIR = fileURLToPath(new URL("./.run/", import.meta.url));
const MANIFEST = fileURLToPath(new URL("./.run/manifest.json", import.meta.url));

export interface RunManifest {
  /** Eight uppercase hex characters. Unique to one `npm run test:db`. */
  readonly token: string;
  readonly startedAt: string;
  /**
   * The token of the previous run, if it did not finish cleanly. Teardown
   * sweeps exactly this one as well — a token we minted ourselves — so a
   * crashed run does not leave fixtures behind forever, and no general prefix
   * sweep is ever needed.
   */
  readonly previousToken: string | null;
  /** Every `admin_profiles` row that existed BEFORE this run created anything. */
  readonly realAdminProfiles: readonly Record<string, unknown>[];
  /** Every `audit_events` row that existed before this run. */
  readonly realAuditEvents: readonly Record<string, unknown>[];
}

export function mintToken(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function writeManifest(manifest: RunManifest): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
}

export function readManifestIfPresent(): RunManifest | null {
  if (!existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as RunManifest;
  } catch {
    return null;
  }
}

export function readManifest(): RunManifest {
  const manifest = readManifestIfPresent();
  if (!manifest) {
    throw new Error(
      "No test-run manifest. These tests are launched by `npm run test:db`, which " +
        "creates one in globalSetup; running a file directly will not work.",
    );
  }
  return manifest;
}

/* ------------------------------------------------------- fixture identity */

export interface FixtureNames {
  readonly token: string;
  readonly lower: string;
  /** `ZZ1A2B3C4D-P1` — a valid SKU, unique to this run. */
  sku(name: string): string;
  /** `ZZ1A2B3C4D-BR` — a valid brand/category/supplier/family code. */
  code(name: string): string;
  /** `zz1a2b3c4d-brand` — a valid slug. */
  slug(name: string): string;
  /** `zz1a2b3c4d-owner@jojo-usafi.test` — `.test` is a reserved TLD. */
  email(name: string): string;
  /** A valid UUID whose first group is this run's token. */
  uuid(n: number): string;
  /** The prefix teardown matches on, per column family. */
  readonly skuPrefix: string;
  readonly slugPrefix: string;
  readonly emailPrefix: string;
  readonly storagePrefix: string;
  readonly phone: string;
  readonly session: string;
}

export function namesFor(token: string): FixtureNames {
  const lower = token.toLowerCase();

  // Eight digits derived from the token, so two runs cannot collide on
  // `customers.phone_e164`, which is unique. `+255` then 7 then eight digits is
  // exactly what the schema's CHECK constraint allows.
  const digits = String(parseInt(token, 16) % 100_000_000).padStart(8, "0");

  return {
    token,
    lower,
    sku: (name) => `ZZ${token}-${name}`,
    code: (name) => `ZZ${token}-${name}`,
    slug: (name) => `zz${lower}-${name}`,
    email: (name) => `zz${lower}-${name}@jojo-usafi.test`,
    uuid: (n) => `${lower}-0000-4000-8000-${String(n).padStart(12, "0")}`,
    skuPrefix: `ZZ${token}-`,
    slugPrefix: `zz${lower}-`,
    emailPrefix: `zz${lower}-`,
    storagePrefix: `zz${lower}`,
    phone: `+2557${digits}`,
    session: `zz${lower}-session`,
  };
}
