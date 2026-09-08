-- =============================================================================
-- Jojo Usafi — 0007 Google Sheet synchronisation foundation
--
-- Ibrahim edits the catalogue in a Google Sheet. The admin dashboard edits the
-- same catalogue. Both write to Supabase, and Supabase writes back to the Sheet.
-- That is a loop, and a loop needs four things to be survivable:
--
--   idempotency   the same instruction applied twice changes nothing twice
--   echo detection a write we caused must not come back as a new instruction
--   conflict record when both sides changed the same field, someone decides
--   reconciliation  a periodic full comparison that proves the two agree
--
-- These tables exist so that the sync worker in a later build has somewhere to
-- record all four. NOTHING HERE CONNECTS TO A LIVE SHEET. No credentials, no
-- spreadsheet id, no Apps Script.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sync_jobs — one run of the worker, in one direction.
-- -----------------------------------------------------------------------------

create table public.sync_jobs (
  id              uuid primary key default gen_random_uuid(),

  direction       public.sync_direction not null,
  source          public.sync_source not null,
  entity_table    text not null,

  status          public.sync_status not null default 'pending',

  -- The same trigger delivered twice (a retried webhook, a double-click in the
  -- Sheet) must produce one job, not two.
  idempotency_key text not null unique,

  requested_by    uuid references public.admin_profiles (id) on delete set null,

  rows_seen       integer not null default 0 check (rows_seen     >= 0),
  rows_applied    integer not null default 0 check (rows_applied  >= 0),
  rows_skipped    integer not null default 0 check (rows_skipped  >= 0),
  rows_failed     integer not null default 0 check (rows_failed   >= 0),

  retry_count     integer not null default 0 check (retry_count >= 0),
  next_retry_at   timestamptz,

  error_message   text,
  error_detail    jsonb,

  started_at      timestamptz,
  finished_at     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint sync_jobs_finished_after_started
    check (finished_at is null or started_at is null or finished_at >= started_at),
  constraint sync_jobs_failure_is_explained
    check (status <> 'failed' or (error_message is not null and length(btrim(error_message)) > 0))
);

create index sync_jobs_status_idx on public.sync_jobs (status, created_at desc);
create index sync_jobs_retry_idx  on public.sync_jobs (next_retry_at) where next_retry_at is not null;

create trigger sync_jobs_updated_at
  before update on public.sync_jobs
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_events — one attempted change to one entity.
--
-- `fingerprint` is a hash of the values being written. It is what makes echo
-- detection possible: if the incoming fingerprint equals the fingerprint we
-- last wrote for that entity, this is our own change coming back and the row is
-- recorded as `skipped_echo` rather than applied.
-- -----------------------------------------------------------------------------

create table public.sync_events (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references public.sync_jobs (id) on delete set null,

  source          public.sync_source not null,
  direction       public.sync_direction not null,
  operation       public.sync_operation not null,

  entity_table    text not null,
  entity_id       uuid,
  entity_key      text not null,       -- the SKU, order number or slug

  field_changes   jsonb not null default '{}'::jsonb,
  fingerprint     text not null,
  -- The fingerprint the row carried before this change, used to detect a stale
  -- write: an instruction computed against a version we have already moved past.
  base_fingerprint text,

  status          public.sync_status not null default 'pending',
  idempotency_key text not null unique,

  retry_count     integer not null default 0 check (retry_count >= 0),
  next_retry_at   timestamptz,
  error_message   text,

  -- Where it came from in the Sheet, so a human can be pointed at the cell.
  sheet_tab       text,
  sheet_row       integer check (sheet_row is null or sheet_row > 0),

  applied_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint sync_events_applied_has_timestamp
    check (status <> 'applied' or applied_at is not null),
  constraint sync_events_failure_is_explained
    check (status <> 'failed' or (error_message is not null and length(btrim(error_message)) > 0))
);

create index sync_events_job_idx    on public.sync_events (job_id);
create index sync_events_entity_idx on public.sync_events (entity_table, entity_key, created_at desc);
create index sync_events_status_idx on public.sync_events (status, created_at desc);

create trigger sync_events_updated_at
  before update on public.sync_events
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_state — the last agreed version of each entity, per side.
--
-- This is the loop breaker. One row per entity: the fingerprint we last wrote,
-- who wrote it, and when each side was last seen. A worker consults this before
-- applying anything.
-- -----------------------------------------------------------------------------

create table public.sync_state (
  entity_table       text not null,
  entity_key         text not null,

  entity_id          uuid,
  version            bigint not null default 1 check (version > 0),

  db_fingerprint     text,
  sheet_fingerprint  text,

  last_source        public.sync_source,
  last_synced_at     timestamptz,
  last_reconciled_at timestamptz,

  sheet_tab          text,
  sheet_row          integer check (sheet_row is null or sheet_row > 0),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  primary key (entity_table, entity_key)
);

comment on table public.sync_state is
  'Loop and echo prevention. If an incoming fingerprint matches the one we last wrote, the change is our own and is skipped.';

create trigger sync_state_updated_at
  before update on public.sync_state
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_conflicts — both sides changed the same field. Never resolved silently.
-- -----------------------------------------------------------------------------

create table public.sync_conflicts (
  id             uuid primary key default gen_random_uuid(),
  sync_event_id  uuid references public.sync_events (id) on delete set null,

  entity_table   text not null,
  entity_key     text not null,
  field          text not null,

  sheet_value    jsonb,
  db_value       jsonb,

  resolution     public.sync_conflict_resolution not null default 'pending',
  resolved_by    uuid references public.admin_profiles (id) on delete set null,
  resolved_at    timestamptz,
  note           text,

  detected_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint sync_conflicts_resolution_has_timestamp
    check (resolution = 'pending' or resolved_at is not null)
);

create index sync_conflicts_open_idx
  on public.sync_conflicts (detected_at desc)
  where resolution = 'pending';

create index sync_conflicts_entity_idx
  on public.sync_conflicts (entity_table, entity_key);

create trigger sync_conflicts_updated_at
  before update on public.sync_conflicts
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- analytics_events — append-only, the measurable moments listed in CLAUDE.md.
-- -----------------------------------------------------------------------------

create table public.analytics_events (
  id           uuid primary key default gen_random_uuid(),

  kind         public.analytics_event_kind not null,
  occurred_at  timestamptz not null default now(),

  session_id   text,
  customer_id  uuid references public.customers (id) on delete set null,
  order_id     uuid references public.orders (id)    on delete set null,

  sku          text,
  entity_table text,
  entity_key   text,

  locale       text references public.locales (code) on delete set null,
  path         text,
  referrer     text,

  -- Search terms, quantities, positions in a grid: anything a specific event
  -- needs that does not deserve a column.
  properties   jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now()
);

create index analytics_events_kind_idx     on public.analytics_events (kind, occurred_at desc);
create index analytics_events_session_idx  on public.analytics_events (session_id, occurred_at);
create index analytics_events_order_idx    on public.analytics_events (order_id) where order_id is not null;
create index analytics_events_sku_idx      on public.analytics_events (sku, occurred_at desc) where sku is not null;

create trigger analytics_events_append_only
  before update or delete on public.analytics_events
  for each row execute function public.jojo_forbid_mutation();
