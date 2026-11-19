"use client";
import type { ReactNode } from "react";
import RubberSegment from "./RubberSegment";
import { Spinner } from "./Spinner";
import "./FilterTabs.css";

export function FilterTabs({ items, value, onChange, label, busy, className = "" }: {
  items: { value: string; label: ReactNode; count?: number }[];
  value: string; onChange: (value: string) => void; label: string; busy?: boolean; className?: string;
}) {
  return <div className={`filter-tabs ${className}`} aria-busy={busy || undefined}>
    <div className="filter-tabs-scroll no-scrollbar"><RubberSegment value={value} onChange={onChange} aria-label={label} disabled={busy}
      items={items.map(item => ({value:item.value,label:<>{item.label}{item.count !== undefined && <span className="filter-count">{item.count}</span>}</>}))}/></div>
    {busy && <span className="filter-tabs-pending" role="status"><Spinner/><span className="sr-only">Loading…</span></span>}
  </div>;
}
