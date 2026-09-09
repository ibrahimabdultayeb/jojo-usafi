-- =============================================================================
-- Jojo Usafi — 0017 One cast, in jojo_cancel_order
--
-- `jojo_cancel_order` wrote its stock-release movement with
--
--     insert into public.inventory_movements (... actor_type ...)
--     select ..., case when p_actor_admin_id is null then 'system' else 'staff' end, ...
--
-- and PostgreSQL refused it with 42804, datatype_mismatch.
--
-- The reason is a genuine difference between two things that look identical.
-- A bare 'system' in a VALUES list is an UNKNOWN literal, and PostgreSQL will
-- happily resolve it to whatever the target column is — which is why the same
-- pattern works in `jojo_place_order`. Wrap it in a CASE inside an
-- INSERT … SELECT and the expression's type is decided before it ever meets the
-- column: it becomes `text`, and there is no implicit cast from text to an enum.
--
-- Found by `tests/db/07-commerce.test.ts`, which is exactly the sort of thing a
-- test against a real database catches and a careful reading does not.
--
-- Nothing else about the function changes.
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
  v_actor public.actor_type;
  v_from public.order_state;
begin
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A cancelled order must say why.' using errcode = 'check_violation';
  end if;

  v_actor := case when p_actor_admin_id is null then 'system' else 'staff' end;

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

  -- Remembered before the update, so the event records where the order came
  -- from rather than where it ended up.
  v_from := v_order.state;

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
             v_actor, p_actor_admin_id, coalesce(p_actor_label, 'cancellation')
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
  values (v_order.id, 'cancelled', v_from, 'cancelled', v_actor,
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

revoke execute on function public.jojo_cancel_order(uuid, text, uuid, text) from public, anon;
grant  execute on function public.jojo_cancel_order(uuid, text, uuid, text) to service_role;
