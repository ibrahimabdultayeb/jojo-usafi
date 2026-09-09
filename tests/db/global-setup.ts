/**
 * Build the fake development fixtures once, and take them away again.
 *
 * Vitest runs this in the main process before any test file and after the last
 * one. The suite runs with `fileParallelism: false` so the files see one shared,
 * predictable database rather than racing each other over the same rows.
 *
 * Teardown runs FIRST as well as last. A run that crashed half way through
 * leaves fixtures behind, and the next run must start from the same place as
 * every other run rather than from wherever the last failure stopped.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertDevelopmentProject, serviceClient, loadEnv } from "./support";
import { createFixtures, EMAIL } from "./fixtures";

const TEARDOWN_SQL = fileURLToPath(new URL("./teardown.sql", import.meta.url));

/**
 * The append-only ledgers refuse DELETE from every API caller, so the fixtures
 * they hold can only be removed as `postgres`, through the CLI. See the header
 * of teardown.sql.
 */
function runSqlTeardown(): void {
  const result = spawnSync(`npx supabase db query --linked -f "${TEARDOWN_SQL}"`, {
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

async function deleteTestLogins(): Promise<void> {
  const db = serviceClient();
  const emails = new Set<string>(Object.values(EMAIL));

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`could not list logins: ${error.message}`);

    for (const user of data.users) {
      if (user.email && emails.has(user.email)) {
        const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
        if (deleteError) {
          throw new Error(`could not delete login ${user.email}: ${deleteError.message}`);
        }
      }
    }

    if (data.users.length < 200) break;
  }
}

export async function setup(): Promise<void> {
  loadEnv();
  assertDevelopmentProject();

  runSqlTeardown();
  await deleteTestLogins();
  await createFixtures();
}

export async function teardown(): Promise<void> {
  loadEnv();
  assertDevelopmentProject();

  runSqlTeardown();
  await deleteTestLogins();
}
