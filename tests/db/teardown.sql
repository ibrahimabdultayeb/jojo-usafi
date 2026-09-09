-- =============================================================================
-- Remove every ZZTEST fixture from the development database.
--
-- Run through the Supabase CLI (`supabase db query --linked`), as `postgres`,
-- NOT through PostgREST — because four of these tables cannot be cleaned up any
-- other way. `order_events`, `inventory_movements`, `audit_events` and
-- `analytics_events` carry the `jojo_forbid_mutation` trigger, which refuses
-- DELETE from everyone including the service role. That is the correct
-- behaviour in production and the reason this file has to disable the triggers
-- around itself.
--
-- The same is true of `admin_profiles_last_owner`: a test that has just proved
-- the last Owner cannot be deleted then has to delete it.
--
-- Note what this implies and what the tests assert: because order_events
-- cascades from orders and then refuses the cascade, AN ORDER WITH HISTORY
-- CANNOT BE DELETED THROUGH THE API AT ALL. History is permanent. That is by
-- design; it is recorded here because it is surprising the first time.
--
-- Everything below is matched by pattern, so a fixture left behind by a crashed
-- run is still found.
-- =============================================================================

alter table public.order_events        disable trigger order_events_append_only;
alter table public.inventory_movements disable trigger inventory_movements_append_only;
alter table public.audit_events        disable trigger audit_events_append_only;
alter table public.analytics_events    disable trigger analytics_events_append_only;
alter table public.admin_profiles      disable trigger admin_profiles_last_owner;

-- ---- measurement and audit --------------------------------------------------
delete from public.analytics_events
 where session_id like 'zztest%' or sku like 'ZZTEST%';

delete from public.audit_events
 where entity_key ilike 'zztest%'
    or action = 'admin_profile.first_owner_claimed';

-- ---- synchronisation --------------------------------------------------------
delete from public.sync_conflicts where entity_key ilike 'zztest%';
delete from public.sync_events    where entity_key ilike 'zztest%';
delete from public.sync_state     where entity_key ilike 'zztest%';
delete from public.sync_jobs      where idempotency_key ilike 'zztest%';

-- ---- stock ledger, before the products it points at -------------------------
delete from public.inventory_movements
 where product_id in (select id from public.products where sku like 'ZZTEST%');

-- ---- orders -----------------------------------------------------------------
delete from public.order_events
 where order_id in (select id from public.orders where customer_phone_e164 like '+2557000000%');

delete from public.order_items
 where order_id in (select id from public.orders where customer_phone_e164 like '+2557000000%');

delete from public.orders
 where customer_phone_e164 like '+2557000000%';

-- ---- product-shaped rows ----------------------------------------------------
delete from public.inventory
 where product_id in (select id from public.products where sku like 'ZZTEST%');

delete from public.product_option_assignments
 where product_id in (select id from public.products where sku like 'ZZTEST%');

delete from public.product_media
 where product_id in (select id from public.products where sku like 'ZZTEST%');

delete from public.product_content
 where product_id in (select id from public.products where sku like 'ZZTEST%');

delete from public.products where sku like 'ZZTEST%';

delete from public.product_family_axes
 where family_id in (select id from public.product_families where code like 'ZZTEST%');

delete from public.product_families where code like 'ZZTEST%';
delete from public.product_option_values where code like 'zztest%';
delete from public.media_assets where storage_path like 'zztest/%';

-- ---- catalogue scaffolding --------------------------------------------------
delete from public.category_content
 where category_id in (select id from public.categories where code like 'ZZTEST%');

delete from public.categories where code like 'ZZTEST%';
delete from public.brands     where code like 'ZZTEST%';
delete from public.suppliers  where code like 'ZZTEST%';

-- ---- people and places ------------------------------------------------------
delete from public.customer_addresses
 where customer_id in (select id from public.customers where phone_e164 like '+2557000000%');

delete from public.customers      where phone_e164 like '+2557000000%';
delete from public.delivery_zones where slug like 'zztest-%';

-- ---- staff ------------------------------------------------------------------
-- The logins themselves are removed through the Auth admin API by the global
-- setup; `auth_user_id` is `on delete set null`, so the order does not matter.
delete from public.admin_profiles where email ilike 'zztest-%';

alter table public.order_events        enable trigger order_events_append_only;
alter table public.inventory_movements enable trigger inventory_movements_append_only;
alter table public.audit_events        enable trigger audit_events_append_only;
alter table public.analytics_events    enable trigger analytics_events_append_only;
alter table public.admin_profiles      enable trigger admin_profiles_last_owner;

-- What should be left: the reference data the migrations themselves insert.
select
  (select count(*) from public.products)        as products_left,
  (select count(*) from public.orders)          as orders_left,
  (select count(*) from public.customers)       as customers_left,
  (select count(*) from public.admin_profiles)  as staff_left,
  (select count(*) from public.locales)         as locales,
  (select count(*) from public.pack_types)      as pack_types;
