-- =============================================================================
-- Jojo Usafi — 0021 jojo_amend_order: the enum cast, again
--
-- The first real amendment failed with 42804: "column kind is of type
-- inventory_movement_kind but expression is of type text".
--
-- Exactly the trap migration 0017 hit in jojo_cancel_order, and worth writing
-- down twice because it is genuinely surprising: a bare string literal in
-- VALUES is an UNKNOWN that PostgreSQL coerces to the enum quite happily, but
-- the same literal inside a CASE in an INSERT ... SELECT is resolved as text
-- first, and text does not implicitly become an enum.
--
-- The fix is to give the value a type before it is used, so there is nothing
-- left to infer.
-- =============================================================================

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
  v_kind public.inventory_movement_kind;
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
      -- Hoisted into a typed variable rather than written as a CASE inside
      -- the INSERT ... SELECT below. PostgreSQL resolves a bare CASE over
      -- string literals as text BEFORE it meets the enum column and refuses
      -- with 42804 — the same trap migration 0017 hit in jojo_cancel_order.
      v_kind := case when v_delta > 0 then 'reservation' else 'reservation_release' end;

      update public.inventory
         set reserved = reserved + v_delta
       where product_id = v_id and location_code = 'main';

      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
      )
      select v_id, 'main',
             v_kind, 0, v_delta, inv.on_hand, inv.reserved, v_order.id,
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

revoke execute on function public.jojo_amend_order(uuid, jsonb, text, uuid) from public, anon;
grant  execute on function public.jojo_amend_order(uuid, jsonb, text, uuid) to service_role;
