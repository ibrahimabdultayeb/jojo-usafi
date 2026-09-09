-- =============================================================================
-- Jojo Usafi — 0018 Order operations: advancing, completing, failing
--
-- Build 08 built the two ends of an order's life — created, and cancelled. This
-- is the middle: the moves staff make, each one a single transaction that
-- changes the state, moves the stock and writes the history together.
--
-- WHERE STOCK ACTUALLY LEAVES THE SHOP
--
--   placed        reserved += n      the goods are promised, still on the shelf
--   completed     on_hand  -= n      the goods are gone, and the reservation with them
--                 reserved -= n
--
-- Nothing is deducted before completion, because until the customer has it, the
-- shop still has it. That is why a cancellation at any earlier stage is a pure
-- release and needs no compensating receipt.
--
-- WHY THE TRANSITION TABLE IS HERE AS WELL AS IN TYPESCRIPT
--
-- `src/lib/domain/orders.ts` holds the same table with 39 unit tests, and the
-- admin uses it to decide which button to draw. This one decides whether the
-- move is allowed. The application refuses politely; the database refuses
-- absolutely, and a request that never touched the application still cannot
-- send a completed order back out for delivery.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Advance an order to its next state.
--
-- Completion is the one move with consequences beyond the row: it converts the
-- reservation into a sale and it demands the money be recorded. The schema's own
-- `orders_completed_is_paid` constraint is the backstop, but this refuses first
-- and in words a person can act on.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_advance_order(
  p_order_id          uuid,
  p_to_state          public.order_state,
  p_actor_admin_id    uuid    default null,
  p_payment_method    public.payment_method default null,
  p_payment_reference text    default null
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
  v_actor public.actor_type;
  v_label text;
  v_from public.order_state;
  v_allowed boolean;
  v_sold integer := 0;
begin
  v_actor := case when p_actor_admin_id is null then 'system' else 'staff' end;
  v_label := coalesce(
    (select full_name from public.admin_profiles where id = p_actor_admin_id),
    'system');

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'That order does not exist.' using errcode = 'no_data_found';
  end if;

  v_from := v_order.state;

  -- Idempotent: asking for the state it is already in is not an error, because
  -- a retried click must not be punished.
  if v_from = p_to_state then
    return jsonb_build_object('order_number', v_order.order_number, 'state', v_from,
                              'already', true, 'sold', 0);
  end if;

  -- The same table as src/lib/domain/orders.ts, enforced rather than trusted.
  v_allowed := case v_from
    when 'new'               then p_to_state in ('awaiting_confirmation', 'confirmed', 'cancelled')
    when 'awaiting_confirmation' then p_to_state in ('confirmed', 'cancelled')
    when 'confirmed'         then p_to_state in ('preparing', 'cancelled')
    when 'preparing'         then p_to_state in ('out_for_delivery', 'cancelled')
    when 'out_for_delivery'  then p_to_state in ('completed', 'delivery_failed')
    when 'delivery_failed'   then p_to_state in ('out_for_delivery', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'An order that is % cannot become %.', v_from, p_to_state
      using errcode = 'check_violation';
  end if;

  -- Cancellation has its own function, because it has to release stock and be
  -- idempotent about it. Sending it here would be a second implementation.
  if p_to_state = 'cancelled' then
    raise exception 'Use jojo_cancel_order to cancel — it releases the stock.'
      using errcode = 'check_violation';
  end if;

  if p_to_state = 'delivery_failed' then
    raise exception 'Use jojo_fail_delivery — it has to ask whether the items came back.'
      using errcode = 'check_violation';
  end if;

  -- ---- completion: the money, then the stock ------------------------------
  if p_to_state = 'completed' then
    if p_payment_method is null then
      raise exception 'Record the payment before completing the order.'
        using errcode = 'check_violation';
    end if;
    if p_payment_method = 'digital'
       and (p_payment_reference is null or length(btrim(p_payment_reference)) = 0) then
      raise exception 'A mobile-money payment needs its transaction reference.'
        using errcode = 'check_violation';
    end if;

    for v_item in
      select * from public.order_items where order_id = v_order.id and product_id is not null
    loop
      perform 1 from public.inventory
       where product_id = v_item.product_id and location_code = 'main' for update;

      update public.inventory
         set on_hand  = on_hand  - v_item.quantity,
             reserved = greatest(0, reserved - v_item.quantity)
       where product_id = v_item.product_id and location_code = 'main';

      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
      )
      select v_item.product_id, 'main', 'sale', -v_item.quantity, -v_item.quantity,
             inv.on_hand, inv.reserved, v_order.id, v_actor, p_actor_admin_id, v_label
      from public.inventory inv
      where inv.product_id = v_item.product_id and inv.location_code = 'main';

      v_sold := v_sold + v_item.quantity;
    end loop;
  end if;

  -- ---- the row -------------------------------------------------------------
  update public.orders
     set state = p_to_state,
         confirmed_at  = case when p_to_state = 'confirmed'        then now() else confirmed_at end,
         preparing_at  = case when p_to_state = 'preparing'        then now() else preparing_at end,
         dispatched_at = case when p_to_state = 'out_for_delivery' then now() else dispatched_at end,
         completed_at  = case when p_to_state = 'completed'        then now() else completed_at end,
         payment_status    = case when p_to_state = 'completed' then 'paid' else payment_status end,
         payment_method    = case when p_to_state = 'completed' then p_payment_method else payment_method end,
         payment_reference = case when p_to_state = 'completed'
                                  then nullif(btrim(coalesce(p_payment_reference, '')), '')
                                  else payment_reference end,
         paid_at           = case when p_to_state = 'completed' then now() else paid_at end,
         reservation_released_at = case when p_to_state = 'completed'
                                        then coalesce(reservation_released_at, now())
                                        else reservation_released_at end
   where id = v_order.id
   returning * into v_order;

  insert into public.order_events (order_id, kind, from_state, to_state, actor_type, actor_admin_id, actor_label, summary)
  values (v_order.id, 'state_changed', v_from, p_to_state, v_actor, p_actor_admin_id, v_label,
          format('%s → %s', v_from, p_to_state));

  if p_to_state = 'completed' then
    insert into public.order_events (order_id, kind, actor_type, actor_admin_id, actor_label, summary, payload)
    values (v_order.id, 'payment_recorded', v_actor, p_actor_admin_id, v_label,
            format('Paid by %s', p_payment_method),
            jsonb_build_object('method', p_payment_method, 'units_sold', v_sold));
  end if;

  return jsonb_build_object('order_number', v_order.order_number, 'state', v_order.state,
                            'already', false, 'sold', v_sold);
end;
$$;


-- -----------------------------------------------------------------------------
-- A delivery that did not succeed.
--
-- The question the admin asks — "were the items returned?" — is not paperwork.
-- It decides where the goods physically are, and therefore what the shop can
-- sell tomorrow:
--
--   returned = true    the goods are back on the shelf and still promised to
--                      this order, which can be sent out again. Stock unchanged.
--
--   returned = false   the goods are not in the shop. `on_hand` must fall, the
--                      reservation is released, and a `damage_loss` movement
--                      records it with the reason — because stock that walked
--                      out of the door is a real loss, not a rounding error.
--
-- There is deliberately no default. Guessing this wrong silently corrupts the
-- stock figures in one direction or the other.
-- -----------------------------------------------------------------------------

create or replace function public.jojo_fail_delivery(
  p_order_id       uuid,
  p_items_returned boolean,
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
  v_item public.order_items;
  v_actor public.actor_type;
  v_label text;
  v_lost integer := 0;
begin
  if p_items_returned is null then
    raise exception 'Say whether the items came back — the stock figures depend on it.'
      using errcode = 'check_violation';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A failed delivery must say what happened.' using errcode = 'check_violation';
  end if;

  v_actor := case when p_actor_admin_id is null then 'system' else 'staff' end;
  v_label := coalesce(
    (select full_name from public.admin_profiles where id = p_actor_admin_id), 'system');

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'That order does not exist.' using errcode = 'no_data_found';
  end if;

  if v_order.state = 'delivery_failed' then
    return jsonb_build_object('order_number', v_order.order_number, 'state', 'delivery_failed',
                              'already', true, 'lost', 0);
  end if;

  if v_order.state <> 'out_for_delivery' then
    raise exception 'Only an order that is out for delivery can fail to arrive.'
      using errcode = 'check_violation';
  end if;

  if not p_items_returned and v_order.reservation_released_at is null then
    for v_item in
      select * from public.order_items where order_id = v_order.id and product_id is not null
    loop
      perform 1 from public.inventory
       where product_id = v_item.product_id and location_code = 'main' for update;

      update public.inventory
         set on_hand  = greatest(0, on_hand - v_item.quantity),
             reserved = greatest(0, reserved - v_item.quantity)
       where product_id = v_item.product_id and location_code = 'main';

      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, reason,
        actor_type, actor_admin_id, actor_label
      )
      select v_item.product_id, 'main', 'damage_loss', -v_item.quantity, 0,
             inv.on_hand, inv.reserved, v_order.id,
             format('Failed delivery, items not returned: %s', btrim(p_reason)),
             v_actor, p_actor_admin_id, v_label
      from public.inventory inv
      where inv.product_id = v_item.product_id and inv.location_code = 'main';

      -- The reservation is released as a separate, correctly-shaped movement:
      -- `damage_loss` may only touch on_hand, so the two effects cannot be one
      -- row without lying about which column moved.
      insert into public.inventory_movements (
        product_id, location_code, kind, on_hand_delta, reserved_delta,
        on_hand_after, reserved_after, order_id, actor_type, actor_admin_id, actor_label
      )
      select v_item.product_id, 'main', 'reservation_release', 0, -v_item.quantity,
             inv.on_hand, inv.reserved, v_order.id, v_actor, p_actor_admin_id, v_label
      from public.inventory inv
      where inv.product_id = v_item.product_id and inv.location_code = 'main';

      v_lost := v_lost + v_item.quantity;
    end loop;
  end if;

  update public.orders
     set state = 'delivery_failed',
         delivery_failure_reason = btrim(p_reason),
         failed_at = now(),
         reservation_released_at = case when p_items_returned
                                        then reservation_released_at
                                        else coalesce(reservation_released_at, now()) end
   where id = v_order.id
   returning * into v_order;

  insert into public.order_events (order_id, kind, from_state, to_state, actor_type, actor_admin_id, actor_label, summary, payload)
  values (v_order.id, 'delivery_failed', 'out_for_delivery', 'delivery_failed',
          v_actor, p_actor_admin_id, v_label,
          format('Delivery failed: %s', btrim(p_reason)),
          jsonb_build_object('items_returned', p_items_returned));

  if v_lost > 0 then
    insert into public.order_events (order_id, kind, actor_type, actor_admin_id, actor_label, summary, payload)
    values (v_order.id, 'stock_released', v_actor, p_actor_admin_id, v_label,
            format('%s unit(s) written off — not returned to the shop', v_lost),
            jsonb_build_object('units', v_lost));
  end if;

  return jsonb_build_object('order_number', v_order.order_number, 'state', 'delivery_failed',
                            'already', false, 'lost', v_lost,
                            'items_returned', p_items_returned);
end;
$$;


-- -----------------------------------------------------------------------------
-- Server only, like the rest of the order path.
-- -----------------------------------------------------------------------------

revoke execute on function public.jojo_advance_order(uuid, public.order_state, uuid, public.payment_method, text)
  from public, anon, authenticated;
grant execute on function public.jojo_advance_order(uuid, public.order_state, uuid, public.payment_method, text)
  to service_role;

revoke execute on function public.jojo_fail_delivery(uuid, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.jojo_fail_delivery(uuid, boolean, text, uuid)
  to service_role;
