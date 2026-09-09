-- =============================================================================
-- Jojo Usafi — 0010 Row Level Security policies
--
-- Build 05 enabled RLS on all 30 tables and wrote no policies, which denied the
-- anon and authenticated roles everything. This migration opens the specific
-- doors, and nothing else.
--
-- There are four callers:
--
--   anon           a shopper who has not signed in. This is almost everybody,
--                  because guest checkout is the default and stays the default.
--   authenticated  a signed-in login. Either a customer with an account, or a
--                  staff member — `admin_profiles` decides which.
--   staff          Owner / Manager / Order staff, via public.jojo_admin_role().
--   service_role   the server. Bypasses RLS entirely and is read only by
--                  src/lib/supabase/admin.ts, which is `server-only`.
--
-- Two rules shape everything below.
--
-- 1. THE STOREFRONT READS, IT DOES NOT WRITE. No order, customer or stock row
--    is ever written by a browser. Checkout is a server action holding the
--    service-role key, so it can validate the cart, price it from the database
--    rather than from the request, reserve stock and write the order and its
--    first event in one transaction. There is therefore no `anon insert` policy
--    on orders, and that is deliberate rather than missing.
--
-- 2. GRANTS ARE THE SECOND LOCK. RLS decides which ROWS; a grant decides which
--    COLUMNS and which verbs. Order staff may advance an order, so they hold
--    UPDATE on orders — but only on the operational columns, so no staff token
--    can rewrite a price, a total or the customer's phone number.
-- =============================================================================


-- =============================================================================
-- PART 1 — Grants: the verbs and columns each role holds at all
--
-- CORRECTED BY MIGRATION 0013 — READ THIS BEFORE BELIEVING THE COMMENTS BELOW.
--
-- This part was written believing that Supabase's default privileges give anon
-- and authenticated full DML on every new table in `public`, leaving RLS as the
-- only lock, so that the job here was to REVOKE the excess.
--
-- That is not true of this project. Its default privileges grant no SELECT, no
-- INSERT, no UPDATE and no DELETE to anon, authenticated OR service_role, so
-- these revokes mostly removed privileges that were never held, and the schema
-- was briefly one that nothing could read or write at all. Migration 0013
-- grants the verbs each role actually needs and explains the discovery in full.
--
-- The statements below are left exactly as they were applied. They are still
-- correct as intent — anon does not write, nobody deletes, staff cannot touch an
-- order's money — and 0013 keeps every one of those properties. Only the
-- reasoning in this comment was wrong.
-- =============================================================================

-- A shopper reads. The single exception is storefront measurement, below.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Nobody deletes through the API. The admin dashboard has no delete control
-- anywhere by design — a product is archived, a staff member is deactivated, a
-- stock mistake is corrected by a compensating movement. Removing a row is a
-- service-role operation, done deliberately, on the server.
revoke delete, truncate on all tables in schema public from authenticated;

-- Storefront measurement is the one thing a browser may write. The policy below
-- restricts it to browsing events that claim no customer and no order.
grant insert on public.analytics_events to anon;

-- Stock: a shopper may learn that something is available, and nothing else
-- about the shelf. Column-level, because RLS cannot restrict columns.
revoke select on public.inventory from anon;
grant  select (product_id, location_code, available) on public.inventory to anon;

-- Orders: staff advance them, so staff hold UPDATE — on the operational columns
-- only. Money, the customer snapshot and the delivery snapshot are historical
-- record and are writable by the server alone.
revoke update on public.orders from authenticated;
grant  update (
         state,
         payment_status, payment_method, payment_reference, paid_at,
         cancellation_reason, delivery_failure_reason,
         confirmed_at, preparing_at, dispatched_at,
         completed_at, cancelled_at, failed_at,
         whatsapp_opened_at,
         staff_note
       ) on public.orders to authenticated;

-- The views. `product_shelf` is the storefront's read; `inventory_ledger_check`
-- is an internal reconciliation and never leaves the building.
grant  select on public.product_shelf to anon, authenticated;
revoke all    on public.inventory_ledger_check from anon;
grant  select on public.inventory_ledger_check to authenticated;


-- =============================================================================
-- PART 2 — Catalogue
--
-- The public read policies below are the same predicate `product_shelf` uses,
-- applied row by row to the tables underneath it. The view is security_invoker,
-- so a shopper reading the shelf is really reading these tables under these
-- policies — there is one definition of "on the shelf", not two.
-- =============================================================================

-- ---- locales ----------------------------------------------------------------
create policy locales_public_read on public.locales
  for select to anon, authenticated
  using (active);

create policy locales_owner_insert on public.locales
  for insert to authenticated
  with check ((select public.jojo_is_owner()));

create policy locales_owner_update on public.locales
  for update to authenticated
  using ((select public.jojo_is_owner()))
  with check ((select public.jojo_is_owner()));

-- ---- pack_types -------------------------------------------------------------
create policy pack_types_public_read on public.pack_types
  for select to anon, authenticated
  using (true);

create policy pack_types_manager_insert on public.pack_types
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy pack_types_manager_update on public.pack_types
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- suppliers --------------------------------------------------------------
-- No public read at all. Who supplies Jojo Usafi, and on what contact terms, is
-- commercial information; Order staff have no reason to see it either.
create policy suppliers_manager_read on public.suppliers
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

create policy suppliers_manager_insert on public.suppliers
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy suppliers_manager_update on public.suppliers
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- brands -----------------------------------------------------------------
create policy brands_public_read on public.brands
  for select to anon, authenticated
  using (active);

create policy brands_staff_read on public.brands
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy brands_manager_insert on public.brands
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy brands_manager_update on public.brands
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- categories -------------------------------------------------------------
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (active);

create policy categories_staff_read on public.categories
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy categories_manager_insert on public.categories
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy categories_manager_update on public.categories
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- media_assets -----------------------------------------------------------
-- A photograph is public when a public product uses it, or it is an active
-- brand's logo. An unapproved or withheld product's photograph is not readable,
-- which is the database half of "no product is given another SKU's photograph".
create policy media_assets_public_read on public.media_assets
  for select to anon, authenticated
  using ((select public.jojo_media_is_public(id)));

create policy media_assets_staff_read on public.media_assets
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy media_assets_manager_insert on public.media_assets
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy media_assets_manager_update on public.media_assets
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_families -------------------------------------------------------
create policy product_families_public_read on public.product_families
  for select to anon, authenticated
  using (lifecycle = 'active' and (select public.jojo_family_is_public(id)));

create policy product_families_staff_read on public.product_families
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy product_families_manager_insert on public.product_families
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_families_manager_update on public.product_families
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_option_axes / values -------------------------------------------
-- The variant vocabulary is small, public and useless on its own: "Size",
-- "Scent", "5LT", "Lemon Fresh". The chooser on a product page needs it.
create policy product_option_axes_public_read on public.product_option_axes
  for select to anon, authenticated
  using (true);

create policy product_option_axes_manager_insert on public.product_option_axes
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_option_axes_manager_update on public.product_option_axes
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

create policy product_option_values_public_read on public.product_option_values
  for select to anon, authenticated
  using (true);

create policy product_option_values_manager_insert on public.product_option_values
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_option_values_manager_update on public.product_option_values
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_family_axes ----------------------------------------------------
create policy product_family_axes_public_read on public.product_family_axes
  for select to anon, authenticated
  using ((select public.jojo_family_is_public(family_id)));

create policy product_family_axes_staff_read on public.product_family_axes
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy product_family_axes_manager_insert on public.product_family_axes
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_family_axes_manager_update on public.product_family_axes
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- products ---------------------------------------------------------------
-- `lifecycle` and `storefront_visible` are repeated outside the function so the
-- planner can discard most rows on the index before calling it.
create policy products_public_read on public.products
  for select to anon, authenticated
  using (
    lifecycle = 'active'
    and storefront_visible
    and (select public.jojo_product_is_public(id))
  );

create policy products_staff_read on public.products
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy products_manager_insert on public.products
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy products_manager_update on public.products
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_option_assignments ---------------------------------------------
create policy product_option_assignments_public_read on public.product_option_assignments
  for select to anon, authenticated
  using ((select public.jojo_product_is_public(product_id)));

create policy product_option_assignments_staff_read on public.product_option_assignments
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy product_option_assignments_manager_insert on public.product_option_assignments
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_option_assignments_manager_update on public.product_option_assignments
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_media ----------------------------------------------------------
create policy product_media_public_read on public.product_media
  for select to anon, authenticated
  using ((select public.jojo_product_is_public(product_id)));

create policy product_media_staff_read on public.product_media
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy product_media_manager_insert on public.product_media
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_media_manager_update on public.product_media
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- product_content / category_content -------------------------------------
create policy product_content_public_read on public.product_content
  for select to anon, authenticated
  using ((select public.jojo_product_is_public(product_id)));

create policy product_content_staff_read on public.product_content
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy product_content_manager_insert on public.product_content
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy product_content_manager_update on public.product_content
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

create policy category_content_public_read on public.category_content
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.categories c
      where c.id = category_content.category_id and c.active
    )
  );

create policy category_content_staff_read on public.category_content
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy category_content_manager_insert on public.category_content
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy category_content_manager_update on public.category_content
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));


-- =============================================================================
-- PART 3 — Stock
-- =============================================================================

-- A shopper sees availability for products already on the shelf. The column
-- grant above means anon reads (product_id, location_code, available) and never
-- on_hand or reserved.
--
-- KNOWN AND ACCEPTED: a signed-in customer is `authenticated` and does hold the
-- full column grant, so they could read on_hand and reserved for a product that
-- is already public. Column grants are per role, not per policy, and staff need
-- those columns. There are no customer accounts today — guest checkout creates
-- no login — so nobody but staff is `authenticated`. Revisit when accounts land.
create policy inventory_public_read on public.inventory
  for select to anon, authenticated
  using ((select public.jojo_product_is_public(product_id)));

create policy inventory_staff_read on public.inventory
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy inventory_manager_insert on public.inventory
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy inventory_manager_update on public.inventory
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- The ledger is internal. All three staff roles may read it — an Order staff
-- member asking why the count changed is a reasonable question — but only a
-- Manager or Owner may write, and only the four movement kinds a human
-- performs. `reservation`, `reservation_release`, `sale` and `returned_delivery`
-- follow an order and are written by the server inside the same transaction as
-- the order itself, never by a dashboard click.
create policy inventory_movements_staff_read on public.inventory_movements
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy inventory_movements_manager_insert on public.inventory_movements
  for insert to authenticated
  with check (
    (select public.jojo_manages_catalogue())
    and kind in ('receipt', 'stock_count', 'correction', 'damage_loss')
  );


-- =============================================================================
-- PART 4 — People and places
-- =============================================================================

-- ---- customers --------------------------------------------------------------
-- No anon read: a phone number is not public, and an enumerable customer table
-- is a gift to anyone who wants the shop's customer list.
create policy customers_self_read on public.customers
  for select to authenticated
  using (id = (select public.jojo_customer_id()));

create policy customers_self_update on public.customers
  for update to authenticated
  using (id = (select public.jojo_customer_id()))
  with check (id = (select public.jojo_customer_id()));

create policy customers_staff_read on public.customers
  for select to authenticated
  using ((select public.jojo_is_staff()));

-- customers.edit is Owner and Manager. Order staff may look up a customer to
-- ring them about an order; they may not edit the record.
create policy customers_manager_update on public.customers
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- customer_addresses -----------------------------------------------------
create policy customer_addresses_self_read on public.customer_addresses
  for select to authenticated
  using (customer_id = (select public.jojo_customer_id()));

create policy customer_addresses_self_insert on public.customer_addresses
  for insert to authenticated
  with check (customer_id = (select public.jojo_customer_id()));

create policy customer_addresses_self_update on public.customer_addresses
  for update to authenticated
  using (customer_id = (select public.jojo_customer_id()))
  with check (customer_id = (select public.jojo_customer_id()));

create policy customer_addresses_staff_read on public.customer_addresses
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy customer_addresses_manager_insert on public.customer_addresses
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy customer_addresses_manager_update on public.customer_addresses
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- delivery_zones ---------------------------------------------------------
-- Public: checkout has to show what delivery costs before anyone signs in.
create policy delivery_zones_public_read on public.delivery_zones
  for select to anon, authenticated
  using (active);

create policy delivery_zones_staff_read on public.delivery_zones
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy delivery_zones_manager_insert on public.delivery_zones
  for insert to authenticated
  with check ((select public.jojo_manages_catalogue()));

create policy delivery_zones_manager_update on public.delivery_zones
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));


-- =============================================================================
-- PART 5 — Commerce
--
-- No INSERT policy on orders or order_items, for anybody. An order is written by
-- the checkout server action with the service-role key, which is the only way to
-- price the cart from the database rather than from the request, reserve the
-- stock and write the order and its first event as one transaction.
--
-- Order tracking ("where is JU-000128?") is likewise a server lookup against an
-- order number plus the phone that placed it. It is not an anon read policy,
-- because a policy that lets a stranger read an order by knowing its number lets
-- them read every order by counting.
-- =============================================================================

create policy orders_self_read on public.orders
  for select to authenticated
  using (
    customer_id is not null
    and customer_id = (select public.jojo_customer_id())
  );

create policy orders_staff_read on public.orders
  for select to authenticated
  using ((select public.jojo_is_staff()));

-- All three roles advance orders — orders.advance, orders.cancel and
-- orders.recordPayment are the capabilities Order staff exist to exercise. The
-- column grant above is what keeps them out of the money and the snapshot.
create policy orders_staff_update on public.orders
  for update to authenticated
  using ((select public.jojo_is_staff()))
  with check ((select public.jojo_is_staff()));

create policy order_items_self_read on public.order_items
  for select to authenticated
  using ((select public.jojo_owns_order(order_id)));

create policy order_items_staff_read on public.order_items
  for select to authenticated
  using ((select public.jojo_is_staff()));

create policy order_events_self_read on public.order_events
  for select to authenticated
  using ((select public.jojo_owns_order(order_id)));

create policy order_events_staff_read on public.order_events
  for select to authenticated
  using ((select public.jojo_is_staff()));

-- Staff may add to an order's history — a note, a recorded WhatsApp message —
-- and the row must name them. It cannot be signed as somebody else, and it can
-- never be edited or removed afterwards: order_events is append-only.
create policy order_events_staff_insert on public.order_events
  for insert to authenticated
  with check (
    (select public.jojo_is_staff())
    and actor_type = 'staff'
    and actor_admin_id = (select public.jojo_admin_id())
  );


-- =============================================================================
-- PART 6 — Staff, audit, synchronisation and measurement
-- =============================================================================

-- ---- admin_profiles ---------------------------------------------------------
-- Own profile first, and without the staff check: a deactivated account must
-- still be able to read the row that says it is deactivated, so the dashboard
-- can say so plainly instead of showing an empty screen.
create policy admin_profiles_self_read on public.admin_profiles
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy admin_profiles_staff_read on public.admin_profiles
  for select to authenticated
  using ((select public.jojo_is_staff()));

-- staff.manage is the Owner's alone.
create policy admin_profiles_owner_insert on public.admin_profiles
  for insert to authenticated
  with check ((select public.jojo_is_owner()));

create policy admin_profiles_owner_update on public.admin_profiles
  for update to authenticated
  using ((select public.jojo_is_owner()))
  with check ((select public.jojo_is_owner()));

-- ---- audit_events -----------------------------------------------------------
-- Readable by Owner and Manager; writable by nobody holding a browser token.
-- An audit trail a client can append to is not an audit trail — every row is
-- written by the server, in the same transaction as the change it records.
create policy audit_events_manager_read on public.audit_events
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

-- ---- sync -------------------------------------------------------------------
-- The Google Sheet worker runs on the server with the service-role key. Staff
-- see what it did; only a resolution decision is writable, and only by a
-- Manager or Owner, because a conflict is a business call.
create policy sync_jobs_manager_read on public.sync_jobs
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

create policy sync_events_manager_read on public.sync_events
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

create policy sync_state_manager_read on public.sync_state
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

create policy sync_conflicts_manager_read on public.sync_conflicts
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));

create policy sync_conflicts_manager_update on public.sync_conflicts
  for update to authenticated
  using ((select public.jojo_manages_catalogue()))
  with check ((select public.jojo_manages_catalogue()));

-- ---- analytics_events -------------------------------------------------------
-- The one thing a browser writes. Restricted to the browsing half of the event
-- list, and forbidden from claiming a customer or an order: the order lifecycle
-- events are written by the server at the moment the order actually moves, so a
-- client cannot inflate the shop's figures or attach itself to someone's order.
create policy analytics_events_client_insert on public.analytics_events
  for insert to anon, authenticated
  with check (
    customer_id is null
    and order_id is null
    and kind in (
      'page_view',
      'product_impression',
      'product_view',
      'search',
      'add_to_cart',
      'remove_from_cart',
      'checkout_started',
      'whatsapp_initiated'
    )
  );

-- Write-only for the browser: nobody reads the measurement stream back except
-- the people it is for. analytics.view is Owner and Manager.
create policy analytics_events_manager_read on public.analytics_events
  for select to authenticated
  using ((select public.jojo_manages_catalogue()));
