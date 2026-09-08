-- =============================================================================
-- Jojo Usafi — 0003 Inventory
--
-- Two numbers per SKU per location:
--
--   on_hand   physically in the store
--   reserved  physically present but already promised to an order
--
-- available is DERIVED (on_hand - reserved) and can never be negative, because
-- both columns are non-negative and reserved may never exceed on_hand. Those
-- are database constraints, not React validation.
--
-- Every change is written to an append-only ledger. The ledger is the truth;
-- `inventory` is the running total, and the reconciliation view in migration
-- 0008 is how the two are proved to agree.
--
-- Transactional reservation functions (reserve-on-checkout, release-on-cancel)
-- are deliberately NOT written here. They need real concurrency testing against
-- a running PostgreSQL, which this build has no access to. Build 06 adds them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- inventory — the running total.
--
-- `location_code` is carried from day one, defaulted to 'main'. One shop today;
-- a second store or a van needs rows, not a migration.
-- -----------------------------------------------------------------------------

create table public.inventory (
  product_id    uuid not null references public.products (id) on delete cascade,
  location_code text not null default 'main' check (location_code ~ '^[a-z][a-z0-9_-]{0,31}$'),

  on_hand       integer not null default 0 check (on_hand  >= 0),
  reserved      integer not null default 0 check (reserved >= 0),

  -- Derived, stored, and therefore impossible to disagree with its inputs.
  available     integer generated always as (on_hand - reserved) stored,

  last_counted_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (product_id, location_code),

  -- The rule that makes `available` safe: you cannot promise stock you do not
  -- physically have.
  constraint inventory_reserved_within_on_hand check (reserved <= on_hand)
);

comment on table public.inventory is
  'Running stock totals per SKU per location. available is a stored generated column, so no caller can compute it differently.';

-- Indexed so "what is out of stock" and "what is below its threshold" are cheap.
create index inventory_available_idx on public.inventory (available);

create trigger inventory_updated_at
  before update on public.inventory
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- inventory_movements — the append-only ledger.
--
-- Each row records the signed effect on both columns, so a reservation
-- (0, +n), a release (0, -n) and a completed sale (-n, -n) are all the same
-- shape and can be replayed. `kind` and the deltas must agree; the check below
-- is the machine-readable version of the vocabulary comment in migration 0001.
-- -----------------------------------------------------------------------------

create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete restrict,
  location_code  text not null default 'main',

  kind           public.inventory_movement_kind not null,
  on_hand_delta  integer not null default 0,
  reserved_delta integer not null default 0,

  -- Balances after this movement, captured for auditing and for reconciling a
  -- disputed count without replaying the whole ledger.
  on_hand_after  integer check (on_hand_after  is null or on_hand_after  >= 0),
  reserved_after integer check (reserved_after is null or reserved_after >= 0),

  order_id       uuid,          -- FK added in migration 0005, once orders exist
  reason         text,
  reference      text,          -- delivery note, supplier invoice, count sheet

  actor_type     public.actor_type not null default 'system',
  actor_admin_id uuid,          -- FK added in migration 0006
  actor_label    text,

  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  foreign key (product_id, location_code)
    references public.inventory (product_id, location_code) on delete restrict,

  -- A movement that changes nothing is a bug, not a record.
  constraint inventory_movements_not_empty
    check (on_hand_delta <> 0 or reserved_delta <> 0),

  -- Each kind may only move stock in the direction its name claims.
  constraint inventory_movements_kind_shape check (
    case kind
      when 'receipt'             then on_hand_delta > 0 and reserved_delta = 0
      when 'returned_delivery'   then on_hand_delta > 0 and reserved_delta = 0
      when 'damage_loss'         then on_hand_delta < 0 and reserved_delta = 0
      when 'stock_count'         then reserved_delta = 0
      when 'correction'          then reserved_delta = 0
      when 'reservation'         then on_hand_delta = 0 and reserved_delta > 0
      when 'reservation_release' then on_hand_delta = 0 and reserved_delta < 0
      when 'sale'                then on_hand_delta < 0 and reserved_delta < 0
    end
  ),

  -- Anything tied to an order must say which order.
  constraint inventory_movements_order_required check (
    kind not in ('reservation', 'reservation_release', 'sale', 'returned_delivery')
    or order_id is not null
  ),

  -- A correction or a count is a human decision and must be explained.
  constraint inventory_movements_reason_required check (
    kind not in ('correction', 'stock_count', 'damage_loss')
    or (reason is not null and length(btrim(reason)) > 0)
  )
);

comment on table public.inventory_movements is
  'Append-only stock ledger. Rows are never updated or deleted — a mistake is corrected by writing a compensating movement.';

create index inventory_movements_product_idx  on public.inventory_movements (product_id, occurred_at desc);
create index inventory_movements_order_idx    on public.inventory_movements (order_id) where order_id is not null;
create index inventory_movements_kind_idx     on public.inventory_movements (kind, occurred_at desc);

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function public.jojo_forbid_mutation();
