-- Returned items keep their reservation. Written-off items cannot be dispatched again.
alter table public.orders
  add constraint orders_dispatch_requires_stock_reservation
  check (state <> 'out_for_delivery' or reservation_released_at is null);
