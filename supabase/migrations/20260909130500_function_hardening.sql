-- =============================================================================
-- Jojo Usafi — 0014 Two corrections found by running the tests
--
-- Both of these were found by `npm run test:db` against the real database, which
-- is the whole argument for having it.
--
-- 1. A THREE-VALUED ANSWER TO A YES/NO QUESTION
--
--    `jojo_manages_catalogue()` was `jojo_admin_role() in ('owner','manager')`.
--    For a caller with no staff profile, `jojo_admin_role()` is NULL, and
--    `NULL in (...)` is NULL — not false. The same was true of
--    `jojo_is_owner()`, which was `jojo_admin_role() = 'owner'`.
--
--    This was never a security hole: a policy whose USING expression evaluates
--    to NULL denies the row exactly as false does, so no unauthorised access was
--    ever possible. It is a correctness problem one layer up. The admin
--    dashboard asks these questions directly to decide which controls to render,
--    and `null` is not `false` in TypeScript either — `data === false` would be
--    wrong for a signed-in shopper, and the wrong branch of that comparison
--    shows an Owner's controls to somebody who is not staff at all.
--
--    A function named like a question must answer the question.
--
-- 2. FUNCTIONS OFFERED TO CALLERS WHO HAVE NO USE FOR THEM
--
--    Everything in `public` is published by PostgREST as an RPC. Supabase's own
--    security advisor flags each SECURITY DEFINER function reachable by `anon`,
--    and it is right to: a shopper who has not signed in has no business asking
--    `jojo_admin_role()`, and `next_order_number()` is worse than pointless in a
--    stranger's hands — every call burns a real order number off the sequence.
--
--    Only the functions an anonymous shopper genuinely needs stay reachable:
--    the three public-visibility predicates that the storefront's own policies
--    evaluate, and `jojo_owner_exists()`, which the admin setup screen must ask
--    before anybody can possibly be signed in.
--
-- NOT DONE, DELIBERATELY: the advisor also flags `citext` being installed in
-- `public` rather than `extensions`. It is left where it is. The `anon`,
-- `authenticated` and `service_role` roles have no `search_path` setting of
-- their own, so they resolve names through the database default of
-- `"$user", public` — `extensions` is on `postgres`'s path and nobody else's.
-- Moving 47 citext functions out of `public` would therefore risk every email
-- comparison on `customers.email` and `admin_profiles.email` resolving to no
-- operator, to remove a small amount of published surface. The safe order is to
-- put `extensions` on the API roles' search_path first, prove email lookups
-- still work, and only then move the extension. That is a change worth making
-- on its own, with its own test, not as a footnote to this one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Yes or no, never null.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.jojo_admin_role() = 'owner', false);
$$;

create or replace function public.jojo_manages_catalogue()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.jojo_admin_role() in ('owner', 'manager'), false);
$$;

comment on function public.jojo_is_owner() is
  'Is the caller an active Owner? False for everyone else, including a caller with no staff profile at all — never null.';

comment on function public.jojo_manages_catalogue() is
  'Owner or Manager. False for Order staff, for signed-in shoppers and for strangers — never null. Mirrors the products.edit* / delivery.manage / website.manage capabilities in src/lib/admin/permissions.ts.';


-- -----------------------------------------------------------------------------
-- 2. Reachable only by callers who need them.
--
-- These stay open to `anon`, because the storefront cannot work without them:
--
--   jojo_product_is_public / jojo_family_is_public / jojo_media_is_public
--       evaluated by the `*_public_read` policies that a shopper's own query
--       triggers
--   jojo_owner_exists
--       asked by the admin setup screen before there is anybody to sign in as
--
-- Everything else describes the caller's staff identity, which an anonymous
-- caller does not have, and no policy that applies to `anon` consults.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_admin_role()        from anon;
revoke execute on function public.jojo_admin_id()          from anon;
revoke execute on function public.jojo_is_staff()          from anon;
revoke execute on function public.jojo_is_owner()          from anon;
revoke execute on function public.jojo_manages_catalogue() from anon;
revoke execute on function public.jojo_customer_id()       from anon;
revoke execute on function public.jojo_owns_order(uuid)    from anon;

-- `create or replace` preserves an existing function's privileges, so the two
-- rewritten above kept theirs. Stated anyway, so that this migration describes
-- the end state on its own rather than by reference to migration 0009.
grant execute on function public.jojo_is_owner()          to authenticated;
grant execute on function public.jojo_manages_catalogue() to authenticated;

-- Order numbers are a finite, public-facing, monotonic resource: JU-000128 is
-- printed on a receipt and quoted down a phone. `next_order_number()` is used
-- as the DEFAULT on orders.order_number, and a DEFAULT is evaluated as the role
-- doing the insert — which is only ever the server. Nobody else may call it and
-- skip the shop's numbering forward.
revoke execute on function public.next_order_number() from public, anon, authenticated;
grant  execute on function public.next_order_number() to service_role;
