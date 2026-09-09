/**
 * Mint a run token, snapshot everything real, build the fixtures — and take
 * them away again afterwards.
 *
 * Vitest runs this in the main process before any test file and after the last
 * one. The suite runs with `fileParallelism: false` so the files see one shared,
 * predictable database rather than racing each other over the same rows.
 *
 * Teardown runs FIRST as well as last, for this run's token and for the
 * previous run's token if it did not finish cleanly. Both are tokens this suite
 * minted itself, recorded in `.run/manifest.json` — nothing is ever swept by a
 * general prefix.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertDevelopmentProject, serviceClient, loadEnv } from "./support";
import {
  mintToken,
  namesFor,
  readManifestIfPresent,
  writeManifest,
  type RunManifest,
} from "./run-context";

const TEMPLATE = fileURLToPath(new URL("./teardown.sql.tmpl", import.meta.url));

/**
 * The append-only ledgers refuse DELETE from every API caller, so a run's
 * fixtures can only be removed as `postgres`, through the CLI.
 */
function runSqlTeardown(token: string): void {
  const names = namesFor(token);
  const sql = readFileSync(TEMPLATE, "utf8")
    .replaceAll("__SKU_PREFIX__", names.skuPrefix)
    .replaceAll("__SLUG_PREFIX__", names.slugPrefix)
    .replaceAll("__EMAIL_PREFIX__", names.emailPrefix)
    .replaceAll("__PHONE__", names.phone)
    .replaceAll("__STORAGE_PREFIX__", names.storagePrefix)
    .replaceAll("__SESSION__", names.session);

  const dir = mkdtempSync(join(tmpdir(), "jojo-teardown-"));
  const file = join(dir, `teardown-${token}.sql`);
  writeFileSync(file, sql, "utf8");

  const result = spawnSync(`npx supabase db query --linked -f "${file}"`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      "Could not clean the development database.\n\n" +
        "  These tests need the Supabase CLI linked to the development project:\n" +
        "      npx supabase link --project-ref dyjhacbbedytcstxxjzl\n\n" +
        (result.stderr || result.stdout || "(no output)"),
    );
  }
}

/** Delete only the logins whose address carries the given run's token. */
async function deleteRunLogins(token: string): Promise<void> {
  const db = serviceClient();
  const prefix = namesFor(token).emailPrefix;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`could not list logins: ${error.message}`);

    for (const user of data.users) {
      if (user.email?.startsWith(prefix)) {
        const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
        if (deleteError) {
          throw new Error(`could not delete login ${user.email}: ${deleteError.message}`);
        }
      }
    }

    if (data.users.length < 200) break;
  }
}

/**
 * Everything that must survive the suite byte for byte.
 *
 * Taken BEFORE any fixture exists, so it is genuinely "the real data". Any row
 * whose identity carries a run token is excluded — those belong to a crashed
 * previous run and are about to be swept.
 */
async function snapshotRealData(
  excludedEmailPrefixes: string[],
): Promise<Pick<RunManifest, "realAdminProfiles" | "realAuditEvents">> {
  const db = serviceClient();

  const profiles = await db.from("admin_profiles").select("*").order("id");
  if (profiles.error) throw new Error(`could not snapshot staff: ${profiles.error.message}`);

  const audit = await db.from("audit_events").select("*").order("id");
  if (audit.error) throw new Error(`could not snapshot audit: ${audit.error.message}`);

  const isFixture = (value: string | null | undefined) =>
    Boolean(value && excludedEmailPrefixes.some((prefix) => value.startsWith(prefix)));

  const realAdminProfiles = (profiles.data ?? []).filter((row) => !isFixture(row.email));
  const realAuditEvents = (audit.data ?? []).filter((row) => !isFixture(row.entity_key));

  // FAIL CLOSED. If the shop's own Owner cannot be identified unambiguously,
  // this suite does not know what it is allowed to touch, so it touches nothing.
  const owners = realAdminProfiles.filter((row) => row.role === "owner" && row.active);
  if (owners.length !== 1) {
    throw new Error(
      `Expected exactly one real active Owner before the tests run, found ${owners.length}.\n` +
        "  These tests refuse to run when fixture identity is ambiguous, because the\n" +
        "  next thing they would do is decide which rows are safe to delete.\n" +
        (owners.length === 0
          ? "  Has the first-Owner bootstrap been completed on this project?"
          : `  Owners: ${owners.map((o) => o.email).join(", ")}`),
    );
  }

  return { realAdminProfiles, realAuditEvents };
}

export async function setup(): Promise<void> {
  loadEnv();
  assertDevelopmentProject();

  const previous = readManifestIfPresent();
  const previousToken = previous?.token ?? null;

  // Sweep the previous run first, if it left anything, so this run starts from
  // the same place every other run does.
  if (previousToken) {
    runSqlTeardown(previousToken);
    await deleteRunLogins(previousToken);
  }

  const token = mintToken();
  const prefixes = [namesFor(token).emailPrefix];
  if (previousToken) prefixes.push(namesFor(previousToken).emailPrefix);

  const snapshot = await snapshotRealData(prefixes);

  writeManifest({
    token,
    startedAt: new Date().toISOString(),
    previousToken,
    ...snapshot,
  });

  // Imported only now: `fixtures.ts` reads the manifest at module load, so it
  // cannot be imported before the manifest exists.
  const { createFixtures } = await import("./fixtures");
  await createFixtures();
}

export async function teardown(): Promise<void> {
  loadEnv();
  assertDevelopmentProject();

  const manifest = readManifestIfPresent();
  if (!manifest) return;

  runSqlTeardown(manifest.token);
  await deleteRunLogins(manifest.token);

  // The manifest is kept, with its token, so that a crash on the NEXT run still
  // knows which rows to sweep. It is rewritten at the start of each run.
}
