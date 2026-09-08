-- =============================================================================
-- Jojo Usafi — 0006 Admin profiles and the audit trail
--
-- Roles: Owner, Manager, Order staff. The capability matrix that decides which
-- controls are worth rendering lives in src/lib/admin/permissions.ts; this table
-- carries the single fact the database needs — which role a person holds.
--
-- NO STAFF ACCOUNTS ARE CREATED HERE. Supabase Auth, the auth.users foreign key
-- and the Row Level Security policies that read this table are Build 06.
-- =============================================================================

create table public.admin_profiles (
  id           uuid primary key default gen_random_uuid(),

  -- Set to the Supabase Auth user id when accounts are created in Build 06. The
  -- FK to auth.users is added there, so this schema stays portable until then.
  auth_user_id uuid unique,

  full_name    text not null check (length(btrim(full_name)) > 0),
  phone_e164   text check (phone_e164 is null or phone_e164 ~ '^\+255[67][0-9]{8}$'),
  email        citext unique,

  role         public.admin_role not null default 'order_staff',
  active       boolean not null default true,

  invited_at   timestamptz,
  last_seen_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.admin_profiles is
  'Staff who can sign in to the admin dashboard. Empty until Build 06 creates real accounts through Supabase Auth.';

create index admin_profiles_role_idx on public.admin_profiles (role) where active;

create trigger admin_profiles_updated_at
  before update on public.admin_profiles
  for each row execute function public.jojo_set_updated_at();

-- There must always be an owner. Enforcing "at least one" needs a statement
-- trigger and real data to test against, so Build 06 adds it; the intent is
-- recorded here so it is not forgotten.
comment on column public.admin_profiles.role is
  'Owner / Manager / Order staff. Build 06 adds the guard that the last active owner cannot be demoted or deactivated.';

-- -----------------------------------------------------------------------------
-- Late foreign keys: the ledgers written earlier point at staff.
-- -----------------------------------------------------------------------------

alter table public.inventory_movements
  add constraint inventory_movements_actor_fk
  foreign key (actor_admin_id) references public.admin_profiles (id) on delete set null;

alter table public.order_events
  add constraint order_events_actor_fk
  foreign key (actor_admin_id) references public.admin_profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- audit_events — append-only, cross-cutting.
--
-- order_events answers "what happened to this order". This answers "who changed
-- what, anywhere" — a price edited in the dashboard, a zone fee changed, a
-- product hidden, a row written by the Google Sheet sync.
--
-- Entities are addressed by table name plus id plus business key rather than by
-- foreign key, because an audit row must survive the deletion of its subject.
-- -----------------------------------------------------------------------------

create table public.audit_events (
  id             uuid primary key default gen_random_uuid(),

  action         text not null check (action ~ '^[a-z][a-z0-9_.]{2,63}$'),
  entity_table   text not null,
  entity_id      uuid,
  entity_key     text,            -- the SKU, order number or slug

  actor_type     public.actor_type not null default 'system',
  actor_admin_id uuid references public.admin_profiles (id) on delete set null,
  actor_label    text,
  source         public.sync_source not null default 'system',

  before_data    jsonb,
  after_data     jsonb,
  changed_fields text[],

  request_id     text,
  user_agent     text,

  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index audit_events_entity_idx   on public.audit_events (entity_table, entity_id, occurred_at desc);
create index audit_events_key_idx      on public.audit_events (entity_key) where entity_key is not null;
create index audit_events_actor_idx    on public.audit_events (actor_admin_id, occurred_at desc);
create index audit_events_occurred_idx on public.audit_events (occurred_at desc);

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.jojo_forbid_mutation();
