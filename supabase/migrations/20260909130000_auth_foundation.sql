-- =============================================================================
-- Jojo Usafi — 0009 Supabase Auth foundation
--
-- Build 05 authored `admin_profiles.auth_user_id` and `customers.auth_user_id`
-- as bare uuid columns so the schema stayed portable before a Supabase project
-- existed. A project exists now, so they become real foreign keys to auth.users.
--
-- This migration also adds the small set of functions that Row Level Security
-- asks the same questions through: who is calling, are they staff, what role do
-- they hold, and is this row something the public may see. Every one of them is
--
--     STABLE            so PostgreSQL evaluates it once per statement
--     SECURITY DEFINER  so a policy on `products` may consult `products`
--                       without re-entering its own policy
--     search_path fixed so it cannot be redirected by a caller's search_path
--
-- Roles are Owner / Manager / Order staff, matching src/lib/admin/permissions.ts.
-- NO STAFF ACCOUNT IS CREATED HERE. Migration 0012 provides the bootstrap.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The real link to Supabase Auth.
--
-- `on delete set null` rather than cascade, deliberately: deleting a login must
-- never delete the staff profile that the order timeline and the audit trail
-- name as the actor. The profile survives, unlinked, and can be deactivated.
-- -----------------------------------------------------------------------------

alter table public.admin_profiles
  add constraint admin_profiles_auth_user_fk
  foreign key (auth_user_id) references auth.users (id) on delete set null;

alter table public.customers
  add constraint customers_auth_user_fk
  foreign key (auth_user_id) references auth.users (id) on delete set null;

comment on column public.admin_profiles.auth_user_id is
  'The Supabase Auth login this staff member signs in with. Null means the profile exists but nobody can sign in as it.';

-- -----------------------------------------------------------------------------
-- Build 05 functions, hardened.
--
-- These are unchanged in behaviour. They are replaced only to pin search_path,
-- which stops a caller from resolving `now()` or a table name to something of
-- their own. `create or replace` keeps the OID, so the trigger attachments and
-- the `orders.order_number` default that point at them are undisturbed.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.jojo_forbid_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception
    'Table %.% is append-only; % is not permitted.',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

create or replace function public.jojo_guard_sku_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.sku is distinct from old.sku
     and exists (select 1 from public.order_items where sku = old.sku) then
    raise exception
      'SKU % has been used on an order and cannot be changed. Archive the product and create a new SKU instead.',
      old.sku
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create or replace function public.next_order_number()
returns text
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select 'JU-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- -----------------------------------------------------------------------------
-- Who is calling?
-- -----------------------------------------------------------------------------

-- The caller's staff role, or null if the caller is not active staff. Every
-- other staff question is asked through this one, so "what counts as staff" has
-- exactly one definition: an admin_profiles row, linked to this login, active.
create or replace function public.jojo_admin_role()
returns public.admin_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ap.role
  from public.admin_profiles ap
  where ap.auth_user_id = auth.uid()
    and ap.active
  limit 1;
$$;

comment on function public.jojo_admin_role() is
  'The signed-in staff member''s role, or null. SECURITY DEFINER so a policy on admin_profiles can call it without consulting its own policy.';

create or replace function public.jojo_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ap.id
  from public.admin_profiles ap
  where ap.auth_user_id = auth.uid()
    and ap.active
  limit 1;
$$;

create or replace function public.jojo_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jojo_admin_role() is not null;
$$;

create or replace function public.jojo_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jojo_admin_role() = 'owner';
$$;

-- Owner or Manager. This is the line the capability matrix draws around
-- everything an Order staff member may look at but not change: pricing, stock,
-- visibility, delivery zones, website content, reports.
create or replace function public.jojo_manages_catalogue()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jojo_admin_role() in ('owner', 'manager');
$$;

comment on function public.jojo_manages_catalogue() is
  'Owner or Manager. Mirrors the products.edit* / delivery.manage / website.manage capabilities in src/lib/admin/permissions.ts.';

-- The customer row belonging to the signed-in login, if there is one. Guest
-- checkout is the default and creates no login, so this is null for almost
-- everybody; it exists so that a customer who does make an account later sees
-- their own history and nobody else's.
create or replace function public.jojo_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.customers c
  where c.auth_user_id = auth.uid()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- What may the public see?
--
-- `product_shelf` already answers this for the storefront query. These repeat
-- the same predicate for Row Level Security, which has to decide row by row on
-- the tables underneath the view. The image requirement is deliberately NOT
-- repeated here: a policy on product_media cannot require the image to already
-- be visible in order to make the image visible.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_family_is_public(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_families f
    join public.brands b     on b.id = f.brand_id
    join public.categories c on c.id = f.category_id
    where f.id = p_family_id
      and f.lifecycle = 'active'
      and b.active
      and c.active
  );
$$;

create or replace function public.jojo_product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.products p
    join public.product_families f on f.id = p.family_id
    join public.brands b           on b.id = p.brand_id
    join public.categories c       on c.id = p.category_id
    where p.id = p_product_id
      and p.lifecycle = 'active'
      and p.storefront_visible
      and f.lifecycle = 'active'
      and b.active
      and c.active
  );
$$;

comment on function public.jojo_product_is_public(uuid) is
  'The product_shelf predicate minus the primary-image join, for row-level decisions on the tables the view reads.';

-- A photograph is public when a public product uses it, or when it is the logo
-- of an active brand. Nothing else in media_assets reaches a shopper.
create or replace function public.jojo_media_is_public(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_media pm
    where pm.media_id = p_media_id
      and public.jojo_product_is_public(pm.product_id)
  ) or exists (
    select 1
    from public.brands b
    where b.logo_media_id = p_media_id
      and b.active
  );
$$;

-- Does this order belong to the signed-in customer? Used by orders, order_items
-- and order_events so the answer is written once.
create or replace function public.jojo_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.customer_id is not null
      and o.customer_id = public.jojo_customer_id()
  );
$$;

-- -----------------------------------------------------------------------------
-- Execution rights.
--
-- These answer questions about the caller and about public visibility only, so
-- they are safe to expose. PostgREST publishes them as RPCs; each one returns a
-- boolean, a role or an id that the caller is already entitled to know.
-- -----------------------------------------------------------------------------

grant execute on function public.jojo_admin_role()              to anon, authenticated;
grant execute on function public.jojo_admin_id()                to anon, authenticated;
grant execute on function public.jojo_is_staff()                to anon, authenticated;
grant execute on function public.jojo_is_owner()                to anon, authenticated;
grant execute on function public.jojo_manages_catalogue()       to anon, authenticated;
grant execute on function public.jojo_customer_id()             to anon, authenticated;
grant execute on function public.jojo_family_is_public(uuid)    to anon, authenticated;
grant execute on function public.jojo_product_is_public(uuid)   to anon, authenticated;
grant execute on function public.jojo_media_is_public(uuid)     to anon, authenticated;
grant execute on function public.jojo_owns_order(uuid)          to anon, authenticated;

-- -----------------------------------------------------------------------------
-- There must always be an Owner.
--
-- Build 05 left this as a comment on the column, to be added once there was a
-- database to test it against. A shop that has locked itself out of staff
-- management has no way back except a developer with the service-role key.
--
-- The guard fires on the LAST active Owner only: demoting one of two Owners is
-- ordinary, demoting the only one is not.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_guard_last_owner()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  was_active_owner boolean;
  still_active_owner boolean;
  others integer;
begin
  was_active_owner := (old.role = 'owner' and old.active);

  if not was_active_owner then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  still_active_owner := (tg_op = 'UPDATE' and new.role = 'owner' and new.active);

  if still_active_owner then
    return new;
  end if;

  select count(*) into others
  from public.admin_profiles
  where role = 'owner' and active and id <> old.id;

  if others = 0 then
    raise exception
      'Jojo Usafi must always have one active Owner. Make somebody else an Owner first, then change this account.'
      using errcode = 'restrict_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger admin_profiles_last_owner
  before update or delete on public.admin_profiles
  for each row execute function public.jojo_guard_last_owner();

comment on column public.admin_profiles.role is
  'Owner / Manager / Order staff. The last active Owner cannot be demoted, deactivated or deleted — trigger admin_profiles_last_owner.';
