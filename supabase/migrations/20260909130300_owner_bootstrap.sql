-- =============================================================================
-- Jojo Usafi — 0012 The first Owner
--
-- A chicken-and-egg problem: only an Owner may create staff (policy
-- admin_profiles_owner_insert), and there is no Owner. Something has to make
-- the first one.
--
-- The options were:
--
--   a) seed an Owner in SQL         — needs a real person's email in a file
--                                     that goes into Git, and a password
--                                     somewhere worse
--   b) run a script with the        — works, but makes the service-role key a
--      service-role key               routine tool, and every use of it is a
--                                     use that bypasses RLS entirely
--   c) let the first signed-in      — chosen
--      account claim the seat,
--      exactly once, ever
--
-- The flow is:
--
--   1. Ibrahim signs up through Supabase Auth like any other user.
--   2. He calls jojo_claim_first_owner('Ibrahim Abdul Tayeb').
--   3. The seat is taken. Every later call raises, for everyone, forever.
--
-- No password is ever typed into a file, a migration or a document. Nothing has
-- to be deleted afterwards. The function stays in place because "is the seat
-- taken?" is a question the admin dashboard's setup screen needs to ask.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Has the shop been set up? Safe to ask before signing in — the admin dashboard
-- needs it to decide between the setup screen and the sign-in screen. It reveals
-- only whether an Owner exists, never who.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles where role = 'owner' and active
  );
$$;

grant execute on function public.jojo_owner_exists() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Claim the Owner seat for the signed-in account.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_claim_first_owner(p_full_name text default null)
returns public.admin_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_name    text;
  v_profile public.admin_profiles;
begin
  if v_uid is null then
    raise exception
      'Sign in first. This claims the Owner account for whoever is signed in.'
      using errcode = 'invalid_authorization_specification';
  end if;

  -- Two people pressing the button at the same moment must not produce two
  -- Owners. The lock is held to the end of this transaction, so the existence
  -- check below and the insert cannot be interleaved.
  perform pg_advisory_xact_lock(hashtext('jojo_claim_first_owner'));

  if exists (select 1 from public.admin_profiles where role = 'owner' and active) then
    raise exception
      'Jojo Usafi already has an Owner. Ask the Owner to add you as staff instead.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from public.admin_profiles where auth_user_id = v_uid) then
    raise exception
      'This account already has a staff profile. Ask the Owner to change your role.'
      using errcode = 'unique_violation';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  if v_email is null or length(btrim(v_email)) = 0 then
    raise exception
      'This account has no email address, so it cannot be the Owner.'
      using errcode = 'not_null_violation';
  end if;

  if exists (select 1 from public.admin_profiles where email = v_email::citext) then
    raise exception
      'A staff profile already uses %. Sign in as that account, or ask for it to be removed first.',
      v_email
      using errcode = 'unique_violation';
  end if;

  -- The email's local part is a poor name, but it is a true one. It is only
  -- used when the caller supplies nothing better, and the Owner can change it.
  v_name := coalesce(nullif(btrim(p_full_name), ''), split_part(v_email, '@', 1));

  insert into public.admin_profiles
    (auth_user_id, full_name, email, role, active, invited_at, last_seen_at)
  values
    (v_uid, v_name, v_email::citext, 'owner', true, now(), now())
  returning * into v_profile;

  -- The first entry in the audit trail is the creation of the person who will
  -- appear in the rest of it.
  insert into public.audit_events
    (action, entity_table, entity_id, entity_key,
     actor_type, actor_admin_id, actor_label, source, after_data)
  values
    ('admin_profile.first_owner_claimed', 'admin_profiles', v_profile.id, v_email,
     'staff', v_profile.id, v_name, 'admin',
     jsonb_build_object('role', 'owner', 'auth_user_id', v_uid));

  return v_profile;
end;
$$;

comment on function public.jojo_claim_first_owner(text) is
  'One-time bootstrap: gives the signed-in account the Owner seat, if and only if no active Owner exists. Raises for every caller afterwards.';

-- Not callable by a stranger who has not signed in, and not by the server as a
-- convenience either — auth.uid() is null there, so it would raise anyway.
revoke all    on function public.jojo_claim_first_owner(text) from public, anon;
grant  execute on function public.jojo_claim_first_owner(text) to authenticated;
