"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./Spinner";
import { useLocale } from "@/lib/i18n/client";

function NavigationStatus() {
  const { pending } = useLinkStatus();
  const { locale } = useLocale();
  return (
    <span className="link-status" role="status" aria-live="polite">
      {pending && <span className="link-status-indicator"><Spinner /><span className="sr-only">{locale === "sw" ? "Inapakia…" : "Loading…"}</span></span>}
    </span>
  );
}

/** Next owns the pending lifecycle, including cancellation and prefetched pages. */
export default function LoadingLink({ children, className = "", ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} className={`loading-link ${className}`}>{children}<NavigationStatus /></NextLink>;
}
