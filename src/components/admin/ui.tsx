"use client";

import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * The admin's small design system.
 *
 * Deliberately plainer than the storefront: bigger type, higher contrast, fewer
 * decorative flourishes. Every control is at least 44px tall because this is
 * operated one-handed on a phone, often standing up.
 */

/* ------------------------------------------------------------- surfaces */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-base font-bold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 font-display text-xl font-black text-slate-900 tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-slate-500">{sub}</p>}
    </Card>
  );
}

/* --------------------------------------------------------------- badges */

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  good: "bg-brand-50 text-brand-800 ring-brand-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-rose-50 text-rose-800 ring-rose-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES | string;
  className?: string;
}) {
  const style = tone in BADGE_TONES ? BADGE_TONES[tone as keyof typeof BADGE_TONES] : tone;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ring-1 ring-inset ${style} ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- buttons */

const BUTTONS = {
  primary: "bg-slate-900 text-white hover:bg-brand-600",
  accent: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  quiet: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "border-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
} as const;

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BUTTONS;
  icon?: IconName;
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  full,
  disabled,
  type = "button",
  className = "",
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-display text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        BUTTONS[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}

/** The one obvious thing to do next. Deliberately the biggest control on screen. */
export function PrimaryAction({
  children,
  onClick,
  icon = "arrowRight",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-display text-base font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
      <Icon name={icon} className="h-5 w-5" />
    </button>
  );
}

/* --------------------------------------------------------------- inputs */

export function Field({
  label,
  hint,
  children,
  locked,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-900">
        {label}
        {locked && (
          <Badge tone="neutral">
            <Icon name="shield" className="mr-1 h-3 w-3" />
            Locked
          </Badge>
        )}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs font-medium text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 focus:border-brand-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400";

/** A switch, not a checkbox: easier to hit and easier to read at a glance. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        {hint && <span className="block text-xs font-medium text-slate-500">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------ overlays */

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Sits on z-60, the modal
 * layer of the floating-layer contract in `globals.css`.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[88svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- states */

export function EmptyState({ title, body, icon = "package" }: { title: string; body: string; icon?: IconName }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-bold text-slate-900">{title}</p>
        <p className="mt-1 max-w-sm text-sm font-medium text-slate-500">{body}</p>
      </div>
    </Card>
  );
}

/** Mock save feedback: Saved / Syncing… / Sync pending. */
export function SaveState({ state }: { state: "idle" | "saving" | "saved" | "pending" }) {
  if (state === "idle") return null;
  const map = {
    saving: { tone: "info" as const, icon: "clock" as const, text: "Syncing…" },
    saved: { tone: "good" as const, icon: "check" as const, text: "Saved" },
    pending: { tone: "warn" as const, icon: "clock" as const, text: "Sync pending" },
  };
  const { tone, icon, text } = map[state];
  return (
    <Badge tone={tone}>
      <Icon name={icon} className="mr-1 h-3 w-3" />
      {text}
    </Badge>
  );
}
