import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, SyncBadge } from "@/components/admin/ui";
import { itemCount, nextAction } from "@/lib/admin/orders";
import type { Order } from "@/lib/admin/types";
import { formatPrice } from "@/lib/format";

/**
 * One order, as a card. Never a table row — a table at 390px forces staff to
 * scroll sideways to find out what an order needs.
 *
 * Everything a member of staff decides with is on the front: who, where, how
 * much, how many, what state it is in, and the one thing to do next.
 */
export function OrderCard({ order }: { order: Order }) {
  const action = nextAction(order);
  const count = itemCount(order);

  return (
    <li className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <Link
        href={`/admin/orders/${order.id}`}
        className="block rounded-3xl p-4 transition-colors hover:bg-slate-50 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-black tracking-tight text-slate-900">
              {order.id}
            </p>
            <p className="mt-0.5 truncate font-display text-base font-bold text-slate-900">
              {order.customerName}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <Icon name="pin" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {order.zoneName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-black whitespace-nowrap text-slate-900">
              {formatPrice(order.total)}
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {count} {count === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={order.status} />
          <span className="text-xs font-semibold text-slate-400">{order.placedAt}</span>
          {order.syncState !== "saved" && (
            <span className="ml-auto">
              <SyncBadge state={order.syncState} />
            </span>
          )}
        </div>
      </Link>

      <div className="border-t border-slate-100 p-3 sm:px-5">
        <Link
          href={`/admin/orders/${order.id}`}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
        >
          {action ? action.label : "Open Order"}
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}
