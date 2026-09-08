"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * A dialog that behaves like a sheet on a phone and a panel on a laptop.
 *
 * It is capped to the viewport and scrolls inside itself, so a long form can
 * never push its own buttons off a 390px screen.
 */
export function AdminDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="rise relative flex max-h-[90svh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl outline-none sm:max-w-md sm:rounded-[2rem]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>

        {footer && (
          <div className="shrink-0 space-y-2 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
