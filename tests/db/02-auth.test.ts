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

import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, errorOf, isRefusedByTrigger, PG, serviceClient, signIn } from "./support";
import { EMAIL, ID, ensureOwnerProfile, loginIds } from "./fixtures";

const db = serviceClient();

describe("the shop starts with no Owner", () => {
  it("reports that nobody has taken the seat", async () => {
    const { data, error } = await anonClient().rpc("jojo_owner_exists");
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("refuses to let a stranger who has not signed in claim it", async () => {
    const error = errorOf(
      await anonClient().rpc("jojo_claim_first_owner", { p_full_name: "Impostor" }),
    );
    // The grant is revoked from anon, so this never reaches the function body.
    expect(error.code).toBe(PG.insufficientPrivilege);
  });
});

describe("the first Owner claims the seat, exactly once", () => {
  it("gives the seat to the signed-in account", async () => {
    const owner = await signIn(EMAIL.owner);
    const { data, error } = await owner.rpc("jojo_claim_first_owner", {
      p_full_name: "ZZTEST Owner",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      full_name: "ZZTEST Owner",
      email: EMAIL.owner,
      role: "owner",
      active: true,
    });
  });

  it("records the claim in the audit trail", async () => {
    const { data, error } = await db
      .from("audit_events")
      .select("action, entity_table, entity_key, actor_type")
      .eq("action", "admin_profile.first_owner_claimed")
      .eq("entity_key", EMAIL.owner);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ entity_table: "admin_profiles", actor_type: "staff" });
  });

  it("now reports that the seat is taken", async () => {
    const { data } = await anonClient().rpc("jojo_owner_exists");
    expect(data).toBe(true);
  });

  it("refuses a second claim from the same account", async () => {
    const owner = await signIn(EMAIL.owner);
    const error = errorOf(await owner.rpc("jojo_claim_first_owner", { p_full_name: "Again" }));
    expect(error.message).toContain("already has an Owner");
  });

  it("refuses a claim from anybody else, signed in or not", async () => {
    const stranger = await signIn(EMAIL.nobody);
    const error = errorOf(
      await stranger.rpc("jojo_claim_first_owner", { p_full_name: "Opportunist" }),
    );
    expect(error.message).toContain("already has an Owner");

    const { data } = await db.from("admin_profiles").select("id").eq("email", EMAIL.nobody);
    expect(data).toEqual([]);
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
  beforeAll(ensureOwnerProfile);

  async function soleOwnerId(): Promise<string> {
    const { data } = await db
      .from("admin_profiles")
      .select("id")
      .eq("role", "owner")
      .eq("active", true);
    expect(data).toHaveLength(1);
    return data![0].id;
  }

  it("refuses to demote the last Owner", async () => {
    const id = await soleOwnerId();
    const error = errorOf(await db.from("admin_profiles").update({ role: "manager" }).eq("id", id));
    expect(isRefusedByTrigger(error)).toBe(true);
    expect(error.message).toContain("must always have one active Owner");
  });

  it("refuses to deactivate the last Owner", async () => {
    const id = await soleOwnerId();
    const error = errorOf(await db.from("admin_profiles").update({ active: false }).eq("id", id));
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("refuses to delete the last Owner, even with the service-role key", async () => {
    const id = await soleOwnerId();
    const error = errorOf(await db.from("admin_profiles").delete().eq("id", id));
    expect(isRefusedByTrigger(error)).toBe(true);
  });

  it("allows an Owner to step down once somebody else is one", async () => {
    const first = await soleOwnerId();

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
      .eq("id", first)
      .select("role")
      .single();
    expect(demoted.error).toBeNull();
    expect(demoted.data?.role).toBe("manager");

    // Put the shop back the way it was.
    await db.from("admin_profiles").update({ role: "owner" }).eq("id", first);
    const removed = await db.from("admin_profiles").delete().eq("id", second.data!.id);
    expect(removed.error).toBeNull();
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
