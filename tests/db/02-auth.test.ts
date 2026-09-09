/**
 * Supabase Auth, the three staff roles, and the first-Owner bootstrap.
 *
 * The fixtures deliberately do NOT create an Owner profile. They create the
 * Owner's LOGIN and stop, so that the bootstrap can be proved the only way it
 * can honestly be proved: by an empty shop having no Owner, one account taking
 * the seat, and every later attempt being refused.
 *
 * Everything after that depends on it, which is why this file is 02 and runs
 * with `fileParallelism: false`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminProfileRow } from "@/lib/supabase/types";
import { anonClient, errorOf, isRefusedByTrigger, PG, serviceClient, signIn } from "./support";
import { EMAIL, ID, ensureOwnerProfile, loginIds } from "./fixtures";

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
 * the active Owner whose email is not a `zztest-` fixture.
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
      .not("email", "like", "zztest-%");

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
        full_name: "ZZTEST Self Promoted",
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
      .not("email", "like", "zztest-%");

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

    const shelf = await stranger.from("product_shelf").select("sku").like("sku", "ZZTEST%");
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
   * The guard fires for the LAST active Owner, so there has to be exactly one.
   * Earlier tests give the fixture login an Owner profile, which would be a
   * second one and would make every assertion below pass for the wrong reason —
   * demoting one of two Owners is supposed to be allowed. It is stood down for
   * the length of this section and put back afterwards.
   *
   * Standing it down is itself legitimate: the real Owner remains, so the guard
   * has no reason to object.
   */
  beforeAll(async () => {
    await db
      .from("admin_profiles")
      .update({ active: false })
      .eq("role", "owner")
      .like("email", "zztest-%");
  });

  afterAll(ensureOwnerProfile);

  /**
   * The Owner this shop actually belongs to — found by asking, never named.
   *
   * Every mutation below is expected to be REFUSED, so in the correct case this
   * row is never touched. `restoring()` exists for the incorrect case: if the
   * guard were broken, the test that discovered it must not also be the thing
   * that leaves Jojo Usafi without an Owner.
   */
  async function realOwner() {
    const { data, error } = await db
      .from("admin_profiles")
      .select("*")
      .eq("role", "owner")
      .eq("active", true)
      .not("email", "like", "zztest-%");

    expect(error).toBeNull();
    expect(data, "the real Owner must exist for these tests to mean anything").toHaveLength(1);
    return data![0];
  }

  /** Run an attempt that must fail, and undo it if it somehow did not. */
  async function restoring<T>(snapshot: AdminProfileRow, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } finally {
      const still = await db
        .from("admin_profiles")
        .select("id, role, active")
        .eq("id", snapshot.id)
        .maybeSingle();

      if (!still.data) {
        await db.from("admin_profiles").insert(snapshot);
      } else if (still.data.role !== "owner" || !still.data.active) {
        await db
          .from("admin_profiles")
          .update({ role: "owner", active: true })
          .eq("id", snapshot.id);
      }
    }
  }

  it("refuses to demote the last Owner", async () => {
    const owner = await realOwner();
    await restoring(owner, async () => {
      const error = errorOf(
        await db.from("admin_profiles").update({ role: "manager" }).eq("id", owner.id),
      );
      expect(isRefusedByTrigger(error)).toBe(true);
      expect(error.message).toContain("must always have one active Owner");
    });
  });

  it("refuses to deactivate the last Owner", async () => {
    const owner = await realOwner();
    await restoring(owner, async () => {
      const error = errorOf(
        await db.from("admin_profiles").update({ active: false }).eq("id", owner.id),
      );
      expect(isRefusedByTrigger(error)).toBe(true);
    });
  });

  it("refuses to delete the last Owner, even with the service-role key", async () => {
    const owner = await realOwner();
    await restoring(owner, async () => {
      const error = errorOf(await db.from("admin_profiles").delete().eq("id", owner.id));
      expect(isRefusedByTrigger(error)).toBe(true);
    });
  });

  it("allows an Owner to step down once somebody else is one", async () => {
    // A second Owner, so the guard has no reason to fire. The real Owner is
    // never the one demoted — that is the whole point of the guard.
    const second = await db
      .from("admin_profiles")
      .insert({
        full_name: "ZZTEST Second Owner",
        email: "zztest-owner2@jojo-usafi.test",
        role: "owner",
        active: true,
      })
      .select("id")
      .single();
    expect(second.error).toBeNull();

    const demoted = await db
      .from("admin_profiles")
      .update({ role: "manager" })
      .eq("id", second.data!.id)
      .select("role")
      .single();
    expect(demoted.error).toBeNull();
    expect(demoted.data?.role).toBe("manager");

    const removed = await db.from("admin_profiles").delete().eq("id", second.data!.id);
    expect(removed.error).toBeNull();

    // And the shop still has its Owner.
    await realOwner();
  });

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
        full_name: "ZZTEST Ghost",
        email: "zztest-ghost@jojo-usafi.test",
        role: "order_staff",
      }),
    );
    expect(error.code).toBe(PG.foreignKey);
  });

  it("keeps the profile, unlinked, when the login is deleted", async () => {
    const created = await db.auth.admin.createUser({
      email: "zztest-temp@jojo-usafi.test",
      password: "not-used-for-sign-in-12345",
      email_confirm: true,
    });
    expect(created.error).toBeNull();

    const profile = await db
      .from("admin_profiles")
      .insert({
        auth_user_id: created.data.user!.id,
        full_name: "ZZTEST Temporary Staff",
        email: "zztest-temp@jojo-usafi.test",
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
      full_name: "ZZTEST Temporary Staff",
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
