"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, EmptyState, inputClass } from "@/components/admin/ui";
import { formatTsh } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { getBrand, productName } from "@/lib/catalogue/queries";
import type { AdminProduct } from "@/mocks/admin/data";

/**
 * The product shelf.
 *
 * A list of rows rather than a grid: an operator scans down looking for a price
 * or a stock number, and a row puts those in a predictable place. Everything
 * that needs doing is a badge, so "what needs attention" is visible without
 * opening anything.
 */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "low-stock", label: "Low stock" },
  { key: "out-of-stock", label: "Out of stock" },
  { key: "hidden", label: "Hidden" },
  { key: "missing-image", label: "Missing image" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function badgesFor(product: AdminProduct) {
  const out: { label: string; tone: "warn" | "bad" | "neutral" | "info" }[] = [];
  if (product.stock === 0) out.push({ label: "Out of stock", tone: "bad" });
  else if (product.stock <= product.lowStockThreshold) out.push({ label: "Low stock", tone: "warn" });
  if (product.hidden) out.push({ label: "Hidden", tone: "neutral" });
  if (!product.image) out.push({ label: "Missing image", tone: "warn" });
  if (product.syncIssue) out.push({ label: "Sync issue", tone: "bad" });
  return out;
}

function matchesFilter(product: AdminProduct, filter: FilterKey) {
  switch (filter) {
    case "low-stock":
      return product.stock > 0 && product.stock <= product.lowStockThreshold;
    case "out-of-stock":
      return product.stock === 0;
    case "hidden":
      return product.hidden;
    case "missing-image":
      return !product.image;
    case "attention":
      return badgesFor(product).length > 0;
    default:
      return true;
  }
}

export function ProductsBrowser({
  products,
  initialFilter,
}: {
  products: AdminProduct[];
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState<FilterKey>(
    (FILTERS.find((f) => f.key === initialFilter)?.key ?? "all") as FilterKey,
  );
  const [term, setTerm] = useState("");

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return products.filter((product) => {
      if (!matchesFilter(product, filter)) return false;
      if (!q) return true;
      // Name, SKU, barcode and brand — the four things printed on a shelf label.
      const brand = getBrand(product.brandId)?.name ?? "";
      const haystack = `${productName(product)} ${product.sku} ${brand} ${product.packSize}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, filter, term]);

  return (
    <>
      <div className="relative mb-3">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          type="search"
          placeholder="Product name, SKU, barcode or brand"
          aria-label="Search products"
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count = products.filter((p) => matchesFilter(p, f.key)).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-xs font-bold text-slate-400">
        {visible.length} {visible.length === 1 ? "product" : "products"}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="No products here"
          body="Nothing matches this filter or search. Try another filter, or clear the search box."
          icon="cart"
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {visible.map((product) => {
            const badges = badgesFor(product);
            const brand = getBrand(product.brandId)?.name;
            return (
              <Link
                key={product.sku}
                href={`/admin/products/${product.sku}`}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-slate-50"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                  {product.image ? (
                    <Image
                      src={product.image.src}
                      alt={productName(product)}
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-slate-300">
                      <Icon name="package" className="h-5 w-5" />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">
                    {productName(product)}
                  </span>
                  <span className="block truncate text-xs font-medium text-slate-500">
                    {brand} · {product.packSize} · {product.sku}
                  </span>
                  {badges.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                          {badge.label}
                        </Badge>
                      ))}
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-black text-slate-900 tabular-nums">
                    {formatTsh(product.price)}
                  </span>
                  <span
                    className={`block text-xs font-bold tabular-nums ${
                      product.stock === 0 ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    {product.stock} in stock
                  </span>
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
