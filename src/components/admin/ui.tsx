"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";
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
    <div className={`admin-card ${className}`}>
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
  good: "bg-lime-50 text-lime-800 ring-lime-200",
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
      className={`admin-badge inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ring-1 ring-inset ${style} ${className}`}
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
  busy?: boolean;
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
  busy,
  type = "button",
  className = "",
  title,
}: ButtonProps) {
  const form = useFormStatus();
  busy = busy || (type === "submit" && form.pending);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      title={title}
      className={`admin-button admin-button-${variant} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-display text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        BUTTONS[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {busy ? <Spinner /> : icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
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
  busy,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className="admin-primary-action flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 font-display text-base font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
      {busy ? <Spinner /> : <Icon name={icon} className="h-5 w-5" />}
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
  busy,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        {hint && <span className="block text-xs font-medium text-slate-500">{hint}</span>}
      </span>
      {busy ? <Spinner/> : <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span
          className={`admin-switch-thumb absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </span>}
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
  busy = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  busy?: boolean;
  error?: string | null;
}) {
  const [mounted, setMounted] = useState(open);
  const present = open || mounted;
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(timer);
  }, [open]);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const working = useRef(busy);
  useEffect(() => { close.current = onClose; working.current = busy; }, [onClose, busy]);
  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
    (focusable()[0] ?? dialog.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); if (!working.current) close.current(); }
      if (e.key === "Tab") {
        const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
        if (!first) { e.preventDefault(); dialog.current?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [present]);

  if (!present || typeof document === "undefined") return null;

  return createPortal(
    <div data-state={open ? "open" : "closing"} className="admin-workspace admin-dialog-overlay fixed inset-0 z-60 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
        tabIndex={-1}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-dialog relative max-h-[90svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-[520px] sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
            className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <fieldset disabled={busy} className="min-w-0">{children}</fieldset>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </div>
    </div>, document.body
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

/**
 * Honest save feedback.
 *
 * `saved` means the database said yes, and nothing else. It deliberately does
 * not say "Synced": no Google Sheet write-back exists yet, and a badge claiming
 * one would be the dashboard lying about where the truth is.
 */
export function SaveState({
  state,
}: {
  state: "idle" | "saving" | "saved" | "pending" | "failed";
}) {
  if (state === "idle") return null;
  const map = {
    saving: { tone: "info" as const, icon: "clock" as const, text: "Saving…" },
    saved: { tone: "good" as const, icon: "check" as const, text: "Saved" },
    pending: { tone: "warn" as const, icon: "clock" as const, text: "Sync pending" },
    failed: { tone: "bad" as const, icon: "close" as const, text: "Not saved" },
  };
  const { tone, icon, text } = map[state];
  return (
    <Badge tone={tone}>
      {state === "saving" ? <Spinner className="mr-1" /> : <Icon name={icon} className="mr-1 h-3 w-3" />}
      {text}
    </Badge>
  );
}
