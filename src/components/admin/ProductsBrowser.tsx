"use client";

import { useMemo, useState } from "react";
import { ProductAdminCard } from "@/components/admin/ProductAdminCard";
import { EmptyState } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { searchAdminProducts, type AdminProduct } from "@/lib/admin/queries";

/** The states staff care about, in the order they care about them. */
export type ProductFilter =
  | "all"
  | "low-stock"
  | "out-of-stock"
  | "not-on-website"
  | "missing-image"
  | "sync-issue";

const FILTERS: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "not-on-website", label: "Not on the website" },
  { value: "missing-image", label: "No photo" },
  { value: "sync-issue", label: "Sync issue" },
];

function matches(entry: AdminProduct, filter: ProductFilter): boolean {
  switch (filter) {
    case "low-stock":
      return entry.lowStock;
    case "out-of-stock":
      return entry.outOfStock;
    case "not-on-website":
      return !entry.onWebsite;
    case "missing-image":
      return entry.missingImage;
    case "sync-issue":
      return entry.syncIssue;
    default:
      return true;
  }
}

/** How many cards to render before the "show more" button. Keeps 201 rows fast. */
const PAGE = 24;

export function ProductsBrowser({
  products,
  initialFilter = "all",
  initialQuery = "",
}: {
  products: AdminProduct[];
  initialFilter?: ProductFilter;
  initialQuery?: string;
}) {
  const [filter, setFilter] = useState<ProductFilter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [shown, setShown] = useState(PAGE);

  const visible = useMemo(
    () => searchAdminProducts(products.filter((entry) => matches(entry, filter)), query),
    [products, filter, query],
  );

  const countFor = (value: ProductFilter) =>
    products.filter((entry) => matches(entry, value)).length;

  return (
    <div>
      <div className="relative mb-4">
        <label htmlFor="product-search" className="sr-only">
          Search by product name, item code, barcode or brand
        </label>
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id="product-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          type="search"
          inputMode="search"
          placeholder="Name, item code, barcode or brand"
          className="min-h-12 w-full rounded-full border border-slate-200 bg-white pr-4 pl-11 text-sm font-semibold shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div
        role="group"
        aria-label="Filter products"
        className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6"
      >
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value);
                setShown(PAGE);
              }}
              aria-pressed={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-black ${
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {countFor(option.value)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-xs font-bold text-slate-500">
        {visible.length} {visible.length === 1 ? "product" : "products"}
      </p>

      {visible.length > 0 ? (
        <>
          <ul className="space-y-3">
            {visible.slice(0, shown).map((entry) => (
              <ProductAdminCard key={entry.product.sku} entry={entry} />
            ))}
          </ul>
          {visible.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-4 flex min-h-14 w-full items-center justify-center rounded-full border border-slate-200 bg-white font-display text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Show more ({visible.length - shown} left)
            </button>
          )}
        </>
      ) : (
        <EmptyState
          icon="box"
          title="No products here"
          body="Try another filter, or clear the search box."
        />
      )}
    </div>
  );
}
