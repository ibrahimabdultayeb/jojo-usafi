/**
 * The suite did not touch anything real.
 *
 * This is the regression test for the Build 06 incident. Teardown deleted Jojo
 * Usafi's own audit row because a rule matched on what had HAPPENED
 * (`action = 'admin_profile.first_owner_claimed'`) rather than on who had made
 * the row; and the last-Owner tests mutated the real Owner directly, with a
 * DELETE actually going through on one run.
 *
 * Both are fixed at the source — teardown is scoped to this run's token, and
 * the guard is exercised in a rolled-back transaction. This file is the proof
 * that neither fix quietly stopped working.
 *
 * It runs LAST (the sequencer orders by filename) and compares every real row
 * against the snapshot `globalSetup` took BEFORE a single fixture existed.
 * Byte for byte: the whole row, every column, serialised with sorted keys.
 */

import { describe, expect, it } from "vitest";
import { serviceClient } from "./support";
import { NAMES } from "./fixtures";
import { readManifest } from "./run-context";

const db = serviceClient();
const manifest = readManifest();

/** Stable serialisation: key order must not decide whether a row "changed". */
function canonical(row: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))),
  );
}

function canonicalAll(rows: readonly Record<string, unknown>[]): string[] {
  return rows.map(canonical).sort();
}

/** A row belongs to this run if its identifying text carries the run token. */
const isFixture = (value: string | null | undefined) =>
  Boolean(value && value.startsWith(NAMES.emailPrefix));

describe("the real Owner and the real audit trail are untouched", () => {
  it("snapshotted a real Owner before the suite began", () => {
    const owners = manifest.realAdminProfiles.filter(
      (row) => row.role === "owner" && row.active === true,
    );
    expect(
      owners,
      "globalSetup fails closed if this is not exactly one, so reaching here means it was",
    ).toHaveLength(1);
  });

  it("leaves every real staff row byte-for-byte identical", async () => {
    const { data, error } = await db.from("admin_profiles").select("*").order("id");
    expect(error).toBeNull();

    const now = canonicalAll((data ?? []).filter((row) => !isFixture(row.email)));
    const before = canonicalAll(manifest.realAdminProfiles);

    // Compared as whole rows, so a changed role, a flipped `active`, a bumped
    // `updated_at` or a vanished row all fail the same way.
    expect(now).toEqual(before);
  });

  it("leaves every real audit row byte-for-byte identical", async () => {
    const { data, error } = await db.from("audit_events").select("*").order("id");
    expect(error).toBeNull();

    const now = canonicalAll((data ?? []).filter((row) => !isFixture(row.entity_key)));
    const before = canonicalAll(manifest.realAuditEvents);

    expect(now).toEqual(before);
  });

  it("still has the first-Owner claim in the audit trail", async () => {
    const { data, error } = await db
      .from("audit_events")
      .select("action, entity_table")
      .eq("action", "admin_profile.first_owner_claimed");

    expect(error).toBeNull();
    expect(data, "the record of the bootstrap must survive every test run").toHaveLength(1);
  });
});

describe("this run's fixtures are the only fixtures present", () => {
  it("created no staff outside its own token", async () => {
    const { data, error } = await db.from("admin_profiles").select("email");
    expect(error).toBeNull();

    const known = new Set(manifest.realAdminProfiles.map((row) => row.email as string | null));
    const strays = (data ?? [])
      .map((row) => row.email)
      .filter((email) => !isFixture(email) && !known.has(email ?? null));

    // A stray here means a previous run leaked, or this run wrote outside its
    // token — either way teardown would not find it.
    expect(strays).toEqual([]);
  });

  it("created no product outside its own token", async () => {
    const { data, error } = await db
      .from("products")
      .select("sku")
      .not("sku", "like", `${NAMES.skuPrefix}%`)
      .like("sku", "ZZ%");

    expect(error).toBeNull();
    expect(data, "leftover fixtures from another run").toEqual([]);
  });
});
