import Link from "next/link";
import { getAdminCatalogue } from "@/lib/catalogue/admin";
import { getAdminSnapshot, getRecentActivity } from "@/lib/admin/orders";
import { currentStaff } from "@/lib/admin/authorize";
import { AdminPage } from "@/components/admin/AdminShell";
import { Badge, Card, SectionTitle, StatTile } from "@/components/admin/ui";
import { formatTsh, whenExactly, whenWords } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { orderTotals, STAGE_LABEL, STAGE_TONE } from "@/lib/admin/model";

export const metadata = { title: "Home" };

const TONE_RING = {
  urgent: "border-brand-300 bg-brand-50",
  warn: "border-amber-300 bg-amber-50",
  calm: "border-slate-200 bg-white",
} as const;

/**
 * Answers one question: what needs my attention right now?
 *
 * Attention comes first, figures second, history last — the opposite of a
 * reporting dashboard, because this screen is read standing up between jobs.
 */
export default async function AdminHomePage() {
  // The withheld-product count is real: it comes from the database.
  // Real counts, from the real orders and the real shelf. A zero here is an
  // honest zero, not a placeholder.
  const [{ totals }, snapshot, activity, staff] = await Promise.all([
    getAdminCatalogue(),
    getAdminSnapshot(),
    getRecentActivity(),
    currentStaff(),
  ]);
  // The greeting uses the signed-in staff member's own first name, and quietly
  // drops the name rather than guessing when nobody is signed in.
  const firstName = staff?.name.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const attention = [
    ...snapshot.needsAttention,
    {
      label: "Missing image",
      count: totals.missingImage,
      href: "/admin/products?filter=missing-image",
      tone: "warn" as const,
      hint: "Held back from the website",
    },
  ];
  const needsAttention = attention.filter((item) => item.count > 0);
  const allClear = attention.filter((item) => item.count === 0);
  const recent = snapshot.recent;

  return (
    <AdminPage
      title={`Good ${partOfDay}${firstName ? `, ${firstName}` : ""}`}
      subtitle={`Here is what needs you this ${partOfDay}.`}
    >
      {/* Attention first */}
      <SectionTitle>Needs attention</SectionTitle>
      <ul className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {needsAttention.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 transition-colors hover:border-brand-400 ${TONE_RING[item.tone]}`}
            >
              <span className="font-display text-2xl font-black text-slate-900 tabular-nums">
                {item.count}
              </span>
              <span>
                <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                <span className="block text-[11px] font-medium text-slate-500">{item.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {allClear.length > 0 && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5">
          <span className="flex items-center gap-1.5 text-sm font-bold text-brand-700">
            <Icon name="check" className="h-4 w-4" />
            All clear
          </span>
          <span className="text-sm font-medium text-slate-500">
            {allClear.map((item) => item.label.toLowerCase()).join(" · ")}
          </span>
        </Card>
      )}

      {/* Today */}
      <SectionTitle>Today</SectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile label="Sales" value={formatTsh(snapshot.todaySalesTzs)} sub="Completed orders" />
        <StatTile label="Orders" value={String(snapshot.todayOrders)} sub="Placed today" />
        <StatTile
          label="Average order"
          value={formatTsh(snapshot.todayOrders === 0 ? 0 : Math.round(snapshot.todaySalesTzs / snapshot.todayOrders))}
          sub="Per order today"
          />
      </div>

      {/* Recent orders */}
      <SectionTitle
        action={
          <Link
            href="/admin/orders"
            className="inline-flex min-h-11 items-center text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            See all
          </Link>
        }
      >
        Recent orders
      </SectionTitle>
      <Card className="mb-6 divide-y divide-slate-100">
        {recent.map((order) => {
          const totals = orderTotals(order);
          return (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex min-h-16 items-center gap-3 p-3.5 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-slate-900">{order.number}</span>
                  <Badge tone={STAGE_TONE[order.stage]}>{STAGE_LABEL[order.stage]}</Badge>
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-500">
                  {order.customer.name} · {order.delivery.zone}
                </p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-black text-slate-900 tabular-nums">
                  {formatTsh(totals.total)}
                </span>
                <span className="block text-[11px] font-medium text-slate-400">{whenWords(order.placed)}</span>
              </span>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          );
        })}
      </Card>

      {/* Activity */}
      <SectionTitle>Recent activity</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {activity.length === 0 ? (
          <p className="p-4 text-sm font-medium text-slate-500">
            Nothing has happened yet today. Activity appears here as orders come in and staff work
            on them.
          </p>
        ) : (
          activity.map((entry) => (
            <Link
              key={entry.at + entry.text}
              href={entry.href ?? "/admin/orders"}
              className="flex min-h-14 gap-3 p-3.5 transition-colors hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700">{entry.text}</span>
                {/*
                  When and who, under the sentence rather than beside it. As
                  columns they fought the sentence for width on a phone and left
                  it wrapping one word per line.
                */}
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                  {whenExactly(entry.at)} · {entry.by}
                </span>
              </span>
              <Icon name="chevronRight" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))
        )}
      </Card>
    </AdminPage>
  );
}
