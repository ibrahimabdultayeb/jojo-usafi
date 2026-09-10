-- =============================================================================
-- Jojo Usafi — 0020 Operational completeness
--
-- Three things the shop cannot open without, and one it cannot be trusted
-- without:
--
--   1. shop_settings grows up. It held two reservation thresholds; it now also
--      holds the words on the homepage, in both languages, and the shop's own
--      contact details. Everything customer-facing is nullable and starts NULL:
--      an unset phone number is shown as unset, never as a plausible-looking
--      invention.
--
--   2. jojo_amend_order. Staff can change what is in an order before it leaves
--      the building. One transaction, prices re-read from the catalogue, stock
--      locked in a deterministic order, and a refusal rather than an oversell.
--
--   3. jojo_expire_reservations. Unconfirmed orders let their stock go once
--      Ibrahim decides how long "too long" is. It does NOTHING while the
--      durations are null, which is the current state and is not a bug.
--
-- NOTHING HERE IS SCHEDULED. The expiry engine is callable and idempotent; what
-- calls it, and how often, belongs with deployment.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Shop settings: the words, and the shop's own details.
--
-- Customer-facing copy is stored per language rather than translated at read
-- time. English is the fallback: a blank Kiswahili field means "say it in
-- English", not "say nothing".
-- -----------------------------------------------------------------------------

alter table public.shop_settings
  -- The announcement strip above the header.
  add column if not exists announcement_en      text,
  add column if not exists announcement_sw      text,

  -- The hero.
  add column if not exists hero_heading_en      text,
  add column if not exists hero_heading_sw      text,
  add column if not exists hero_sub_en          text,
  add column if not exists hero_sub_sw          text,
  add column if not exists hero_cta_label_en    text,
  add column if not exists hero_cta_label_sw    text,
  add column if not exists hero_cta_href        text,

  -- A promotion band, off by default because an empty promotion is worse than
  -- none at all.
  add column if not exists promo_banner_en      text,
  add column if not exists promo_banner_sw      text,
  add column if not exists promo_banner_visible boolean not null default false,

  -- Which homepage sections appear. Named slots, not a page builder.
  add column if not exists show_categories      boolean not null default true,
  add column if not exists show_best_sellers    boolean not null default true,
  add column if not exists show_featured        boolean not null default true,
  add column if not exists show_category_grids  boolean not null default true,
  add column if not exists show_trust           boolean not null default true,
  add column if not exists show_delivery_banner boolean not null default true,
  add column if not exists show_brands          boolean not null default true,
  add column if not exists show_how_it_works    boolean not null default true,

  -- The order category tiles appear in, by slug. Null means "as the catalogue
  -- orders them", which is a real answer and not a missing one.
  add column if not exists category_order       text[],

  -- The shop's own details. All null until Ibrahim provides them: a placeholder
  -- phone number that reaches nobody is worse than a visibly missing one.
  add column if not exists whatsapp_e164        text,
  add column if not exists phone_e164           text,
  add column if not exists contact_email        citext,
  add column if not exists address_line         text,
  add column if not exists logo_media_id        uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_settings_whatsapp_shape') then
    alter table public.shop_settings
      add constraint shop_settings_whatsapp_shape
      check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shop_settings_phone_shape') then
    alter table public.shop_settings
      add constraint shop_settings_phone_shape
      check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shop_settings_cta_href_shape') then
    alter table public.shop_settings
      add constraint shop_settings_cta_href_shape
      check (hero_cta_href is null or hero_cta_href ~ '^/[A-Za-z0-9/_?=&#.-]*$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shop_settings_logo_fk') then
    alter table public.shop_settings
      add constraint shop_settings_logo_fk
      foreign key (logo_media_id) references public.media_assets (id) on delete set null;
  end if;
end $$;

comment on column public.shop_settings.category_order is
  'Category slugs in the order they should appear. Null means the catalogue''s own order.';
comment on column public.shop_settings.whatsapp_e164 is
  'Null until Ibrahim provides the real number. Never a placeholder.';

-- THE GRANT WAS MISSING. Migration 0018 wrote an Owner UPDATE policy for this
-- table and granted only SELECT, so the policy guarded a verb nobody held and
-- an Owner could not save a setting at all. The two locks again: a policy
-- without its grant is a locked door in a wall with no doorway.
grant update on public.shop_settings to authenticated;


-- -----------------------------------------------------------------------------
-- 2. jojo_amend_order — change an order before it leaves.
--
-- Takes the FINAL set of lines, not a diff. The caller says what the order
-- should now contain and the database works out what that means for stock,
-- which is the only way to be sure the two agree.
--
-- WHY PRICES ARE RE-READ. The catalogue is the authority on what something
-- costs, and an amendment is a new agreement about the whole order. Trusting a
-- number the browser sent, or a number snapshotted weeks ago, is how an order
-- ends up selling at a price the shop no longer offers.
--
-- WHY THE LOCK ORDER MATTERS. Inventory rows are locked in product-id order,
-- exactly as `jojo_place_order` does, so two amendments touching the same two
-- products cannot deadlock by approaching them from opposite ends.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_amend_order(
  p_order_id       uuid,
  p_items          jsonb,
  p_reason         text,
  p_actor_admin_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_actor public.actor_type;
  v_label text;
  v_lines jsonb;
  v_line jsonb;
  v_before jsonb;
  v_after jsonb;
  v_ids uuid[];
  v_id uuid;
  v_old integer;
  v_new integer;
  v_delta integer;
  v_available integer;
  v_subtotal integer;
  v_total integer;
  v_position integer := 0;
  v_added integer := 0;
  v_removed integer := 0;
  v_changed integer := 0;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'An amendment has to say why. What changed, and who asked for it?'
      using errcode = 'check_violation';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'That order does not exist.' using errcode = 'no_data_found';
  end if;

  -- The line in the sand. Once the goods are with a rider, what is in the box
  -- is a physical fact and no amount of database writing changes it.
  if v_order.state not in ('new', 'awaiting_confirmation', 'confirmed', 'preparing') then
    raise exception 'This order has already gone out for delivery, so its items cannot be changed.'
      using errcode = 'check_violation';
  end if;

  if v_order.reservation_released_at is not null then
    raise exception 'This order no longer holds any stock, so it cannot be amended.'
      using errcode = 'check_violation';
  end if;

  v_actor := case when p_actor_admin_id is null then 'system' else 'staff' end;
  v_label := coalesce(
    (select full_name from public.admin_profiles where id = p_actor_admin_id), 'system');

  -- ---- what it says now, for the record ------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'sku', sku, 'quantity', quantity, 'unit_price', unit_price_tzs,
           'line_total', line_total_tzs) order by sku), '[]'::jsonb)
    into v_before
  from public.order_items where order_id = v_order.id;

  -- ---- what it should say, priced by the catalogue --------------------------
  v_lines := public.jojo_resolve_lines(p_items);

  if jsonb_array_length(v_lines) <> jsonb_array_length(p_items) then
    raise exception 'One of those products is not in the catalogue.'
      using errcode = 'no_data_found';
  end if;

  -- ---- lock every product either side mentions, in id order -----------------
  select array_agg(distinct id order by id) into v_ids
  from (
    select (line->>'product_id')::uuid as id from jsonb_array_elements(v_lines) line
    union
    select product_id from public.order_items
     where order_id = v_order.id and product_id is not null
  ) touched;

  foreach v_id in array coalesce(v_ids, array[]::uuid[]) loop
    perform 1 from public.inventory
     where product_id = v_id and location_code = 'main' for update;
  end loop;

  -- ---- the increases, checked before anything moves -------------------------
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_id  := (v_line->>'product_id')::uuid;
    v_new := (v_line->>'quantity')::integer;

    select coalesce(quantity, 0) into v_old
    from public.order_items where order_id = v_order.id and product_id = v_id;
    v_old := coalesce(v_old, 0);
    v_delta := v_new - v_old;

    if v_delta > 0 then
      -- A product that has left the shelf may be reduced or removed, never
      -- increased: the shop has decided it is not selling it.
      if not (v_line->>'orderable')::boolean then
        raise exception 'INSUFFICIENT_STOCK: % is not available to add to an order.', v_line->>'product_name'
          using errcode = 'check_violation';
      end if;

      select available into v_available from public.inventory
       where product_id = v_id and location_code = 'main';

      if coalesce(v_available, 0) < v_delta then
        raise exception 'INSUFFICIENT_STOCK: only % of % left, so % more cannot be added.',
          coalesce(v_available, 0), v_line->>'product_name', v_delta
          using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  -- ---- apply, now that every increase is known to be possible ---------------
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_id  := (v_line->>'product_id')::uuid;
    v_new := (v_line->>'quantity')::integer;

    select coalesce(quantity, 0) into v_old
    from public.order_items where order_id = v_order.id and product_id = v_id;
    v_old := coalesce(v_old, 0);
    v_delta := v_new - v_old;

    if v_delta <> 0 then
      update public.inventory
         set reserved = reserved + v_delta
       where product_id = v_id and location_code = 'main';

      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
      )
      select v_id, 'main',
             case when v_delta > 0 then 'reservation' else 'reservation_release' end,
             0, v_delta, inv.on_hand, inv.reserved, v_order.id,
             v_actor, p_actor_admin_id, v_label
      from public.inventory inv
      where inv.product_id = v_id and inv.location_code = 'main';

      if v_old = 0 then v_added := v_added + 1; else v_changed := v_changed + 1; end if;
    end if;
  end loop;

  -- ---- lines that are gone entirely ----------------------------------------
  for v_id, v_old in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id
      and oi.product_id is not null
      and not exists (
        select 1 from jsonb_array_elements(v_lines) line
        where (line->>'product_id')::uuid = oi.product_id
      )
  loop
    update public.inventory
       set reserved = greatest(0, reserved - v_old)
     where product_id = v_id and location_code = 'main';

    insert into public.inventory_movements (
      product_id, location_code, kind, on_hand_delta, reserved_delta,
      on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
    )
    select v_id, 'main', 'reservation_release', 0, -v_old,
           inv.on_hand, inv.reserved, v_order.id, v_actor, p_actor_admin_id, v_label
    from public.inventory inv
    where inv.product_id = v_id and inv.location_code = 'main';

    v_removed := v_removed + 1;
  end loop;

  -- ---- rewrite the lines ----------------------------------------------------
  delete from public.order_items where order_id = v_order.id;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_position := v_position + 1;
    insert into public.order_items (
      order_id, product_id, sku, product_name, variant_label, pack_size_label, brand_name,
      quantity, unit_price_tzs, line_total_tzs, position
    ) values (
      v_order.id, (v_line->>'product_id')::uuid, v_line->>'sku', v_line->>'product_name',
      v_line->>'variant', v_line->>'pack_size', v_line->>'brand_name',
      (v_line->>'quantity')::integer, (v_line->>'unit_price')::integer,
      (v_line->>'line_total')::integer, v_position
    );
  end loop;

  -- ---- the money ------------------------------------------------------------
  select coalesce(sum((line->>'line_total')::integer), 0) into v_subtotal
  from jsonb_array_elements(v_lines) line;

  v_total := v_subtotal - coalesce(v_order.discount_tzs, 0) + coalesce(v_order.delivery_fee_tzs, 0);

  update public.orders
     set subtotal_tzs = v_subtotal,
         total_tzs    = v_total
   where id = v_order.id
   returning * into v_order;

  select coalesce(jsonb_agg(jsonb_build_object(
           'sku', sku, 'quantity', quantity, 'unit_price', unit_price_tzs,
           'line_total', line_total_tzs) order by sku), '[]'::jsonb)
    into v_after
  from public.order_items where order_id = v_order.id;

  -- ---- the record -----------------------------------------------------------
  insert into public.order_events (
    order_id, kind, actor_type, actor_admin_id, actor_label, summary, payload
  ) values (
    v_order.id, 'order_amended', v_actor, p_actor_admin_id, v_label,
    format('Order changed: %s added, %s changed, %s removed — %s',
           v_added, v_changed, v_removed, btrim(p_reason)),
    jsonb_build_object('reason', btrim(p_reason), 'before', v_before, 'after', v_after,
                       'subtotal_before', v_before, 'total_after', v_total)
  );

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'added', v_added, 'changed', v_changed, 'removed', v_removed,
    'subtotal_tzs', v_subtotal, 'total_tzs', v_total,
    'items', jsonb_array_length(v_lines)
  );
end;
$$;

comment on function public.jojo_amend_order(uuid, jsonb, text, uuid) is
  'Change an order before dispatch. One transaction: locks stock in id order, re-prices from the catalogue, refuses to oversell, records before and after.';

revoke execute on function public.jojo_amend_order(uuid, jsonb, text, uuid) from public, anon;
grant  execute on function public.jojo_amend_order(uuid, jsonb, text, uuid) to service_role;


-- -----------------------------------------------------------------------------
-- 3. jojo_expire_reservations — let go of stock nobody confirmed.
--
-- It refuses to run while the durations are null, and null is where they are.
-- That is not a half-built feature: how long an unconfirmed order may hold
-- stock is Ibrahim's decision, and a default would be this system inventing a
-- business rule.
--
-- Cancellation is delegated to `jojo_cancel_order`, which Build 08 proved
-- releases exactly once and is idempotent. Re-implementing the release here to
-- save a function call would be two implementations of the one thing that must
-- never disagree.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_expire_reservations(p_limit integer default 100)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_minutes integer;
  v_order record;
  v_expired integer := 0;
  v_released integer := 0;
  v_result jsonb;
begin
  select reservation_expiry_minutes into v_minutes from public.shop_settings where id;

  if v_minutes is null then
    return jsonb_build_object(
      'configured', false, 'expired', 0, 'released', 0,
      'note', 'No expiry time has been set, so nothing expires.');
  end if;

  for v_order in
    select o.id, o.order_number
    from public.orders o
    where o.state in ('new', 'awaiting_confirmation')
      and o.reservation_released_at is null
      and o.placed_at < now() - make_interval(mins => v_minutes)
    order by o.placed_at
    limit greatest(1, coalesce(p_limit, 100))
  loop
    v_result := public.jojo_cancel_order(
      v_order.id,
      format('Not confirmed within %s minutes — stock released automatically', v_minutes),
      null,
      'system');

    if coalesce((v_result->>'already')::boolean, false) is not true then
      v_expired := v_expired + 1;
      v_released := v_released + coalesce((v_result->>'released')::integer, 0);
    end if;
  end loop;

  return jsonb_build_object(
    'configured', true, 'minutes', v_minutes,
    'expired', v_expired, 'released', v_released);
end;
$$;

comment on function public.jojo_expire_reservations(integer) is
  'Release stock held by unconfirmed orders older than shop_settings.reservation_expiry_minutes. Does nothing while that is null. Idempotent. Nothing schedules it.';

revoke execute on function public.jojo_expire_reservations(integer) from public, anon;
grant  execute on function public.jojo_expire_reservations(integer) to service_role;
