-- =============================================================================
-- Jojo Usafi — 0002 Catalogue
--
-- Suppliers, brands, categories, families, option axes, sellable SKUs, media
-- and localized content.
--
-- The shape is deliberately:
--
--     product_family  ->  configurable option axes  ->  sellable SKU
--
-- Size and scent are *rows in option axes*, not columns. A future brand whose
-- products vary by colour, grit, voltage or nothing at all needs no migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- locales — adding a language is adding a row, here and in the dictionaries.
-- -----------------------------------------------------------------------------

create table public.locales (
  code          text primary key check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  label         text not null,
  english_label text not null,
  is_default    boolean not null default false,
  active        boolean not null default true,
  sort_priority integer not null default 0
);

comment on table public.locales is
  'Storefront languages. English and Kiswahili today; the storefront routes and dictionaries read the same list.';

create unique index locales_one_default on public.locales (is_default) where is_default;

insert into public.locales (code, label, english_label, is_default, sort_priority) values
  ('en', 'English',   'English',   true,  0),
  ('sw', 'Kiswahili', 'Kiswahili', false, 1);

-- -----------------------------------------------------------------------------
-- pack_types — a lookup, not an enum, so a new brand can add "pouch" or "case"
-- without a schema change.
-- -----------------------------------------------------------------------------

create table public.pack_types (
  code          text primary key check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  label         text not null,
  sort_priority integer not null default 0
);

insert into public.pack_types (code, label, sort_priority) values
  ('sachet',   'Sachet',   10),
  ('bottle',   'Bottle',   20),
  ('tub',      'Tub',      30),
  ('jerrycan', 'Jerrycan', 40),
  ('drum',     'Drum',     50),
  ('carton',   'Carton',   60);

-- -----------------------------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------------------------

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  name          text not null unique check (length(btrim(name)) > 0),
  country       text,
  contact_name  text,
  contact_phone text,
  contact_email citext,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------

create table public.brands (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(btrim(name)) > 0),
  supplier_id   uuid references public.suppliers (id) on delete set null,
  tagline       text,
  mark          text check (mark is null or length(mark) between 1 and 2),
  tone          text,
  logo_media_id uuid,                              -- FK added after media_assets
  active        boolean not null default true,
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.brands is
  'A brand is one catalogue Jojo Usafi sells. EcoPlus is the first; the store is never a single-brand store.';

-- -----------------------------------------------------------------------------
-- categories — self-referencing so a sub-category needs no new table.
-- -----------------------------------------------------------------------------

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(btrim(name)) > 0),
  parent_id     uuid references public.categories (id) on delete restrict,
  blurb         text,
  icon_path     text,                              -- inline SVG path data
  tone          text,
  active        boolean not null default true,
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index categories_parent_idx on public.categories (parent_id);

-- -----------------------------------------------------------------------------
-- media_assets — every image, wherever it is used. `source_filename` keeps the
-- approval trail: any photograph on the storefront can be traced back to the
-- file that was approved.
-- -----------------------------------------------------------------------------

create table public.media_assets (
  id              uuid primary key default gen_random_uuid(),
  storage_bucket  text not null default 'product-media',
  storage_path    text not null,
  mime_type       text not null default 'image/webp',
  width           integer check (width is null or width > 0),
  height          integer check (height is null or height > 0),
  byte_size       integer check (byte_size is null or byte_size > 0),
  checksum        text,
  source_filename text,
  alt_text        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint media_assets_path_unique unique (storage_bucket, storage_path)
);

alter table public.brands
  add constraint brands_logo_media_fk
  foreign key (logo_media_id) references public.media_assets (id) on delete set null;

-- -----------------------------------------------------------------------------
-- product_families — the thing a shopper thinks of as "the product".
-- -----------------------------------------------------------------------------

create table public.product_families (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._-]{1,47}$'),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand_id      uuid not null references public.brands (id) on delete restrict,
  category_id   uuid not null references public.categories (id) on delete restrict,
  supplier_id   uuid references public.suppliers (id) on delete set null,
  name          text not null check (length(btrim(name)) > 0),
  summary       text,
  lifecycle     public.catalogue_lifecycle not null default 'draft',
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index product_families_brand_idx    on public.product_families (brand_id);
create index product_families_category_idx on public.product_families (category_id);

-- -----------------------------------------------------------------------------
-- Option axes — the variant model. An axis is "Size", "Scent", "Colour".
-- A value is "5LT", "Lemon Fresh", "Blue". A family declares which axes it is
-- configured by; a SKU declares one value on each of them.
-- -----------------------------------------------------------------------------

create table public.product_option_axes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  label         text not null,
  -- true when the axis is an ordered magnitude (size, weight) rather than an
  -- unordered choice (scent, colour). Drives how the chooser is sorted.
  is_ordinal    boolean not null default false,
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into public.product_option_axes (code, label, is_ordinal, sort_priority) values
  ('size',  'Size',  true,  10),
  ('scent', 'Scent', false, 20);

create table public.product_option_values (
  id            uuid primary key default gen_random_uuid(),
  axis_id       uuid not null references public.product_option_axes (id) on delete cascade,
  code          text not null check (code ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  label         text not null,
  -- Millilitres, grams or any comparable magnitude, so "500ML" sorts before
  -- "5LT" instead of alphabetically. Null on unordered axes.
  numeric_rank  integer,
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint product_option_values_unique unique (axis_id, code)
);

create table public.product_family_axes (
  family_id uuid not null references public.product_families (id) on delete cascade,
  axis_id   uuid not null references public.product_option_axes (id) on delete restrict,
  position  integer not null default 0,
  primary key (family_id, axis_id)
);

comment on table public.product_family_axes is
  'Which axes this family varies by. A family with no rows here has exactly one SKU, which is legitimate.';

-- -----------------------------------------------------------------------------
-- products — the sellable SKU. This is what a cart line, an order line, the
-- inventory ledger and the Google Sheet all key on.
-- -----------------------------------------------------------------------------

create table public.products (
  id                  uuid primary key default gen_random_uuid(),

  -- The stable business identifier. Never silently rewritten once used on an
  -- order; that guard is a trigger in migration 0005, next to orders.
  sku                 text not null unique
                      check (sku ~ '^[A-Z0-9][A-Z0-9._-]{1,47}$'),

  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  family_id           uuid not null references public.product_families (id) on delete restrict,
  brand_id            uuid not null references public.brands (id)           on delete restrict,
  category_id         uuid not null references public.categories (id)       on delete restrict,
  supplier_id         uuid references public.suppliers (id)                 on delete set null,

  -- Barcodes, where the supplier provides them.
  ean                 text check (ean is null or ean ~ '^([0-9]{8}|[0-9]{13})$'),
  itf14               text check (itf14 is null or itf14 ~ '^[0-9]{14}$'),

  display_name        text not null check (length(btrim(display_name)) > 0),
  variant_label       text,                    -- "Lemon Fresh", may be blank
  pack_size_label     text,                    -- "5LT", "500ML"
  pack_type           text references public.pack_types (code) on delete set null,
  -- Comparable magnitude of the pack, so sizes sort smallest-first.
  size_rank           integer check (size_rank is null or size_rank > 0),

  -- Money. Integer TZS, never floating point.
  price_tzs           integer not null check (price_tzs >= 0),
  offer_price_tzs     integer check (offer_price_tzs is null or offer_price_tzs >= 0),

  lifecycle           public.catalogue_lifecycle not null default 'draft',
  -- Merchandising switch, separate from lifecycle: an active product can be
  -- pulled off the shelf for a day without being archived.
  storefront_visible  boolean not null default false,

  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),

  best_seller         boolean not null default false,
  featured            boolean not null default false,
  sort_priority       integer not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint products_offer_below_price
    check (offer_price_tzs is null or offer_price_tzs < price_tzs)
);

comment on column public.products.storefront_visible is
  'Merchandising switch. A product is public only when lifecycle = active AND storefront_visible AND it has a primary image.';

create index products_family_idx   on public.products (family_id);
create index products_brand_idx    on public.products (brand_id);
create index products_category_idx on public.products (category_id);
create index products_shelf_idx    on public.products (lifecycle, storefront_visible, sort_priority);

-- A SKU's coordinates on the axes its family declares.
create table public.product_option_assignments (
  product_id uuid not null references public.products (id)              on delete cascade,
  axis_id    uuid not null references public.product_option_axes (id)   on delete restrict,
  value_id   uuid not null references public.product_option_values (id) on delete restrict,
  primary key (product_id, axis_id)
);

create index product_option_assignments_value_idx
  on public.product_option_assignments (value_id);

-- -----------------------------------------------------------------------------
-- product_media
-- -----------------------------------------------------------------------------

create table public.product_media (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id)     on delete cascade,
  media_id      uuid not null references public.media_assets (id) on delete restrict,
  role          public.media_role not null default 'gallery',
  sort_priority integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint product_media_unique unique (product_id, media_id, role)
);

create unique index product_media_one_primary
  on public.product_media (product_id)
  where role = 'primary';

-- -----------------------------------------------------------------------------
-- Localized content. The Product Master is English-only today, so Kiswahili
-- rows simply do not exist yet and the storefront falls back to English rather
-- than inventing a translation.
-- -----------------------------------------------------------------------------

create table public.product_content (
  product_id  uuid not null references public.products (id) on delete cascade,
  locale      text not null references public.locales (code) on delete restrict,
  name        text not null check (length(btrim(name)) > 0),
  description text,
  usage_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (product_id, locale)
);

create table public.category_content (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale      text not null references public.locales (code)  on delete restrict,
  name        text not null check (length(btrim(name)) > 0),
  blurb       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (category_id, locale)
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

create trigger suppliers_updated_at             before update on public.suppliers             for each row execute function public.jojo_set_updated_at();
create trigger brands_updated_at                before update on public.brands                for each row execute function public.jojo_set_updated_at();
create trigger categories_updated_at            before update on public.categories            for each row execute function public.jojo_set_updated_at();
create trigger media_assets_updated_at          before update on public.media_assets          for each row execute function public.jojo_set_updated_at();
create trigger product_families_updated_at      before update on public.product_families      for each row execute function public.jojo_set_updated_at();
create trigger product_option_axes_updated_at   before update on public.product_option_axes   for each row execute function public.jojo_set_updated_at();
create trigger product_option_values_updated_at before update on public.product_option_values for each row execute function public.jojo_set_updated_at();
create trigger products_updated_at              before update on public.products              for each row execute function public.jojo_set_updated_at();
create trigger product_media_updated_at         before update on public.product_media         for each row execute function public.jojo_set_updated_at();
create trigger product_content_updated_at       before update on public.product_content       for each row execute function public.jojo_set_updated_at();
create trigger category_content_updated_at      before update on public.category_content      for each row execute function public.jojo_set_updated_at();
