-- =============================================================================
-- Jojo Usafi — 0008 Reporting views and default-deny Row Level Security
--
-- Two jobs:
--
-- 1. Views that express rules once, in the database, rather than in every
--    caller: what "on the shelf" means, and whether the stock ledger agrees
--    with the running totals.
--
-- 2. Row Level Security enabled on EVERY table, with NO policies.
--
-- No policies means no access for the anon and authenticated roles. That is the
-- intended state at the end of Build 05: nothing in the application reads
-- Supabase yet, so a closed door is correct and a table left open would be a
-- silent hole. Build 06 writes and tests the policies that open the specific
-- doors — public read of shelf products, staff access by role, a dedicated,
-- audited sync role.
--
-- Views are declared `security_invoker` so they enforce the caller's policies
-- instead of bypassing them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- product_shelf — one definition of "a customer may see this".
--
-- A product reaches the storefront only when it is active, switched on for the
-- storefront, and has an approved primary photograph. That last rule is why no
-- placeholder ever reaches a shopper.
-- -----------------------------------------------------------------------------

create view public.product_shelf
with (security_invoker = on)
as
select
  p.id,
  p.sku,
  p.slug,
  p.display_name,
  p.variant_label,
  p.pack_size_label,
  p.pack_type,
  p.size_rank,
  p.price_tzs,
  p.offer_price_tzs,
  coalesce(p.offer_price_tzs, p.price_tzs) as effective_price_tzs,
  p.best_seller,
  p.featured,
  p.sort_priority,
  p.family_id,
  f.slug          as family_slug,
  f.name          as family_name,
  p.brand_id,
  b.slug          as brand_slug,
  b.name          as brand_name,
  p.category_id,
  c.slug          as category_slug,
  c.name          as category_name,
  m.storage_bucket as image_bucket,
  m.storage_path   as image_path,
  m.width          as image_width,
  m.height         as image_height,
  m.alt_text       as image_alt,
  coalesce(i.available, 0)          as available,
  coalesce(i.available, 0) > 0      as in_stock,
  coalesce(i.available, 0) > 0
    and coalesce(i.available, 0) <= p.low_stock_threshold as low_stock
from public.products p
join public.product_families f on f.id = p.family_id
join public.brands b           on b.id = p.brand_id
join public.categories c       on c.id = p.category_id
join public.product_media pm   on pm.product_id = p.id and pm.role = 'primary'
join public.media_assets m     on m.id = pm.media_id
left join public.inventory i   on i.product_id = p.id and i.location_code = 'main'
where p.lifecycle = 'active'
  and p.storefront_visible
  and f.lifecycle = 'active'
  and b.active
  and c.active;

comment on view public.product_shelf is
  'The public shelf. Active + storefront_visible + an approved primary image. Nothing else is sellable.';

-- -----------------------------------------------------------------------------
-- inventory_ledger_check — does the running total match the ledger?
--
-- Any row where `matches` is false means someone wrote to `inventory` without
-- writing a movement, and the stock figures can no longer be trusted. Build 06
-- runs this as an assertion after every stock operation test.
-- -----------------------------------------------------------------------------

create view public.inventory_ledger_check
with (security_invoker = on)
as
select
  i.product_id,
  i.location_code,
  i.on_hand,
  i.reserved,
  coalesce(sum(mv.on_hand_delta),  0)::integer as ledger_on_hand,
  coalesce(sum(mv.reserved_delta), 0)::integer as ledger_reserved,
  i.on_hand  = coalesce(sum(mv.on_hand_delta),  0)
    and i.reserved = coalesce(sum(mv.reserved_delta), 0) as matches
from public.inventory i
left join public.inventory_movements mv
  on mv.product_id = i.product_id
 and mv.location_code = i.location_code
group by i.product_id, i.location_code, i.on_hand, i.reserved;

-- -----------------------------------------------------------------------------
-- Default-deny Row Level Security.
--
-- Listed explicitly rather than looped, so that adding a table and forgetting
-- to protect it shows up as an omission in review.
-- -----------------------------------------------------------------------------

alter table public.locales                    enable row level security;
alter table public.pack_types                 enable row level security;
alter table public.suppliers                  enable row level security;
alter table public.brands                     enable row level security;
alter table public.categories                 enable row level security;
alter table public.media_assets               enable row level security;
alter table public.product_families           enable row level security;
alter table public.product_option_axes        enable row level security;
alter table public.product_option_values      enable row level security;
alter table public.product_family_axes        enable row level security;
alter table public.products                   enable row level security;
alter table public.product_option_assignments enable row level security;
alter table public.product_media              enable row level security;
alter table public.product_content            enable row level security;
alter table public.category_content           enable row level security;

alter table public.inventory                  enable row level security;
alter table public.inventory_movements        enable row level security;

alter table public.customers                  enable row level security;
alter table public.customer_addresses         enable row level security;
alter table public.delivery_zones             enable row level security;

alter table public.orders                     enable row level security;
alter table public.order_items                enable row level security;
alter table public.order_events               enable row level security;

alter table public.admin_profiles             enable row level security;
alter table public.audit_events               enable row level security;

alter table public.sync_jobs                  enable row level security;
alter table public.sync_events                enable row level security;
alter table public.sync_state                 enable row level security;
alter table public.sync_conflicts             enable row level security;

alter table public.analytics_events           enable row level security;
