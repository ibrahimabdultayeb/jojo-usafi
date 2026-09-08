-- =============================================================================
-- Jojo Usafi — 0005 Orders
--
-- An order is a historical record. It must still read correctly in a year, when
-- prices have changed, a product has been renamed and a delivery zone has been
-- retired. Every customer-visible fact is therefore SNAPSHOTTED onto the order
-- and its items; the foreign keys back to customers, zones and products exist
-- for reporting, and are all `on delete set null` so losing a reference can
-- never destroy the record of what was actually sold.
--
-- Orders are stored BEFORE WhatsApp is opened. WhatsApp is a communication
-- channel; it is not the database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Public order numbers. Customers quote these; they are not UUIDs.
-- -----------------------------------------------------------------------------

create sequence public.order_number_seq as bigint start with 1 increment by 1;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'JU-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

comment on function public.next_order_number() is
  'Public order reference, e.g. JU-000128. The sequence start is set when the real store goes live so numbering continues from the existing books.';

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null unique default public.next_order_number()
                         check (order_number ~ '^JU-[0-9]{6,}$'),

  -- Reference, not source of truth.
  customer_id            uuid references public.customers (id) on delete set null,

  -- Customer snapshot.
  customer_name          text not null check (length(btrim(customer_name)) > 0),
  customer_phone_e164    text not null check (customer_phone_e164 ~ '^\+255[67][0-9]{8}$'),
  customer_phone_display text,
  customer_email         citext,

  -- Delivery snapshot.
  delivery_zone_id       uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name     text not null check (length(btrim(delivery_zone_name)) > 0),
  delivery_address       text not null check (length(btrim(delivery_address)) > 0),
  delivery_landmark      text,
  delivery_instructions  text,
  delivery_fee_tzs       integer not null check (delivery_fee_tzs >= 0),

  -- Money. Integer TZS throughout.
  subtotal_tzs           integer not null check (subtotal_tzs >= 0),
  discount_tzs           integer not null default 0 check (discount_tzs >= 0),
  total_tzs              integer not null check (total_tzs >= 0),

  -- Payment. Preference is what the customer chose at checkout; method and
  -- status are what actually happened at the door. They are separate fields on
  -- purpose — a customer may choose cash and then pay by mobile money.
  payment_preference     public.payment_preference not null,
  payment_status         public.payment_status not null default 'unpaid',
  payment_method         public.payment_method,
  payment_reference      text,
  paid_at                timestamptz,

  -- Lifecycle.
  state                  public.order_state not null default 'new',
  cancellation_reason    text,
  delivery_failure_reason text,

  placed_at              timestamptz not null default now(),
  confirmed_at           timestamptz,
  preparing_at           timestamptz,
  dispatched_at          timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  failed_at              timestamptz,
  whatsapp_opened_at     timestamptz,

  -- Context.
  channel                text not null default 'storefront',
  locale                 text not null default 'en' references public.locales (code) on delete restrict,
  customer_note          text,
  staff_note             text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- ---- arithmetic -----------------------------------------------------------
  constraint orders_discount_within_subtotal
    check (discount_tzs <= subtotal_tzs),
  constraint orders_total_is_derived
    check (total_tzs = subtotal_tzs - discount_tzs + delivery_fee_tzs),

  -- ---- payment consistency --------------------------------------------------
  -- Unpaid means nothing has been recorded at all.
  constraint orders_unpaid_is_blank check (
    payment_status <> 'unpaid'
    or (payment_method is null and payment_reference is null and paid_at is null)
  ),
  -- Paid means we know how and when.
  constraint orders_paid_needs_method check (
    payment_status <> 'paid'
    or (payment_method is not null and paid_at is not null)
  ),
  -- A digital payment without a transaction reference is not evidence of
  -- anything. Cash deliberately requires no reference.
  constraint orders_digital_needs_reference check (
    payment_status <> 'paid'
    or payment_method <> 'digital'
    or (payment_reference is not null and length(btrim(payment_reference)) > 0)
  ),
  -- An order is only complete once the money is recorded.
  constraint orders_completed_is_paid check (
    state <> 'completed' or payment_status = 'paid'
  ),

  -- ---- lifecycle consistency ------------------------------------------------
  constraint orders_cancelled_needs_reason check (
    state <> 'cancelled'
    or (cancellation_reason is not null and length(btrim(cancellation_reason)) > 0)
  ),
  constraint orders_failed_needs_reason check (
    state <> 'delivery_failed'
    or (delivery_failure_reason is not null and length(btrim(delivery_failure_reason)) > 0)
  ),
  constraint orders_completed_has_timestamp check (
    state <> 'completed' or completed_at is not null
  )
);

comment on table public.orders is
  'Stored before WhatsApp is opened. Every customer-visible value is snapshotted so the order still reads correctly after the catalogue changes.';

create index orders_state_idx      on public.orders (state, placed_at desc);
create index orders_customer_idx   on public.orders (customer_id, placed_at desc);
create index orders_placed_idx     on public.orders (placed_at desc);
create index orders_phone_idx      on public.orders (customer_phone_e164);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- order_items — snapshots. `product_id` may go null; `sku` never does.
-- -----------------------------------------------------------------------------

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,

  sku             text not null check (sku ~ '^[A-Z0-9][A-Z0-9._-]{1,47}$'),
  product_name    text not null check (length(btrim(product_name)) > 0),
  variant_label   text,
  pack_size_label text,
  brand_name      text,

  quantity        integer not null check (quantity > 0 and quantity <= 999),
  unit_price_tzs  integer not null check (unit_price_tzs >= 0),
  line_total_tzs  integer not null check (line_total_tzs >= 0),

  position        integer not null default 0,
  created_at      timestamptz not null default now(),

  constraint order_items_line_total_is_derived
    check (line_total_tzs = unit_price_tzs * quantity),

  -- The cart is keyed by SKU, so two lines for the same SKU is a bug.
  constraint order_items_one_line_per_sku unique (order_id, sku)
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_sku_idx     on public.order_items (sku);
create index order_items_product_idx on public.order_items (product_id);

-- -----------------------------------------------------------------------------
-- order_events — the append-only history of an order.
--
-- The current row on `orders` is a cache of the latest state. This table is why
-- "what happened to order JU-000128" is answerable even after the row has been
-- overwritten ten times.
-- -----------------------------------------------------------------------------

create table public.order_events (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,

  kind           public.order_event_kind not null,
  from_state     public.order_state,
  to_state       public.order_state,

  actor_type     public.actor_type not null default 'system',
  actor_admin_id uuid,          -- FK added in migration 0006
  actor_label    text,          -- who it was, in words, for the timeline

  summary        text,          -- plain-language line shown to staff
  payload        jsonb not null default '{}'::jsonb,

  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  -- A state change must say what changed.
  constraint order_events_state_change_shape check (
    kind <> 'state_changed' or to_state is not null
  )
);

create index order_events_order_idx on public.order_events (order_id, occurred_at);
create index order_events_kind_idx  on public.order_events (kind, occurred_at desc);

create trigger order_events_append_only
  before update or delete on public.order_events
  for each row execute function public.jojo_forbid_mutation();

-- -----------------------------------------------------------------------------
-- Now that orders exist, tie the stock ledger to them.
-- -----------------------------------------------------------------------------

alter table public.inventory_movements
  add constraint inventory_movements_order_fk
  foreign key (order_id) references public.orders (id) on delete set null;

-- -----------------------------------------------------------------------------
-- SKU immutability.
--
-- SKU is the stable business identifier. Once it appears on an order it is
-- historical fact and may not be silently rewritten — not by the admin
-- dashboard, and not by a careless edit in the Google Sheet.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_guard_sku_immutability()
returns trigger
language plpgsql
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

create trigger products_sku_immutable
  before update of sku on public.products
  for each row execute function public.jojo_guard_sku_immutability();
