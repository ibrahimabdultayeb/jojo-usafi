import Link from "next/link";
import { AdminPage } from "@/components/admin/AdminShell";
import { Badge, Card, SectionTitle, StatTile } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatTsh } from "@/lib/admin/format";
import { can } from "@/lib/admin/permissions";
import { currentStaff } from "@/lib/admin/authorize";
import { getMediaReport, getReports } from "@/lib/admin/reports";

export const metadata = { title: "Reports" };

/** Reads orders and stock as the caller. Never prerendered. */
export const dynamic = "force-dynamic";

/**
 * Reports.
 *
 * Eight numbers and three short lists, all computed on the server. No chart
 * library: every figure here is one line of text, and a sparkline would cost
 * more kilobytes than the entire screen.
 *
 * The order is the order a person asks in — what did we take today, how is the
 * week going, where are the orders now, what is selling, what is running out,
 * what still has no photograph. The last of those is the largest piece of
 * catalogue work left before launch, which is why it is on this screen at all.
 */
export default async function AdminReportsPage() {
  const staff = await currentStaff();
  const role = staff?.role ?? "order_staff";

  // The matrix decides; the database decides again on every query behind this.
  if (!can(role, "analytics.view")) {
    return (
      <AdminPage title="Reports" back={{ href: "/admin/more", label: "More" }}>
        <Card className="p-4">
          <p className="text-sm font-bold text-slate-900">Reports are not part of your work</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Sales figures are for the Owner and Managers. Your screens are Orders and Customers.
          </p>
        </Card>
      </AdminPage>
    );
  }

  const [reports, media] = await Promise.all([getReports(), getMediaReport()]);
  const { today, week, month, endings, payment } = reports;

  return (
    <AdminPage
      title="Reports"
      subtitle="Everything here counts completed orders only — money the shop actually took."
      back={{ href: "/admin/more", label: "More" }}
    >
      {reports.neverSoldAnything && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">No order has been completed yet</p>
          <p className="mt-1 text-sm font-medium text-amber-800">
            Every figure below is a real zero rather than a missing number. They start moving with
            the first completed order.
          </p>
        </Card>
      )}

      <SectionTitle>Today</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile label="Sales" value={formatTsh(today.salesTzs)} sub="Completed today" />
        <StatTile label="Orders" value={String(today.orders)} sub="Placed today" />
        <StatTile label="Average order" value={formatTsh(today.averageTzs)} sub="Per completed order" />
      </div>

      <SectionTitle>The last seven days</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile label="Sales" value={formatTsh(week.salesTzs)} sub="Completed" />
        <StatTile label="Orders" value={String(week.orders)} sub="Placed" />
        <StatTile label="Average order" value={formatTsh(week.averageTzs)} />
      </div>

      <SectionTitle>The last thirty days</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatTile label="Sales" value={formatTsh(month.salesTzs)} sub="Completed" />
        <StatTile label="Orders" value={String(month.orders)} sub="Placed" />
        <StatTile label="Average order" value={formatTsh(month.averageTzs)} />
      </div>

      <SectionTitle>How orders have ended</SectionTitle>
      <Card className="mb-5 divide-y divide-slate-100">
        <Row label="Completed" value={endings.completed} tone="good" />
        <Row label="Still being worked on" value={endings.open} tone="neutral" />
        <Row label="Cancelled" value={endings.cancelled} tone="warn" />
        <Row label="Delivery failed" value={endings.deliveryFailed} tone="bad" />
      </Card>

      <SectionTitle>How people paid</SectionTitle>
      <Card className="mb-5 divide-y divide-slate-100">
        <Row label="Cash on delivery" value={payment.cash} tone="neutral" />
        <Row label="Paid digitally" value={payment.digital} tone="neutral" />
        {payment.unrecorded > 0 && (
          <Row label="Completed with no payment recorded" value={payment.unrecorded} tone="bad" />
        )}
      </Card>

      <SectionTitle>What is selling</SectionTitle>
      <Card className="mb-5">
        {reports.topProducts.length === 0 ? (
          <p className="p-4 text-sm font-medium text-slate-500">
            Nothing has been sold yet, so there is nothing to rank.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.topProducts.map((product) => (
              <li key={product.sku} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-black text-brand-800 tabular-nums">
                  {product.quantity}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{product.name}</span>
                  <span className="block text-xs font-medium text-slate-500">{product.sku}</span>
                </span>
                <span className="shrink-0 text-sm font-black text-slate-900 tabular-nums">
                  {formatTsh(product.salesTzs)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>Running out</SectionTitle>
      <Card className="mb-5">
        {reports.outOfStock.length === 0 && reports.lowStock.length === 0 ? (
          <p className="p-4 text-sm font-medium text-slate-500">
            Nothing on the website is low or out of stock.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.outOfStock.map((row) => (
              <li key={row.sku} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{row.name}</span>
                  <span className="block text-xs font-medium text-slate-500">{row.sku}</span>
                </span>
                <Badge tone="bad">Out of stock</Badge>
              </li>
            ))}
            {reports.lowStock.map((row) => (
              <li key={row.sku} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{row.name}</span>
                  <span className="block text-xs font-medium text-slate-500">{row.sku}</span>
                </span>
                <Badge tone="warn">{row.available} left</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>Photography</SectionTitle>
      <Card className="mb-5">
        {media.missingPhotoCount === 0 ? (
          <p className="p-4 text-sm font-medium text-slate-500">
            Every product has a photograph.
          </p>
        ) : (
          <>
            <div className="border-b border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">
                {media.missingPhotoCount} product{media.missingPhotoCount === 1 ? "" : "s"} have no
                photograph
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                None of them can go on the website until they do, whatever else is set. This is the
                largest piece of catalogue work left.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {media.missingPhoto.slice(0, 12).map((row) => (
                <li key={row.sku}>
                  <Link
                    href={`/admin/products/${row.sku}`}
                    className="flex min-h-14 items-center gap-3 p-4 transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{row.name}</span>
                      <span className="block text-xs font-medium text-slate-500">
                        {row.sku} · {row.lifecycle}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
            {media.missingPhotoCount > 12 && (
              <p className="border-t border-slate-100 p-4 text-xs font-medium text-slate-500">
                and {media.missingPhotoCount - 12} more.
              </p>
            )}
          </>
        )}
      </Card>

      {media.orphans.length > 0 && (
        <>
          <SectionTitle>Pictures with no product</SectionTitle>
          <Card className="mb-5">
            <p className="border-b border-slate-100 p-4 text-sm font-medium text-slate-500">
              These are in storage but no product points at them. Nothing is attached
              automatically — matching a file to a product by its name would be a guess, and a
              guess puts the wrong photograph on a product.
            </p>
            <ul className="divide-y divide-slate-100">
              {media.orphans.slice(0, 10).map((row) => (
                <li key={row.path} className="p-4">
                  <p className="truncate text-sm font-bold text-slate-900">{row.filename ?? row.path}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{row.path}</p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Every figure is counted from the shop&rsquo;s own orders. No customer names, phone numbers
        or addresses appear on this screen.
      </p>
    </AdminPage>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
