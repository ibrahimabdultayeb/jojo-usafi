"use client";

import { useMemo, useState } from "react";
import { OrderCard } from "@/components/admin/OrderCard";
import { EmptyState } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { matchesFilter, matchesSearch, ORDER_FILTERS, type OrderFilter } from "@/lib/admin/orders";
import type { Order } from "@/lib/admin/types";

/**
 * The orders list: filter chips, one search box, and cards.
 *
 * The chips are the five words staff already use for the stages of an order,
 * plus All and Issues. They are a horizontal rail on a phone so no chip is ever
 * hidden behind a "more filters" menu.
 */
export function OrdersBrowser({
  orders,
  initialFilter = "all",
  initialQuery = "",
}: {
  orders: Order[];
  initialFilter?: OrderFilter;
  initialQuery?: string;
}) {
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);

  const visible = useMemo(
    () => orders.filter((order) => matchesFilter(order, filter) && matchesSearch(order, query)),
    [orders, filter, query],
  );

  const countFor = (value: OrderFilter) =>
    orders.filter((order) => matchesFilter(order, value)).length;

  return (
    <div>
      <div className="relative mb-4">
        <label htmlFor="order-search" className="sr-only">
          Search by order number, customer name or phone number
        </label>
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id="order-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          inputMode="search"
          placeholder="Order number, customer or phone"
          className="min-h-12 w-full rounded-full border border-slate-200 bg-white pr-4 pl-11 text-sm font-semibold shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div
        role="group"
        aria-label="Filter orders"
        className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6"
      >
        {ORDER_FILTERS.map((option) => {
          const active = filter === option.value;
          const count = countFor(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-black ${
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="receipt"
          title="No orders here"
          body="Try another filter, or clear the search box."
        />
      )}
    </div>
  );
}
