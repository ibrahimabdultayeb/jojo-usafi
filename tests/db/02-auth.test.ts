/**
 * Supabase Auth, the three staff roles, and the first-Owner bootstrap.
 *
 * Every fixture identity here carries this run's token, and nothing in this file
 * inspects, mutates or depends on Jojo Usafi's real Owner row beyond asserting
 * that it exists and is unchanged.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, errorOf, PG, serviceClient, signIn } from "./support";
import { EMAIL, ID, NAMES, ensureOwnerProfile, loginIds } from "./fixtures";

const db = serviceClient();

/**
 * The seat is taken.
 *
 * Until 2026-09-09 this file proved the happy path: an empty shop, one account
 * claiming the Owner seat, and every later attempt refused. That was a
 * ONE-TIME, IRREVERSIBLE event and it has now happened on this database — the
 * real Owner exists, and the last-Owner trigger means the shop can never return
 * to having none. The happy path is therefore no longer re-runnable here, and a
 * test that pretended otherwise would be lying about what it checked.
 *
 * What is permanently true, and is what these tests hold to, is the harder and
 * more useful half: the seat cannot be taken twice, cannot be taken by a
 * stranger, and cannot be taken by a signed-in account that simply fancies it.
 *
 * The real Owner is found by asking the database rather than by naming anybody:
 * the active Owner whose email does not carry this run's fixture prefix.
 */
describe("the Owner seat is taken, and cannot be taken again", () => {
  it("reports that the shop has an Owner", async () => {
    const { data, error } = await anonClient().rpc("jojo_owner_exists");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("has exactly one real Owner, linked to a real login", async () => {
    const { data, error } = await db
      .from("admin_profiles")
      .select("id, full_name, email, role, active, auth_user_id")
      .eq("role", "owner")
      .eq("active", true)
      .not("email", "like", `${NAMES.emailPrefix}%`);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const owner = data![0];
    expect(owner.active).toBe(true);
    expect(owner.auth_user_id, "the Owner must be linked to an auth.users row").toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(owner.full_name.trim().length).toBeGreaterThan(0);

    // The link is a real foreign key, so the login it points at must exist.
    const { data: login, error: loginError } = await db.auth.admin.getUserById(owner.auth_user_id!);
    expect(loginError).toBeNull();
    expect(login.user?.email).toBe(owner.email);
  });

  it("recorded the claim in the audit trail, once", async () => {
    const { data, error } = await db
      .from("audit_events")
      .select("action, entity_table, entity_key, actor_type, source")
      .eq("action", "admin_profile.first_owner_claimed");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      entity_table: "admin_profiles",
      actor_type: "staff",
      source: "admin",
    });
  });

  it("refuses a stranger who has not signed in — before the function body runs", async () => {
    const error = errorOf(
      await anonClient().rpc("jojo_claim_first_owner", { p_full_name: "Impostor" }),
    );
    // EXECUTE is granted to `authenticated` only, so anon never reaches the
    // existence check at all.
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("refuses a signed-in account that is not staff", async () => {
    const stranger = await signIn(EMAIL.nobody);
    const error = errorOf(
      await stranger.rpc("jojo_claim_first_owner", { p_full_name: "Opportunist" }),
    );
    expect(error.message).toContain("already has an Owner");

    const { data } = await db.from("admin_profiles").select("id").eq("email", EMAIL.nobody);
    expect(data, "no profile may be created by a refused claim").toEqual([]);
  });

  it("refuses the Owner a second time", async () => {
    await ensureOwnerProfile();
    const owner = await signIn(EMAIL.owner);
    const error = errorOf(await owner.rpc("jojo_claim_first_owner", { p_full_name: "Again" }));
    expect(error.message).toContain("already has an Owner");
  });
});

describe("a signed-in account cannot promote itself", () => {
  it("cannot insert a staff profile for itself", async () => {
    const stranger = await signIn(EMAIL.nobody);
    const ids = await loginIds(db);

    const error = errorOf(
      await stranger.from("admin_profiles").insert({
        auth_user_id: ids[EMAIL.nobody],
        full_name: `ZZ${NAMES.token} Self Promoted`,
        email: EMAIL.nobody,
        role: "owner",
        active: true,
      }),
    );
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("cannot edit the Owner's profile", async () => {
    const stranger = await signIn(EMAIL.nobody);

    const { data: owners } = await db
      .from("admin_profiles")
      .select("id")
      .eq("role", "owner")
      .eq("active", true)
      .not("email", "like", `${NAMES.emailPrefix}%`);

    const realOwnerId = owners![0].id;

    // The policy matches no row for this caller, so the update changes nothing
    // rather than raising — and the Owner is still the Owner afterwards.
    const attempt = await stranger
      .from("admin_profiles")
      .update({ role: "order_staff" })
      .eq("id", realOwnerId)
      .select("id");

    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);

    const { data: after } = await db
      .from("admin_profiles")
      .select("role, active")
      .eq("id", realOwnerId)
      .single();
    expect(after).toMatchObject({ role: "owner", active: true });
  });

  it("still sees the public shelf — RLS denies staff data, not everything", async () => {
    const stranger = await signIn(EMAIL.nobody);

    const shelf = await stranger.from("product_shelf").select("sku").like("sku", `${NAMES.skuPrefix}%`);
    expect(shelf.error).toBeNull();
    expect(shelf.data!.length).toBeGreaterThan(0);

    const staffOnly = await stranger.from("orders").select("id").limit(1);
    expect(staffOnly.error).toBeNull();
    expect(staffOnly.data).toEqual([]);
  });
});

describe("a caller's role is whatever admin_profiles says it is", () => {
  beforeAll(ensureOwnerProfile);

  it("answers correctly for each of the three roles", async () => {
    const cases = [
      { email: EMAIL.owner, role: "owner", staff: true, owner: true, manages: true },
      { email: EMAIL.manager, role: "manager", staff: true, owner: false, manages: true },
      { email: EMAIL.staff, role: "order_staff", staff: true, owner: false, manages: false },
    ] as const;

    for (const expected of cases) {
      const client = await signIn(expected.email);
      const [role, staff, owner, manages] = await Promise.all([
        client.rpc("jojo_admin_role"),
        client.rpc("jojo_is_staff"),
        client.rpc("jojo_is_owner"),
        client.rpc("jojo_manages_catalogue"),
      ]);

      expect(role.data, expected.email).toBe(expected.role);
      expect(staff.data, expected.email).toBe(expected.staff);
      expect(owner.data, expected.email).toBe(expected.owner);
      expect(manages.data, expected.email).toBe(expected.manages);
    }
  });

  it("treats a signed-in account with no profile as not staff", async () => {
    const stranger = await signIn(EMAIL.nobody);
    expect((await stranger.rpc("jojo_is_staff")).data).toBe(false);
    expect((await stranger.rpc("jojo_admin_role")).data).toBeNull();
    expect((await stranger.rpc("jojo_manages_catalogue")).data).toBe(false);
  });

  it("stops treating a deactivated staff member as staff", async () => {
    await db.from("admin_profiles").update({ active: false }).eq("id", ID.profileStaff);

    const staff = await signIn(EMAIL.staff);
    expect((await staff.rpc("jojo_is_staff")).data).toBe(false);
    expect((await staff.rpc("jojo_admin_role")).data).toBeNull();

    // ...but they can still read the row that says they are deactivated, so the
    // dashboard can say so plainly instead of showing an empty screen.
    const own = await staff.from("admin_profiles").select("id, active, role");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    expect(own.data![0]).toMatchObject({ id: ID.profileStaff, active: false });

    await db.from("admin_profiles").update({ active: true }).eq("id", ID.profileStaff);
  });
});

describe("there must always be an Owner", () => {
  /**
   * The guard fires only for the LAST active Owner, and Jojo Usafi's real Owner
   * is permanent — so any fixture Owner is always a second one and the guard
   * never fires on it. Exercising it needs a world with exactly one Owner.
   *
   * Build 06 got that world by attempting refused mutations against the real
   * Owner row, and on one run a DELETE actually went through. So the whole
   * scenario now runs inside a transaction that always rolls back, in
   * `last-owner-guard.sql`: probe Owners are created, every other Owner stands
   * down *within the transaction*, the guard is exercised against the probes,
   * and the lot is undone.
   *
   * No committed row changes. `05-real-data-untouched.test.ts` proves it
   * independently, byte for byte.
   */
  it("refuses to demote, deactivate or delete the last Owner", () => {
    const script = fileURLToPath(new URL("./last-owner-guard.sql", import.meta.url));
    const result = spawnSync(`npx supabase db query --linked -f "${script}"`, {
      encoding: "utf8",
      shell: true,
      maxBuffer: 16 * 1024 * 1024,
    });

    // Every failure inside the script raises, which the CLI reports as a
    // non-zero exit. The message says which assertion gave way.
    expect(result.stdout + result.stderr).not.toContain("GUARD FAILED");
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("last-owner guard verified in a rolled-back transaction");

    // And the transaction left the real world exactly as it found it: the shop
    // still has an Owner and not one probe row survived. (The count is "at
    // least one" rather than exactly one because this run's fixture Owner is
    // legitimately alongside Jojo Usafi's real one.)
    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))) as {
      rows: { active_owners: number; probe_rows_left: number }[];
    };
    expect(report.rows[0].active_owners).toBeGreaterThanOrEqual(1);
    expect(report.rows[0].probe_rows_left).toBe(0);
  }, 120_000);

  it("allows an ordinary staff member to be deactivated", async () => {
    const updated = await db
      .from("admin_profiles")
      .update({ active: false })
      .eq("id", ID.profileManager)
      .select("active")
      .single();

    expect(updated.error).toBeNull();
    expect(updated.data?.active).toBe(false);

    await db.from("admin_profiles").update({ active: true }).eq("id", ID.profileManager);
  });
});

describe("admin_profiles is really tied to auth.users", () => {
  it("refuses a profile pointing at a login that does not exist", async () => {
    const error = errorOf(
      await db.from("admin_profiles").insert({
        auth_user_id: "00000000-0000-4000-8000-999999999999",
        full_name: `ZZ${NAMES.token} Ghost`,
        email: NAMES.email("ghost"),
        role: "order_staff",
      }),
    );
    expect(error.code).toBe(PG.foreignKey);
  });

  it("keeps the profile, unlinked, when the login is deleted", async () => {
    const created = await db.auth.admin.createUser({
      email: NAMES.email("temp"),
      password: "not-used-for-sign-in-12345",
      email_confirm: true,
    });
    expect(created.error).toBeNull();

    const profile = await db
      .from("admin_profiles")
      .insert({
        auth_user_id: created.data.user!.id,
        full_name: `ZZ${NAMES.token} Temporary Staff`,
        email: NAMES.email("temp"),
        role: "order_staff",
      })
      .select("id")
      .single();
    expect(profile.error).toBeNull();

    // Deleting a login must never delete the staff record the order timeline
    // and the audit trail name as the actor.
    const deleted = await db.auth.admin.deleteUser(created.data.user!.id);
    expect(deleted.error).toBeNull();

    const after = await db
      .from("admin_profiles")
      .select("id, auth_user_id, full_name")
      .eq("id", profile.data!.id)
      .single();

    expect(after.error).toBeNull();
    expect(after.data).toMatchObject({
      full_name: `ZZ${NAMES.token} Temporary Staff`,
      auth_user_id: null,
    });

    await db.from("admin_profiles").delete().eq("id", profile.data!.id);
  });

  it("gave every fixture login a real auth.users row", async () => {
    const ids = await loginIds(db);
    for (const email of Object.values(EMAIL)) {
      expect(ids[email], `no login for ${email}`).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
