-- =============================================================================
-- Jojo Usafi — 0013 Table privileges: the verbs each role holds
--
-- WHY THIS MIGRATION EXISTS
--
-- Migration 0010 was written believing what most Supabase documentation says:
-- that a new table in `public` is granted full DML to anon, authenticated and
-- service_role, leaving Row Level Security as the only lock. On THIS project
-- that is not true, and the first attempt to insert a fixture proved it —
-- `permission denied for table suppliers`, using the service-role key.
--
-- The default privileges on this project are:
--
--     anon          = Dxtm     TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--     authenticated = Dxtm
--     service_role  = Dxtm
--
-- No SELECT. No INSERT. No UPDATE. No DELETE. For anybody, including the
-- server. Supabase now provisions projects with a hardened `public` schema —
-- the same template installs the `ensure_rls` event trigger, which switches RLS
-- on for any table someone forgets to protect.
--
-- So the 95 policies from migration 0010 were necessary and not sufficient: the
-- database was, briefly, a schema nothing could read or write at all. This
-- migration grants the verbs, and keeps them narrow.
--
-- The division of labour is worth stating once, because the two halves are easy
-- to confuse:
--
--     A GRANT decides WHICH VERBS and WHICH COLUMNS a role may ever touch.
--     A POLICY decides WHICH ROWS it then sees or changes.
--
-- Neither is sufficient alone, and that is the point: a mistake in a policy is
-- contained by the grant, and a grant that is too generous is contained by the
-- policy.
--
-- FUTURE MIGRATIONS: a new table arrives with no DML for anybody, and RLS
-- already enabled by the event trigger. It is invisible until it is granted
-- here and given a policy. That default is a good one — but it means adding a
-- table is two jobs, not one.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- service_role — the server, and the only caller that bypasses RLS.
--
-- Read by src/lib/supabase/admin.ts, which is `server-only`. It writes orders,
-- reserves stock, runs the Google Sheet sync worker and records audit rows. It
-- needs every verb, because it is the thing every verb is ultimately performed
-- by; what protects the shop is that reaching for this client is a different
-- import in a different file.
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema public to service_role;

-- `orders.order_number` defaults to next_order_number(), which is nextval() on
-- a sequence. Without this, writing an order fails at the default expression.
grant usage, select on all sequences in schema public to service_role;


-- -----------------------------------------------------------------------------
-- authenticated — a signed-in login: staff today, customers when accounts exist.
--
-- Broad verbs, narrow rows. Every table here is governed by the policies in
-- migration 0010, most of which admit only staff and several only an Owner, so
-- the grant is not the boundary — but DELETE is withheld outright, because the
-- admin dashboard has no delete control anywhere by design. A product is
-- archived, a staff member is deactivated, a stock mistake is corrected by a
-- compensating movement. Removing a row is a deliberate server operation.
-- -----------------------------------------------------------------------------

grant select, insert, update on all tables in schema public to authenticated;

-- Orders are the exception, and the reason column grants exist at all. All
-- three staff roles advance orders — that is what Order staff are for — so they
-- hold UPDATE. They must not be able to rewrite what was sold or what it cost.
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


-- -----------------------------------------------------------------------------
-- anon — a shopper who has not signed in. Almost every real visitor.
--
-- Listed table by table rather than granted wholesale. A shopper cannot so much
-- as name `orders`, `customers`, `suppliers`, `admin_profiles`, `audit_events`
-- or the sync tables: the request fails on the grant, before any policy is
-- consulted and before any row is examined.
--
-- These are exactly the tables carrying a `*_public_read` policy in migration
-- 0010, and exactly the tables `product_shelf` reads — the view is
-- `security_invoker`, so a shopper querying the shelf is really querying these.
-- -----------------------------------------------------------------------------

grant select on
  public.locales,
  public.pack_types,
  public.brands,
  public.categories,
  public.media_assets,
  public.product_families,
  public.product_option_axes,
  public.product_option_values,
  public.product_family_axes,
  public.products,
  public.product_option_assignments,
  public.product_media,
  public.product_content,
  public.category_content,
  public.delivery_zones
to anon;

-- Stock, column by column. A shopper may learn that something is available.
-- How many are physically on the shelf and how many are already promised to
-- somebody else is the shop's business.
grant select (product_id, location_code, available) on public.inventory to anon;

-- The one thing a browser writes. The policy on this table restricts it to the
-- browsing events, with no customer and no order attached.
grant insert on public.analytics_events to anon;


-- -----------------------------------------------------------------------------
-- The views.
-- -----------------------------------------------------------------------------

grant select on public.product_shelf to anon, authenticated;

-- Internal reconciliation: does the stock ledger agree with the running totals?
-- Not a shopper's question. `inventory_movements` is staff-only by policy, so
-- an unprivileged reader would see nonsense rather than a secret — but a
-- question nobody outside the shop should be able to ask is better refused than
-- answered incorrectly.
grant select on public.inventory_ledger_check to authenticated;
