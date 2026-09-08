-- =============================================================================
-- Jojo Usafi — 0001 Foundation
--
-- Extensions, shared helper functions and the enumerated vocabularies the rest
-- of the schema is built from.
--
-- Conventions used by every later migration:
--   * uuid primary keys, `gen_random_uuid()` by default
--   * every money column is an INTEGER number of Tanzanian shillings, named
--     `*_tzs`, and is constrained non-negative. Never float, never decimal.
--   * `created_at` / `updated_at` are timestamptz, `updated_at` maintained by
--     the `jojo_set_updated_at` trigger.
--   * append-only tables are protected by the `jojo_forbid_mutation` trigger
--     rather than by trusting application code.
--
-- Jojo Usafi is the retailer. EcoPlus is the first catalogue, not the model:
-- nothing in this schema may assume cleaning products, EP codes or one brand.
-- =============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists citext;        -- case-insensitive email

-- -----------------------------------------------------------------------------
-- Shared triggers
-- -----------------------------------------------------------------------------

create or replace function public.jojo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.jojo_set_updated_at() is
  'Maintains updated_at on any table carrying that column.';

create or replace function public.jojo_forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Table %.% is append-only; % is not permitted.',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

comment on function public.jojo_forbid_mutation() is
  'Attached to append-only ledgers (order_events, inventory_movements, audit_events, analytics_events) so history cannot be rewritten, including by a privileged client.';

-- -----------------------------------------------------------------------------
-- Catalogue vocabularies
-- -----------------------------------------------------------------------------

-- Lifecycle applies to families and to sellable SKUs.
--   draft    — being prepared, never public
--   active   — sellable
--   hidden   — temporarily withheld, still orderable history
--   archived — retired; kept forever because orders reference it
create type public.catalogue_lifecycle as enum ('draft', 'active', 'hidden', 'archived');

-- Where a product photograph sits on the product page.
create type public.media_role as enum ('primary', 'gallery', 'swatch', 'logo', 'icon');

-- -----------------------------------------------------------------------------
-- Inventory vocabulary
-- -----------------------------------------------------------------------------

--   receipt             stock arrived from a supplier
--   stock_count         physical count reconciling on_hand to reality
--   correction          manual correction by a named operator
--   reservation         stock committed to an order, still physically present
--   reservation_release reservation given back (cancellation, expiry)
--   sale                order completed: stock leaves and the reservation clears
--   returned_delivery   a failed/returned delivery putting stock back
--   damage_loss         breakage, spillage, theft, expiry
create type public.inventory_movement_kind as enum (
  'receipt',
  'stock_count',
  'correction',
  'reservation',
  'reservation_release',
  'sale',
  'returned_delivery',
  'damage_loss'
);

-- -----------------------------------------------------------------------------
-- Order vocabulary  (docs/BUSINESS_RULES.md — approved states)
-- -----------------------------------------------------------------------------

create type public.order_state as enum (
  'new',
  'awaiting_confirmation',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
  'delivery_failed'
);

-- What the customer said they intend to do at the door.
create type public.payment_preference as enum ('cash_on_delivery', 'digital_on_delivery');

-- What actually happened. Deliberately a different field from the preference:
-- a customer may say cash and then pay by mobile money.
create type public.payment_method as enum ('cash', 'digital');

create type public.payment_status as enum ('unpaid', 'paid');

create type public.order_event_kind as enum (
  'order_created',
  'state_changed',
  'confirmed',
  'cancelled',
  'delivery_failed',
  'payment_recorded',
  'stock_reserved',
  'stock_released',
  'order_amended',
  'note_added',
  'whatsapp_opened',
  'staff_action'
);

-- Who caused something to happen. Used by order_events and audit_events.
create type public.actor_type as enum ('customer', 'staff', 'system', 'sync');

-- -----------------------------------------------------------------------------
-- Admin vocabulary
-- -----------------------------------------------------------------------------

create type public.admin_role as enum ('owner', 'manager', 'order_staff');

-- -----------------------------------------------------------------------------
-- Synchronisation vocabulary
-- -----------------------------------------------------------------------------

create type public.sync_source as enum ('sheet', 'admin', 'storefront', 'system');

create type public.sync_direction as enum ('sheet_to_db', 'db_to_sheet');

create type public.sync_operation as enum ('insert', 'update', 'delete', 'upsert');

create type public.sync_status as enum (
  'pending',
  'in_progress',
  'applied',
  'skipped_echo',
  'conflict',
  'failed'
);

create type public.sync_conflict_resolution as enum (
  'pending',
  'sheet_wins',
  'db_wins',
  'manual',
  'ignored'
);

-- -----------------------------------------------------------------------------
-- Analytics vocabulary  (CLAUDE.md — ORDER ANALYTICS)
-- -----------------------------------------------------------------------------

create type public.analytics_event_kind as enum (
  'page_view',
  'product_impression',
  'product_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'order_created',
  'whatsapp_initiated',
  'order_confirmed',
  'order_preparing',
  'order_dispatched',
  'order_completed',
  'order_cancelled',
  'order_delivery_failed'
);
