-- =============================================================================
-- Jojo Usafi — 0011 Supabase Storage: buckets and their security
--
-- ARCHITECTURE ONLY. This migration creates the buckets and the rules that
-- govern them. IT UPLOADS NOTHING. The 95 approved product photographs are
-- still served from `public/products` as committed build artifacts; moving them
-- into Storage is a later build, and doing it before the rules exist would mean
-- deciding the rules by accident.
--
-- Three buckets, split by who may write to them rather than by what they hold:
--
--   product-media   product photographs        Owner + Manager write
--   brand-media     brand logos and marks      Owner + Manager write
--   site-content    homepage and page imagery  Owner + Manager write
--
-- All three are PUBLIC for reading. A shop's product photograph is meant to be
-- fetched by a stranger's browser, cached by a CDN and hot-linked in a WhatsApp
-- preview. Marking them private would mean signing every image URL on every
-- page for no security gain — the photographs are the advertisement.
--
-- Nothing private lives in Storage. There is no bucket for customer documents,
-- payment evidence or exports; when one is needed it will be created private,
-- with its own policies, rather than by relaxing one of these.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Buckets.
--
-- `file_size_limit` and `allowed_mime_types` are enforced by the Storage API
-- before a byte is written, so a 40 MB phone photograph or a stray PDF is
-- refused at the door rather than discovered later on a product page.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-media', 'product-media', true,
    5242880,                                    -- 5 MB
    array['image/webp', 'image/png', 'image/jpeg', 'image/avif']
  ),
  (
    'brand-media', 'brand-media', true,
    2097152,                                    -- 2 MB
    array['image/webp', 'image/png', 'image/svg+xml']
  ),
  (
    'site-content', 'site-content', true,
    5242880,                                    -- 5 MB
    array['image/webp', 'image/png', 'image/jpeg', 'image/avif']
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Reading.
--
-- The public URL of a public bucket is served without consulting these policies
-- at all; this policy is what makes the same object readable through the
-- authenticated API, and — just as important — what makes the LIST of objects
-- readable. A bucket whose contents cannot be listed cannot be managed from the
-- admin dashboard.
-- -----------------------------------------------------------------------------

create policy "Jojo public buckets are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('product-media', 'brand-media', 'site-content'));

-- -----------------------------------------------------------------------------
-- Writing.
--
-- products.editVisibility / products.editPricing / website.manage all sit with
-- Owner and Manager, so image management does too. Order staff advance orders;
-- they do not change what the shop looks like.
--
-- `owner_id` is left to Storage to populate. The audit answer to "who replaced
-- this photograph" is an audit_events row written by the server action, next to
-- the media_assets row it changed — not a Storage column that only says which
-- login uploaded the bytes.
-- -----------------------------------------------------------------------------

create policy "Jojo managers upload media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('product-media', 'brand-media', 'site-content')
    and (select public.jojo_manages_catalogue())
  );

create policy "Jojo managers replace media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('product-media', 'brand-media', 'site-content')
    and (select public.jojo_manages_catalogue())
  )
  with check (
    bucket_id in ('product-media', 'brand-media', 'site-content')
    and (select public.jojo_manages_catalogue())
  );

-- Deleting an object is deliberately narrower than replacing one. A product
-- photograph that is still referenced by `media_assets` must not vanish from
-- under a live product page, and the schema's own rule is that history is kept:
-- `product_media.media_id` is `on delete restrict`. Removing bytes for good is
-- an Owner's decision.
create policy "Jojo owner deletes media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('product-media', 'brand-media', 'site-content')
    and (select public.jojo_is_owner())
  );

-- -----------------------------------------------------------------------------
-- The path convention, recorded where it cannot be lost.
--
-- media_assets.storage_path is the second half of the pair that
-- media_assets_path_unique constrains, so the convention below is what makes
-- that constraint meaningful:
--
--   product-media/<SKU>/<sku>-<role>-<n>.webp     EP01-A02/ep01-a02-primary-1.webp
--   brand-media/<brand-slug>/logo.webp
--   site-content/<slot>/<name>.webp
--
-- SKU-first, because SKU is the stable identity: renaming a product never moves
-- its photographs, and an orphaned folder is immediately readable as a SKU that
-- no longer exists.
-- -----------------------------------------------------------------------------

comment on column public.media_assets.storage_path is
  'Path within storage_bucket. Convention: <SKU>/<sku>-<role>-<n>.webp for product-media, <brand-slug>/logo.webp for brand-media, <slot>/<name>.webp for site-content.';
