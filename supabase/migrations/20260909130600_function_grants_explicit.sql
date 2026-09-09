-- =============================================================================
-- Jojo Usafi — 0015 Say who may execute each function, and mean it
--
-- Migration 0014 revoked EXECUTE on the staff-identity functions from `anon`,
-- and `npm run test:db` then showed an anonymous caller executing them anyway.
--
-- The reason is the oldest trap in PostgreSQL privileges. A function's default
-- ACL grants EXECUTE to PUBLIC, and it appears in `proacl` with an EMPTY
-- grantee — the `=X/postgres` at the front of
--
--     {=X/postgres,postgres=X/postgres,authenticated=X/postgres}
--
-- `anon` was never executing these through a grant of its own. It was executing
-- them as a member of PUBLIC, which is everybody, and revoking a privilege
-- somebody does not hold changes nothing.
--
-- Two things worth keeping from that:
--
--   * a REVOKE that appears to do nothing is a signal, not a formality. The
--     only reason this was caught is that a test asked the database rather than
--     reading the migration and believing it.
--   * `revoke ... from anon` is not the same as `revoke ... from public`, and
--     for a function it is almost never the one you want.
--
-- So this migration stops subtracting and starts stating. Every function is
-- taken away from PUBLIC and then handed to exactly the roles that need it,
-- which also means the ACL is now readable as a policy rather than as the
-- residue of three migrations.
--
-- The trigger functions — jojo_set_updated_at, jojo_forbid_mutation,
-- jojo_guard_sku_immutability, jojo_guard_last_owner — are deliberately left
-- alone. They return `trigger`, so PostgREST does not publish them and there is
-- nothing to reach; and EXECUTE on a trigger function is checked when the
-- trigger is created, not each time it fires, so revoking it would be a change
-- with no benefit and a non-obvious risk.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Who is the caller? — signed-in logins only.
--
-- The admin dashboard asks these to decide which screens and controls to draw.
-- An anonymous shopper has no staff identity to report, and no policy that
-- applies to `anon` consults any of them.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_admin_role()        from public, anon;
revoke execute on function public.jojo_admin_id()          from public, anon;
revoke execute on function public.jojo_is_staff()          from public, anon;
revoke execute on function public.jojo_is_owner()          from public, anon;
revoke execute on function public.jojo_manages_catalogue() from public, anon;
revoke execute on function public.jojo_customer_id()       from public, anon;
revoke execute on function public.jojo_owns_order(uuid)    from public, anon;

grant execute on function public.jojo_admin_role()        to authenticated;
grant execute on function public.jojo_admin_id()          to authenticated;
grant execute on function public.jojo_is_staff()          to authenticated;
grant execute on function public.jojo_is_owner()          to authenticated;
grant execute on function public.jojo_manages_catalogue() to authenticated;
grant execute on function public.jojo_customer_id()       to authenticated;
grant execute on function public.jojo_owns_order(uuid)    to authenticated;


-- -----------------------------------------------------------------------------
-- What may the public see? — everyone, because the storefront runs on it.
--
-- These are the predicates the `*_public_read` policies evaluate while an
-- anonymous shopper reads the shelf. Each returns one boolean about whether a
-- row is already public, so being able to call them reveals nothing that
-- reading the shelf would not.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_family_is_public(uuid)  from public;
revoke execute on function public.jojo_product_is_public(uuid) from public;
revoke execute on function public.jojo_media_is_public(uuid)   from public;

grant execute on function public.jojo_family_is_public(uuid)  to anon, authenticated;
grant execute on function public.jojo_product_is_public(uuid) to anon, authenticated;
grant execute on function public.jojo_media_is_public(uuid)   to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Has the shop been set up? — everyone, including before anyone can sign in.
--
-- The admin dashboard's setup screen has to choose between "claim the Owner
-- account" and "sign in" while nobody is signed in. It reveals whether an Owner
-- exists and never who.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_owner_exists() from public;
grant  execute on function public.jojo_owner_exists() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- The bootstrap and the order sequence were already explicit in 0012 and 0014,
-- because both were written with `from public` in the revoke. Restated so this
-- file is the complete picture.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_claim_first_owner(text) from public, anon;
grant  execute on function public.jojo_claim_first_owner(text) to authenticated;

revoke execute on function public.next_order_number() from public, anon, authenticated;
grant  execute on function public.next_order_number() to service_role;
