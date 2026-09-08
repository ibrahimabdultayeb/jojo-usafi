-- =============================================================================
-- Jojo Usafi — 0004 Customers and delivery
--
-- Guest checkout is the default and stays the default. A customer row is
-- created from a phone number and a name; no account, no password, no Supabase
-- Auth user is required to buy. `auth_user_id` exists so that a customer who
-- later chooses to create an account can be linked to their history without a
-- migration — it is not populated by anything in this build.
--
-- This is not a CRM. Name, phone, optional email, addresses, timestamps.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers
--
-- The phone number is the identity. It is stored once, normalised to E.164
-- Tanzanian mobile format (+255 followed by 6xx/7xx and eight more digits), and
-- the display form is kept alongside it only for reading back to a human.
-- The same normalisation is implemented in src/lib/domain/phone.ts and is
-- covered by unit tests there.
-- -----------------------------------------------------------------------------

create table public.customers (
  id             uuid primary key default gen_random_uuid(),

  phone_e164     text not null unique check (phone_e164 ~ '^\+255[67][0-9]{8}$'),
  phone_display  text,

  full_name      text not null check (length(btrim(full_name)) > 0),
  email          citext unique check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- Populated only if the customer later creates an account. The foreign key to
  -- auth.users is added in Build 06 together with Auth and RLS, so that this
  -- schema applies cleanly to any PostgreSQL, not only a provisioned Supabase.
  auth_user_id   uuid unique,

  marketing_opt_in boolean not null default false,
  notes            text,

  first_ordered_at timestamptz,
  last_ordered_at  timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.customers is
  'Guest checkout customers, keyed by normalised Tanzanian phone number. No account required, ever.';

create index customers_last_ordered_idx on public.customers (last_ordered_at desc nulls last);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- delivery_zones
--
-- fee_tzs defaults to 4,000 TZS: the value Ibrahim approved as the starting fee
-- for a newly created zone. It is a default, not a fixed price — each zone is
-- edited in the admin dashboard.
--
-- No zone rows are inserted here. Prototype zone names are not production truth.
-- -----------------------------------------------------------------------------

create table public.delivery_zones (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null unique check (length(btrim(name)) > 0),

  fee_tzs       integer not null default 4000 check (fee_tzs >= 0),
  free_delivery boolean not null default false,

  active        boolean not null default true,
  sort_priority integer not null default 0,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A zone cannot both be free and charge money. Marking a zone free is how the
  -- fee is waived; the fee then reads 0 everywhere, including on the order
  -- snapshot and the WhatsApp message.
  constraint delivery_zones_free_is_free
    check (not free_delivery or fee_tzs = 0)
);

comment on column public.delivery_zones.fee_tzs is
  'Integer TZS. Defaults to 4000, the approved starting fee for a new zone.';

create trigger delivery_zones_updated_at
  before update on public.delivery_zones
  for each row execute function public.jojo_set_updated_at();

-- -----------------------------------------------------------------------------
-- customer_addresses
-- -----------------------------------------------------------------------------

create table public.customer_addresses (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  delivery_zone_id uuid references public.delivery_zones (id) on delete restrict,

  label            text,                       -- "Home", "Shop", "Mum's place"
  address_line     text not null check (length(btrim(address_line)) > 0),
  landmark         text,                       -- how the rider actually finds it
  instructions     text,

  is_default       boolean not null default false,
  active           boolean not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index customer_addresses_customer_idx on public.customer_addresses (customer_id);

create unique index customer_addresses_one_default
  on public.customer_addresses (customer_id)
  where is_default and active;

create trigger customer_addresses_updated_at
  before update on public.customer_addresses
  for each row execute function public.jojo_set_updated_at();
