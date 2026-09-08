import Link from "next/link";
import { OrderCard } from "@/components/admin/OrderCard";
import { Card, MockNotice, PageHeader, Screen, SectionTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { adminEn } from "@/lib/admin/copy";
import { MOCK_TODAY } from "@/lib/admin/mock/orders";
import { getDashboard, type AttentionItem } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/format";

/**
 * Admin Home — the attention dashboard.
 *
 * It answers one question: what needs my attention? Three numbers, then the
 * things that are waiting, then the last few orders. No charts: a shop owner on
 * a phone at 7am needs counts they can act on, not a graph.
 */
export default function AdminHomePage() {
  const dashboard = getDashboard();
  const waiting = dashboard.attention.filter((item) => item.count > 0);
  const clear = dashboard.attention.filter((item) => item.count === 0);

  return (
    <>
      <PageHeader title="Home" subtitle={MOCK_TODAY} />
      <Screen>
        <MockNotice>{adminEn.mock.products}</MockNotice>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat
            label={adminEn.labels.todaysSales}
            value={formatPrice(dashboard.todaySales)}
            icon="banknote"
            wide
          />
          <Stat label={adminEn.labels.todaysOrders} value={String(dashboard.todayOrders)} icon="receipt" />
          <Stat
            label={adminEn.labels.averageOrderValue}
            value={formatPrice(dashboard.averageOrderValue)}
            icon="chart"
          />
        </div>

        <SectionTitle>{adminEn.labels.needsAttention}</SectionTitle>
        {waiting.length > 0 ? (
          <ul className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waiting.map((item) => (
              <AttentionCard key={item.key} item={item} />
            ))}
          </ul>
        ) : (
          <Card className="mb-4">
            <p className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
              <Icon name="check" className="h-5 w-5 text-brand-600" />
              Nothing is waiting. Everything is up to date.
            </p>
          </Card>
        )}

        {clear.length > 0 && (
          <p className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            <Icon name="check" className="h-4 w-4 text-brand-600" />
            All clear: {clear.map((item) => item.label).join(" · ")}
          </p>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>{adminEn.labels.recentOrders}</SectionTitle>
          <Link
            href="/admin/orders"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            {adminEn.actions.viewAll}
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        <ul className="space-y-3">
          {dashboard.recentOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      </Screen>
    </>
  );
}

function Stat({
  label,
  value,
  icon,
  wide = false,
}: {
  label: string;
  value: string;
  icon: "banknote" | "receipt" | "chart";
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${
        wide ? "col-span-2 lg:col-span-1" : ""
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-xs font-bold tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-display text-xl font-black tracking-tight text-slate-900 md:text-2xl">
        {value}
      </p>
    </div>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const tone = {
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    progress: "border-sky-200 bg-sky-50 text-sky-900",
    problem: "border-rose-200 bg-rose-50 text-rose-900",
  }[item.tone];

  return (
    <li>
      <Link
        href={item.href}
        className={`flex min-h-[6rem] items-center gap-4 rounded-3xl border p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${tone}`}
      >
        <span className="font-display text-3xl leading-none font-black">{item.count}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base leading-tight font-bold">{item.label}</span>
          <span className="block text-xs font-semibold opacity-80">{item.hint}</span>
        </span>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 opacity-60" />
      </Link>
    </li>
  );
}
