import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { adminEn } from "@/lib/admin/copy";
import { orderStatusLabel, orderStatusTone, type StatusTone } from "@/lib/admin/orders";
import type { OrderStatus, SyncState } from "@/lib/admin/types";

/** Small shared pieces every admin screen uses. Plain language, big targets. */

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 pt-4 pb-5 sm:px-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 sm:px-6 md:py-6">{children}</div>;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-base font-bold text-slate-900 md:text-lg">{children}</h2>
  );
}

/**
 * A note that the data on screen is invented. It is never hidden and never
 * styled to be ignorable — mistaking sample orders for real ones would be a
 * serious operational error.
 */
export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children ?? adminEn.mock.banner}</span>
    </p>
  );
}

const TONE_CLASS: Record<StatusTone, string> = {
  attention: "bg-amber-100 text-amber-900",
  progress: "bg-sky-100 text-sky-900",
  done: "bg-brand-100 text-brand-800",
  problem: "bg-rose-100 text-rose-900",
};

/** The ONLY place an order status becomes words. Raw values never leave here. */
export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-black tracking-wide ${
        TONE_CLASS[orderStatusTone(status)]
      }`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}

const SYNC_LABEL: Record<SyncState, string> = {
  saved: adminEn.sync.saved,
  syncing: adminEn.sync.syncing,
  pending: adminEn.sync.pending,
  issue: adminEn.sync.issue,
};

const SYNC_CLASS: Record<SyncState, string> = {
  saved: "text-brand-700",
  syncing: "text-sky-700",
  pending: "text-amber-700",
  issue: "text-rose-700",
};

const SYNC_ICON: Record<SyncState, IconName> = {
  saved: "check",
  syncing: "refresh",
  pending: "clock",
  issue: "alert",
};

/**
 * A UI state only. Nothing synchronises anywhere in this build — this shows what
 * the Google Sheet ↔ Supabase sync will report once it exists.
 */
export function SyncBadge({ state }: { state: SyncState }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold ${SYNC_CLASS[state]}`}
      title="Saving status. Synchronisation is not connected yet."
    >
      <Icon name={SYNC_ICON[state]} className="h-3.5 w-3.5" />
      {SYNC_LABEL[state]}
    </span>
  );
}

export function Chip({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "warn" | "bad" | "good";
  icon?: IconName;
  children: ReactNode;
}) {
  const classes = {
    neutral: "bg-slate-100 text-slate-600",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-rose-100 text-rose-900",
    good: "bg-brand-100 text-brand-800",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function EmptyState({
  icon = "search",
  title,
  body,
}: {
  icon?: IconName;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-bold text-slate-900">{title}</p>
        <p className="mt-1 max-w-sm text-sm font-medium text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-bold text-slate-900">{children}</dd>
    </div>
  );
}
