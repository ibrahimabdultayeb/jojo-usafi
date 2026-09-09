-- =============================================================================
-- Jojo Usafi — 0016 Commerce: quoting, reserving, ordering, cancelling
--
-- This is the migration that turns a catalogue into a shop.
--
-- THE ONE RULE EVERYTHING HERE EXISTS TO PROTECT
--
--     available = on_hand - reserved,  and it may never go negative.
--
-- A cart reserves nothing. Browsing reserves nothing. Stock is committed at
-- exactly one moment — a successful order — and that moment is a single
-- PostgreSQL transaction that either does all of it or none of it.
--
-- WHY THIS IS SQL AND NOT TYPESCRIPT
--
-- Two shoppers can reach the last jerrycan in the same millisecond. Deciding
-- "is there enough?" in application code and then writing the reservation is
-- two round trips with a gap in the middle, and that gap is where overselling
-- lives. Inside one function the read is `SELECT … FOR UPDATE`: the second
-- transaction waits for the first to finish and then sees the truth.
--
-- Rows are locked in a deterministic order (by product id) so two orders
-- containing the same two products in opposite order cannot deadlock.
--
-- THE TRUST BOUNDARY
--
-- The browser may say WHICH SKUs and HOW MANY. It may not say what anything
-- costs. Every price, the delivery fee, the discount and the total are computed
-- here from the current rows; a request that includes a price is simply
-- ignored, because there is no parameter to put it in.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Shop settings: one row, for the values that are policy rather than data.
--
-- Both reservation thresholds are NULLABLE and start null, which means "not
-- decided yet". They are not invented here — how long an unconfirmed order may
-- hold stock is Ibrahim's decision, and a default would be a guess wearing the
-- costume of a rule.
--
-- What matters architecturally is that the column exists and that
-- `jojo_stale_reservations()` can already list what would expire, so no
-- reservation is capable of being held forever with no way to find it.
-- -----------------------------------------------------------------------------

create table public.shop_settings (
  id boolean primary key default true check (id),

  -- Minutes after which an unconfirmed order should be asked about.
  reservation_warning_minutes  integer check (reservation_warning_minutes is null or reservation_warning_minutes > 0),
  -- Minutes after which its stock should be released. At least the warning.
  reservation_expiry_minutes   integer check (reservation_expiry_minutes  is null or reservation_expiry_minutes  > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_settings_expiry_after_warning check (
    reservation_warning_minutes is null
    or reservation_expiry_minutes is null
    or reservation_expiry_minutes >= reservation_warning_minutes
  )
);

comment on table public.shop_settings is
  'One row. Values that are business policy rather than catalogue data. Reservation thresholds start null — undecided, not zero.';

insert into public.shop_settings (id) values (true);

create trigger shop_settings_updated_at
  before update on public.shop_settings
  for each row execute function public.jojo_set_updated_at();

alter table public.shop_settings enable row level security;

create policy shop_settings_public_read on public.shop_settings
  for select to anon, authenticated using (true);

create policy shop_settings_owner_update on public.shop_settings
  for update to authenticated
  using ((select public.jojo_is_owner()))
  with check ((select public.jojo_is_owner()));

grant select on public.shop_settings to anon, authenticated;
grant select, insert, update on public.shop_settings to service_role;


-- -----------------------------------------------------------------------------
-- When this order's reservation should be reviewed, and when it was let go.
-- -----------------------------------------------------------------------------

alter table public.orders
  add column reservation_expires_at  timestamptz,
  add column reservation_released_at timestamptz;

comment on column public.orders.reservation_expires_at is
  'When the stock this order holds should be released if it is still unconfirmed. Null until shop_settings.reservation_expiry_minutes is decided.';

create index orders_reservation_expiry_idx
  on public.orders (reservation_expires_at)
  where reservation_expires_at is not null and reservation_released_at is null;


-- =============================================================================
-- Resolving a cart into priced, checked lines
--
-- Shared by quoting and ordering so the two can never disagree about what a
-- cart costs. Read-only, and it consults `product_shelf` — the one definition
-- of "a customer may see this" — so a hidden or unphotographed product cannot
-- be bought by knowing its SKU.
-- =============================================================================

create or replace function public.jojo_resolve_lines(p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lines jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A cart with nothing in it cannot be ordered.'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'That is more lines than an order can carry.'
      using errcode = 'check_violation';
  end if;

  select jsonb_agg(line order by line->>'sku') into v_lines
  from (
    select jsonb_build_object(
             'product_id',   p.id,
             'sku',          p.sku,
             'product_name', p.display_name,
             'variant',      p.variant_label,
             'pack_size',    p.pack_size_label,
             'brand_name',   b.name,
             'quantity',     w.quantity,
             -- The offer price when there is one. Never the browser's number.
             'unit_price',   coalesce(p.offer_price_tzs, p.price_tzs),
             'line_total',   coalesce(p.offer_price_tzs, p.price_tzs) * w.quantity,
             'available',    coalesce(inv.available, 0),
             'orderable',    shelf.id is not null,
             'in_stock',     coalesce(inv.available, 0) >= w.quantity
           ) as line
    from jsonb_to_recordset(p_items) as w(sku text, quantity integer)
    join public.products p            on p.sku = upper(btrim(w.sku))
    join public.brands b              on b.id = p.brand_id
    left join public.product_shelf shelf on shelf.id = p.id
    left join public.inventory inv     on inv.product_id = p.id and inv.location_code = 'main'
  ) resolved;

  return coalesce(v_lines, '[]'::jsonb);
end;
$$;


-- =============================================================================
-- Quote: what would this cart cost, right now, according to the database?
--
-- Read-only and safe to call from anywhere. It reserves nothing and promises
-- nothing — availability can change between quoting and ordering, which is
-- exactly why the order path checks again under a lock.
-- =============================================================================

create or replace function public.jojo_quote_order(p_items jsonb, p_zone_slug text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lines jsonb;
  v_requested integer;
  v_subtotal integer;
  v_zone public.delivery_zones;
  v_fee integer := 0;
  v_problems jsonb := '[]'::jsonb;
  v_line jsonb;
begin
  v_lines := public.jojo_resolve_lines(p_items);
  v_requested := jsonb_array_length(p_items);

  -- A SKU that resolved to nothing has been archived, renamed or never existed.
  if jsonb_array_length(v_lines) < v_requested then
    v_problems := v_problems || jsonb_build_object(
      'kind', 'unknown_sku',
      'message', 'Something in your basket is no longer in the shop.');
  end if;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    if (v_line->>'quantity')::integer <= 0 or (v_line->>'quantity')::integer > 999 then
      v_problems := v_problems || jsonb_build_object(
        'kind', 'bad_quantity', 'sku', v_line->>'sku',
        'message', format('Choose between 1 and 999 of %s.', v_line->>'product_name'));
    elsif not (v_line->>'orderable')::boolean then
      v_problems := v_problems || jsonb_build_object(
        'kind', 'not_orderable', 'sku', v_line->>'sku',
        'message', format('%s is not on sale at the moment.', v_line->>'product_name'));
    elsif not (v_line->>'in_stock')::boolean then
      v_problems := v_problems || jsonb_build_object(
        'kind', 'insufficient_stock', 'sku', v_line->>'sku',
        'available', (v_line->>'available')::integer,
        'message', case
          when (v_line->>'available')::integer = 0
            then format('%s has just sold out.', v_line->>'product_name')
          else format('Only %s of %s left.', v_line->>'available', v_line->>'product_name')
        end);
    end if;
  end loop;

  select coalesce(sum((line->>'line_total')::integer), 0)
    into v_subtotal
  from jsonb_array_elements(v_lines) line
  where (line->>'orderable')::boolean;

  if p_zone_slug is not null then
    select * into v_zone from public.delivery_zones where slug = p_zone_slug;

    if v_zone.id is null or not v_zone.active then
      v_problems := v_problems || jsonb_build_object(
        'kind', 'zone_unavailable',
        'message', 'We are not delivering to that area at the moment.');
    else
      -- Marking a zone free is how the fee is waived. The stored fee is
      -- already constrained to 0 in that case; this is belt and braces.
      v_fee := case when v_zone.free_delivery then 0 else v_zone.fee_tzs end;
    end if;
  end if;

  return jsonb_build_object(
    'items',           v_lines,
    'subtotal_tzs',    v_subtotal,
    'discount_tzs',    0,
    'delivery_fee_tzs', v_fee,
    'total_tzs',       v_subtotal - 0 + v_fee,
    'zone',            case when v_zone.id is null then null else jsonb_build_object(
                          'id', v_zone.id, 'slug', v_zone.slug, 'name', v_zone.name,
                          'fee_tzs', v_fee, 'free_delivery', v_zone.free_delivery) end,
    'problems',        v_problems,
    'ok',              jsonb_array_length(v_problems) = 0,
    'quoted_at',       now()
  );
end;
$$;


-- =============================================================================
-- Place the order. One transaction, all of it or none of it.
-- =============================================================================

create or replace function public.jojo_place_order(
  p_items                jsonb,
  p_customer_name        text,
  p_customer_phone_e164  text,
  p_zone_slug            text,
  p_delivery_address     text,
  p_payment_preference   public.payment_preference,
  p_customer_email       text default null,
  p_customer_phone_display text default null,
  p_delivery_landmark    text default null,
  p_delivery_instructions text default null,
  p_customer_note        text default null,
  p_locale               text default 'en',
  p_channel              text default 'storefront'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_lines jsonb;
  v_line jsonb;
  v_ids uuid[];
  v_zone public.delivery_zones;
  v_fee integer;
  v_subtotal integer;
  v_total integer;
  v_customer_id uuid;
  v_order public.orders;
  v_expiry_minutes integer;
  v_position integer := 0;
begin
  -- ---- the request itself ---------------------------------------------------
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then
    raise exception 'Please give us a name for the delivery.' using errcode = 'check_violation';
  end if;
  if p_customer_phone_e164 !~ '^\+255[67][0-9]{8}$' then
    raise exception 'That does not look like a Tanzanian mobile number.' using errcode = 'check_violation';
  end if;
  if p_delivery_address is null or length(btrim(p_delivery_address)) = 0 then
    raise exception 'Please tell the rider where to bring it.' using errcode = 'check_violation';
  end if;

  select * into v_zone from public.delivery_zones where slug = p_zone_slug;
  if v_zone.id is null or not v_zone.active then
    raise exception 'We are not delivering to that area at the moment.' using errcode = 'check_violation';
  end if;
  v_fee := case when v_zone.free_delivery then 0 else v_zone.fee_tzs end;

  -- ---- LOCK FIRST, then decide ---------------------------------------------
  -- Everything below this point sees stock that no other transaction can change
  -- until this one ends. Locked in product-id order so two orders sharing two
  -- products in opposite order cannot deadlock each other.
  select array_agg(p.id order by p.id) into v_ids
  from public.products p
  where p.sku in (select upper(btrim(value->>'sku')) from jsonb_array_elements(p_items) value);

  if v_ids is null then
    raise exception 'Nothing in your basket is in the shop any more.' using errcode = 'check_violation';
  end if;

  perform 1
  from public.inventory
  where product_id = any (v_ids) and location_code = 'main'
  order by product_id
  for update;

  -- ---- price and check, now that the numbers cannot move -------------------
  v_lines := public.jojo_resolve_lines(p_items);

  if jsonb_array_length(v_lines) < jsonb_array_length(p_items) then
    raise exception 'Something in your basket is no longer in the shop.' using errcode = 'check_violation';
  end if;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    if (v_line->>'quantity')::integer <= 0 or (v_line->>'quantity')::integer > 999 then
      raise exception 'Choose between 1 and 999 of %.', v_line->>'product_name'
        using errcode = 'check_violation';
    end if;
    if not (v_line->>'orderable')::boolean then
      raise exception '% is not on sale at the moment.', v_line->>'product_name'
        using errcode = 'check_violation';
    end if;
    if (v_line->>'available')::integer < (v_line->>'quantity')::integer then
      raise exception 'INSUFFICIENT_STOCK: % — % left, % requested.',
        v_line->>'product_name', v_line->>'available', v_line->>'quantity'
        using errcode = 'check_violation';
    end if;
  end loop;

  select coalesce(sum((line->>'line_total')::integer), 0) into v_subtotal
  from jsonb_array_elements(v_lines) line;
  v_total := v_subtotal + v_fee;

  -- ---- the customer --------------------------------------------------------
  -- Phone is the identity. A returning shopper updates their name and email;
  -- the ORDER keeps its own snapshot regardless, so changing a profile later
  -- never rewrites what an old order said.
  insert into public.customers (phone_e164, phone_display, full_name, email, first_ordered_at, last_ordered_at)
  values (p_customer_phone_e164, p_customer_phone_display, btrim(p_customer_name),
          nullif(btrim(coalesce(p_customer_email, '')), '')::citext, now(), now())
  on conflict (phone_e164) do update
    set full_name       = excluded.full_name,
        phone_display   = coalesce(excluded.phone_display, public.customers.phone_display),
        email           = coalesce(excluded.email, public.customers.email),
        last_ordered_at = now(),
        first_ordered_at = coalesce(public.customers.first_ordered_at, now())
  returning id into v_customer_id;

  select reservation_expiry_minutes into v_expiry_minutes from public.shop_settings where id;

  -- ---- the order -----------------------------------------------------------
  -- `order_number` defaults to next_order_number(), which is nextval() on a
  -- sequence: concurrency-safe, gap-tolerant, and never derived by counting
  -- rows. Two simultaneous orders cannot be handed the same number.
  insert into public.orders (
    customer_id, customer_name, customer_phone_e164, customer_phone_display, customer_email,
    delivery_zone_id, delivery_zone_name, delivery_address, delivery_landmark,
    delivery_instructions, delivery_fee_tzs,
    subtotal_tzs, discount_tzs, total_tzs,
    payment_preference, state, channel, locale, customer_note,
    reservation_expires_at
  ) values (
    v_customer_id, btrim(p_customer_name), p_customer_phone_e164, p_customer_phone_display,
    nullif(btrim(coalesce(p_customer_email, '')), '')::citext,
    v_zone.id, v_zone.name, btrim(p_delivery_address), nullif(btrim(coalesce(p_delivery_landmark, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), v_fee,
    v_subtotal, 0, v_total,
    p_payment_preference, 'new', p_channel, coalesce(p_locale, 'en'),
    nullif(btrim(coalesce(p_customer_note, '')), ''),
    case when v_expiry_minutes is null then null
         else now() + make_interval(mins => v_expiry_minutes) end
  )
  returning * into v_order;

  -- ---- the lines, snapshotted ----------------------------------------------
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

    -- ---- the reservation ---------------------------------------------------
    update public.inventory
       set reserved = reserved + (v_line->>'quantity')::integer
     where product_id = (v_line->>'product_id')::uuid and location_code = 'main';

    insert into public.inventory_movements (
      product_id, location_code, kind, on_hand_delta, reserved_delta,
      on_hand_after, reserved_after, order_id, actor_type, actor_label
    )
    select (v_line->>'product_id')::uuid, 'main', 'reservation', 0, (v_line->>'quantity')::integer,
           inv.on_hand, inv.reserved, v_order.id, 'customer', v_order.customer_name
    from public.inventory inv
    where inv.product_id = (v_line->>'product_id')::uuid and inv.location_code = 'main';
  end loop;

  -- ---- the history ---------------------------------------------------------
  insert into public.order_events (order_id, kind, to_state, actor_type, actor_label, summary, payload)
  values (v_order.id, 'order_created', 'new', 'customer', v_order.customer_name,
          format('Order placed on the website — %s item(s), %s TZS', jsonb_array_length(v_lines), v_total),
          jsonb_build_object('channel', p_channel, 'locale', p_locale));

  insert into public.order_events (order_id, kind, actor_type, actor_label, summary, payload)
  values (v_order.id, 'stock_reserved', 'system', 'checkout',
          'Stock reserved for this order',
          jsonb_build_object('lines', jsonb_array_length(v_lines)));

  return jsonb_build_object(
    'order_id',      v_order.id,
    'order_number',  v_order.order_number,
    'state',         v_order.state,
    'subtotal_tzs',  v_order.subtotal_tzs,
    'delivery_fee_tzs', v_order.delivery_fee_tzs,
    'total_tzs',     v_order.total_tzs,
    'placed_at',     v_order.placed_at
  );
end;
$$;


-- =============================================================================
-- Cancel an order and give the stock back. Idempotent.
-- =============================================================================

create or replace function public.jojo_cancel_order(
  p_order_id uuid,
  p_reason text,
  p_actor_admin_id uuid default null,
  p_actor_label text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_released integer := 0;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A cancelled order must say why.' using errcode = 'check_violation';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'That order does not exist.' using errcode = 'no_data_found';
  end if;

  -- Idempotent: cancelling an already-cancelled order is a no-op that reports
  -- success, because a retried request must not double-release stock.
  if v_order.state = 'cancelled' then
    return jsonb_build_object('order_number', v_order.order_number, 'state', 'cancelled',
                              'released', 0, 'already', true);
  end if;

  if v_order.state in ('completed', 'out_for_delivery') then
    raise exception 'An order that is % cannot be cancelled.', v_order.state
      using errcode = 'check_violation';
  end if;

  -- Release whatever this order is still holding. `reservation_released_at`
  -- is what makes the release happen once: a second call finds it set.
  if v_order.reservation_released_at is null then
    for v_item in
      select * from public.order_items where order_id = v_order.id and product_id is not null
    loop
      perform 1 from public.inventory
       where product_id = v_item.product_id and location_code = 'main' for update;

      update public.inventory
         set reserved = greatest(0, reserved - v_item.quantity)
       where product_id = v_item.product_id and location_code = 'main';

      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
      )
      select v_item.product_id, 'main', 'reservation_release', 0, -v_item.quantity,
             inv.on_hand, inv.reserved, v_order.id,
             case when p_actor_admin_id is null then 'system' else 'staff' end,
             p_actor_admin_id, coalesce(p_actor_label, 'cancellation')
      from public.inventory inv
      where inv.product_id = v_item.product_id and inv.location_code = 'main';

      v_released := v_released + v_item.quantity;
    end loop;
  end if;

  update public.orders
     set state = 'cancelled',
         cancellation_reason = btrim(p_reason),
         cancelled_at = now(),
         reservation_released_at = coalesce(reservation_released_at, now())
   where id = v_order.id
   returning * into v_order;

  insert into public.order_events (order_id, kind, from_state, to_state, actor_type, actor_admin_id, actor_label, summary)
  values (v_order.id, 'cancelled', v_order.state, 'cancelled',
          case when p_actor_admin_id is null then 'system' else 'staff' end,
          p_actor_admin_id, coalesce(p_actor_label, 'system'),
          format('Cancelled: %s', btrim(p_reason)));

  if v_released > 0 then
    insert into public.order_events (order_id, kind, actor_type, actor_label, summary, payload)
    values (v_order.id, 'stock_released', 'system', 'cancellation',
            format('%s unit(s) returned to available stock', v_released),
            jsonb_build_object('units', v_released));
  end if;

  return jsonb_build_object('order_number', v_order.order_number, 'state', 'cancelled',
                            'released', v_released, 'already', false);
end;
$$;


-- =============================================================================
-- Reservations that have been held too long.
--
-- The scheduler that acts on this is deliberately absent — the durations are
-- Ibrahim's to decide and there is nothing to schedule until they exist. What
-- matters now is that "which orders are holding stock they should not be" is a
-- question with an answer, so a reservation can never be lost.
-- =============================================================================

create or replace function public.jojo_stale_reservations()
returns table (
  order_id uuid,
  order_number text,
  state public.order_state,
  placed_at timestamptz,
  reservation_expires_at timestamptz,
  units integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, o.order_number, o.state, o.placed_at, o.reservation_expires_at,
         coalesce((select sum(i.quantity)::integer from public.order_items i where i.order_id = o.id), 0)
  from public.orders o
  where o.reservation_released_at is null
    and o.reservation_expires_at is not null
    and o.reservation_expires_at < now()
    and o.state in ('new', 'awaiting_confirmation')
  order by o.reservation_expires_at;
$$;


-- =============================================================================
-- Track an order: the customer-safe projection.
--
-- Both the order number AND the phone that placed it are required, and a
-- mismatch is indistinguishable from a wrong number — knowing JU-000128 exists
-- must not be enough to read it, or every order could be read by counting.
--
-- Note what is NOT returned: staff notes, actor identities, payment references,
-- audit and sync internals. The shopper gets their own order, and no more of it
-- than they wrote themselves.
-- =============================================================================

create or replace function public.jojo_track_order(p_order_number text, p_phone_e164 text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if p_order_number is null or p_phone_e164 is null then
    return null;
  end if;

  select * into v_order
  from public.orders
  where order_number = upper(btrim(p_order_number))
    and customer_phone_e164 = btrim(p_phone_e164);

  if v_order.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'state',        v_order.state,
    'placed_at',    v_order.placed_at,
    'confirmed_at', v_order.confirmed_at,
    'dispatched_at', v_order.dispatched_at,
    'completed_at', v_order.completed_at,
    'cancelled_at', v_order.cancelled_at,
    'payment_preference', v_order.payment_preference,
    'payment_status',     v_order.payment_status,
    'delivery_zone_name', v_order.delivery_zone_name,
    'delivery_address',   v_order.delivery_address,
    'delivery_fee_tzs',   v_order.delivery_fee_tzs,
    'subtotal_tzs',       v_order.subtotal_tzs,
    'discount_tzs',       v_order.discount_tzs,
    'total_tzs',          v_order.total_tzs,
    'customer_name',      v_order.customer_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'sku', i.sku, 'product_name', i.product_name, 'pack_size', i.pack_size_label,
               'quantity', i.quantity, 'unit_price_tzs', i.unit_price_tzs,
               'line_total_tzs', i.line_total_tzs) order by i.position)
      from public.order_items i where i.order_id = v_order.id), '[]'::jsonb)
  );
end;
$$;


-- =============================================================================
-- Stock operations for staff. Never a bare overwrite.
--
-- `on_hand` is not editable. It moves because something happened — stock
-- arrived, or somebody counted the shelf — and both write a ledger entry in the
-- same transaction as the number they change. A count that agrees with the
-- system writes nothing, because a movement that changes nothing is not a
-- record of anything.
-- =============================================================================

create or replace function public.jojo_add_stock(
  p_product_id uuid,
  p_quantity integer,
  p_reference text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.jojo_admin_id();
  v_inv public.inventory;
begin
  if not public.jojo_manages_catalogue() then
    raise exception 'Only an Owner or a Manager can change stock.' using errcode = 'insufficient_privilege';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'How many arrived? Enter a number above zero.' using errcode = 'check_violation';
  end if;

  select * into v_inv from public.inventory
   where product_id = p_product_id and location_code = 'main' for update;

  if v_inv.product_id is null then
    insert into public.inventory (product_id, location_code, on_hand, reserved)
    values (p_product_id, 'main', 0, 0)
    returning * into v_inv;
  end if;

  update public.inventory set on_hand = on_hand + p_quantity
   where product_id = p_product_id and location_code = 'main'
   returning * into v_inv;

  insert into public.inventory_movements (
    product_id, location_code, kind, on_hand_delta, reserved_delta,
    on_hand_after, reserved_after, reference, actor_type, actor_admin_id,
    actor_label
  ) values (
    p_product_id, 'main', 'receipt', p_quantity, 0, v_inv.on_hand, v_inv.reserved,
    nullif(btrim(coalesce(p_reference, '')), ''), 'staff', v_admin,
    (select full_name from public.admin_profiles where id = v_admin)
  );

  return jsonb_build_object('on_hand', v_inv.on_hand, 'reserved', v_inv.reserved,
                            'available', v_inv.available, 'added', p_quantity);
end;
$$;

create or replace function public.jojo_count_stock(
  p_product_id uuid,
  p_counted integer,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.jojo_admin_id();
  v_inv public.inventory;
  v_delta integer;
begin
  if not public.jojo_manages_catalogue() then
    raise exception 'Only an Owner or a Manager can change stock.' using errcode = 'insufficient_privilege';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'A count cannot be negative.' using errcode = 'check_violation';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A stock count has to say what was counted and why.' using errcode = 'check_violation';
  end if;

  select * into v_inv from public.inventory
   where product_id = p_product_id and location_code = 'main' for update;

  if v_inv.product_id is null then
    insert into public.inventory (product_id, location_code, on_hand, reserved)
    values (p_product_id, 'main', 0, 0)
    returning * into v_inv;
  end if;

  -- Stock already promised to an order is physically on the shelf, so a count
  -- below it means the count and the promises disagree. Refuse rather than
  -- silently breaking `reserved <= on_hand`.
  if p_counted < v_inv.reserved then
    raise exception
      'Counted % but % are already promised to orders. Cancel or complete those first.',
      p_counted, v_inv.reserved
      using errcode = 'check_violation';
  end if;

  v_delta := p_counted - v_inv.on_hand;

  if v_delta = 0 then
    return jsonb_build_object('on_hand', v_inv.on_hand, 'reserved', v_inv.reserved,
                              'available', v_inv.available, 'delta', 0, 'changed', false);
  end if;

  update public.inventory set on_hand = p_counted, last_counted_at = now()
   where product_id = p_product_id and location_code = 'main'
   returning * into v_inv;

  insert into public.inventory_movements (
    product_id, location_code, kind, on_hand_delta, reserved_delta,
    on_hand_after, reserved_after, reason, actor_type, actor_admin_id, actor_label
  ) values (
    p_product_id, 'main', 'stock_count', v_delta, 0, v_inv.on_hand, v_inv.reserved,
    btrim(p_reason), 'staff', v_admin,
    (select full_name from public.admin_profiles where id = v_admin)
  );

  return jsonb_build_object('on_hand', v_inv.on_hand, 'reserved', v_inv.reserved,
                            'available', v_inv.available, 'delta', v_delta, 'changed', true);
end;
$$;


-- =============================================================================
-- Who may call what
--
-- The ordering path is SERVER ONLY. `jojo_place_order` bypasses RLS by design —
-- it has to, in order to write a customer, an order, its lines, the inventory
-- and two ledgers in one transaction — so letting a browser call it directly
-- would be handing out a key to the shop. It is reached through a Next.js
-- server action holding the service-role key, which is where request-shaping,
-- and later rate limiting, belong.
--
-- Quoting and tracking are safe for anybody: quoting returns prices that are
-- already public, and tracking needs the order number AND the phone.
-- =============================================================================

revoke execute on function public.jojo_resolve_lines(jsonb) from public;
grant  execute on function public.jojo_resolve_lines(jsonb) to service_role;

revoke execute on function public.jojo_quote_order(jsonb, text) from public;
grant  execute on function public.jojo_quote_order(jsonb, text) to anon, authenticated, service_role;

revoke execute on function public.jojo_place_order(
  jsonb, text, text, text, text, public.payment_preference, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.jojo_place_order(
  jsonb, text, text, text, text, public.payment_preference, text, text, text, text, text, text, text
) to service_role;

revoke execute on function public.jojo_cancel_order(uuid, text, uuid, text) from public, anon;
grant  execute on function public.jojo_cancel_order(uuid, text, uuid, text) to service_role;

revoke execute on function public.jojo_track_order(text, text) from public;
grant  execute on function public.jojo_track_order(text, text) to anon, authenticated, service_role;

revoke execute on function public.jojo_stale_reservations() from public, anon;
grant  execute on function public.jojo_stale_reservations() to authenticated, service_role;

revoke execute on function public.jojo_add_stock(uuid, integer, text) from public, anon;
grant  execute on function public.jojo_add_stock(uuid, integer, text) to authenticated, service_role;

revoke execute on function public.jojo_count_stock(uuid, integer, text) from public, anon;
grant  execute on function public.jojo_count_stock(uuid, integer, text) to authenticated, service_role;
