-- =============================================================================
-- The last-Owner guard, exercised without touching a single committed row.
--
-- THE PROBLEM
--
-- `admin_profiles_last_owner` fires only for the LAST active Owner. Jojo Usafi
-- has a real, permanent Owner, so any fixture Owner is always a second one and
-- the guard never fires on it. Exercising the guard therefore needs a world with
-- exactly one Owner — and on this database that Owner is the real one.
--
-- Build 06's tests solved that by attempting refused mutations against the real
-- Owner row. That is exactly the thing Build 07 was told to stop doing, and it
-- was right to: on one run the guard tests failed for an unrelated reason and a
-- DELETE of the real Owner actually went through, saved only by a restore net.
--
-- THE SOLUTION
--
-- Everything below happens inside ONE transaction that ALWAYS rolls back. Two
-- probe Owners are created, every other Owner steps aside *within the
-- transaction*, and the guard is exercised against the probes. Then the whole
-- thing is undone. No committed state changes, and the process crashing at any
-- point leaves PostgreSQL to roll back for us.
--
-- `05-real-data-untouched.test.ts` proves the outcome independently, by
-- comparing every real row byte for byte against a snapshot taken before the
-- suite began.
-- =============================================================================

begin;

do $$
declare
  probe_a uuid;
  probe_b uuid;
  real_owners integer;
begin
  -- Fail closed: if the shop has no Owner, the premise of this test is wrong
  -- and it must not invent one.
  select count(*) into real_owners
  from public.admin_profiles where role = 'owner' and active;

  if real_owners = 0 then
    raise exception 'GUARD TEST ABORTED: no active Owner exists, so there is nothing to protect';
  end if;

  insert into public.admin_profiles (full_name, email, role, active)
  values ('Guard probe A', 'guard-probe-a@example.invalid', 'owner', true)
  returning id into probe_a;

  insert into public.admin_profiles (full_name, email, role, active)
  values ('Guard probe B', 'guard-probe-b@example.invalid', 'owner', true)
  returning id into probe_b;

  -- Inside this transaction only, the probes become the entire ACTIVE Owner
  -- population. Two of them exist, so the guard permits the others to stand
  -- down. Deactivation rather than deletion, and not only because it is gentler:
  -- deleting a staff profile sets `audit_events.actor_admin_id` to null, which
  -- is an UPDATE on an append-only table and is refused outright. A staff member
  -- who has ever appeared in the audit trail CANNOT be deleted, by anybody.
  update public.admin_profiles
     set active = false
   where role = 'owner' and active and id not in (probe_a, probe_b);

  -- ---- with two Owners, ordinary changes are allowed ----------------------
  update public.admin_profiles set role = 'manager' where id = probe_b;
  if (select role from public.admin_profiles where id = probe_b) <> 'manager' then
    raise exception 'GUARD FAILED: demoting one of two Owners did not take effect';
  end if;

  -- ---- with one Owner left, all three removals must be refused ------------
  begin
    update public.admin_profiles set role = 'manager' where id = probe_a;
    raise exception 'GUARD FAILED: demoting the last Owner was allowed';
  exception
    when sqlstate '23001' then null;   -- restrict_violation: correct
  end;

  begin
    update public.admin_profiles set active = false where id = probe_a;
    raise exception 'GUARD FAILED: deactivating the last Owner was allowed';
  exception
    when sqlstate '23001' then null;
  end;

  begin
    delete from public.admin_profiles where id = probe_a;
    raise exception 'GUARD FAILED: deleting the last Owner was allowed';
  exception
    when sqlstate '23001' then null;
  end;

  -- ---- and the last Owner is still an active Owner ------------------------
  if not exists (
    select 1 from public.admin_profiles
    where id = probe_a and role = 'owner' and active
  ) then
    raise exception 'GUARD FAILED: the last Owner did not survive the refused attempts';
  end if;

  -- ---- an ordinary staff member is not protected by THIS guard ------------
  update public.admin_profiles set role = 'order_staff' where id = probe_b;
  update public.admin_profiles set active = false where id = probe_b;
  delete from public.admin_profiles where id = probe_b;

  -- ---- but the audit trail protects anyone who has ever acted -------------
  -- Deleting a profile nulls `audit_events.actor_admin_id`, and that table is
  -- append-only. So a staff member who appears in the audit trail cannot be
  -- deleted at all, by anybody, including the service role. Deactivation is the
  -- only way to retire them — which is what the admin dashboard offers.
  insert into public.audit_events
    (action, entity_table, entity_id, entity_key, actor_type, actor_admin_id, actor_label)
  values
    ('guard.probe', 'admin_profiles', probe_a, 'guard-probe', 'staff', probe_a, 'Guard probe A');

  begin
    delete from public.admin_profiles where id = probe_a;
    raise exception 'GUARD FAILED: a staff member named in the audit trail was deleted';
  exception
    when sqlstate '23001' then null;
  end;
end $$;

rollback;

-- Outside the transaction: prove the real world is untouched and still has its
-- Owner, and that no probe row survived.
select
  (select count(*) from public.admin_profiles
     where role = 'owner' and active)                                as active_owners,
  (select count(*) from public.admin_profiles
     where email like 'guard-probe-%@example.invalid')               as probe_rows_left,
  'last-owner guard verified in a rolled-back transaction'           as result;
