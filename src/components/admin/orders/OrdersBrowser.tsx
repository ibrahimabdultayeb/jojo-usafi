"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, EmptyState, inputClass } from "@/components/admin/ui";
import { formatTsh, shortPhone } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { orderTotals, STAGE_LABEL, STAGE_TONE, type AdminOrder, type OrderStage } from "@/lib/admin/model";

/**
 * The orders queue.
 *
 * Cards on phones, never a table — an order has six things worth knowing and a
 * table row hides half of them at 390px. The filters are the five stages staff
 * actually work through, not every internal state.
 */

const FILTERS: { key: string; label: string; stages: OrderStage[] }[] = [
  { key: "all", label: "All", stages: [] },
  { key: "new", label: "New", stages: ["new"] },
  { key: "confirm", label: "Confirm", stages: ["awaiting_confirmation", "confirmed"] },
  { key: "preparing", label: "Preparing", stages: ["preparing"] },
  { key: "delivery", label: "Delivery", stages: ["out_for_delivery"] },
  { key: "completed", label: "Completed", stages: ["completed"] },
  { key: "problems", label: "Problems", stages: ["cancelled", "delivery_failed"] },
];

export function OrdersBrowser({
  orders,
  initialStage,
}: {
  orders: AdminOrder[];
  initialStage?: string;
}) {
  const [filter, setFilter] = useState(() => {
    const match = FILTERS.find((f) => f.stages.includes(initialStage as OrderStage));
    return match?.key ?? "all";
  });
  const [term, setTerm] = useState("");

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter);
    const byStage =
      !active || active.stages.length === 0 ? orders : orders.filter((o) => active.stages.includes(o.stage));

    const q = term.trim().toLowerCase().replace(/\s/g, "");
    if (!q) return byStage;

    // Order number, customer name or phone — the three things staff have to hand.
    return byStage.filter((o) =>
      [o.number, o.customer.name, o.customer.phone].some((field) =>
        field.toLowerCase().replace(/\s/g, "").includes(q),
      ),
    );
  }, [orders, filter, term]);

  return (
    <>
      <div className="relative mb-3">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          type="search"
          inputMode="search"
          placeholder="Order number, name or phone"
          aria-label="Search orders"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count = f.stages.length === 0 ? orders.length : orders.filter((o) => f.stages.includes(o.stage)).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No orders here"
          body="Nothing matches this filter or search. Try another filter, or clear the search box."
          icon="package"
        />
      ) : (
        <ul className="grid gap-2.5">
          {visible.map((order) => {
            const totals = orderTotals(order);
            return (
              <li key={order.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-slate-900">{order.number}</p>
                      <p className="text-sm font-semibold text-slate-700">{order.customer.name}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {shortPhone(order.customer.phone)} · {order.delivery.zone}
                      </p>
                    </div>
                    <Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="text-sm font-medium text-slate-500">
                      <span className="font-black text-slate-900 tabular-nums">{formatTsh(totals.total)}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      {totals.items} {totals.items === 1 ? "item" : "items"}
                    </p>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-600"
                    >
                      Open order
                      <Icon name="chevronRight" className="h-4 w-4" />
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
