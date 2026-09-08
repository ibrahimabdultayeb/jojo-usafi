import Link from "next/link";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Chip } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import type { AdminProduct } from "@/lib/admin/queries";
import { blockReasonLabel } from "@/lib/admin/queries";
import { productName } from "@/lib/catalogue/queries";
import { formatPrice } from "@/lib/format";

/**
 * One product, as staff see it: the real photo, what it is, what it costs, how
 * many are left, and whether a customer can buy it right now.
 *
 * The item code is shown because staff read it off cartons — but it is never
 * editable anywhere in the admin.
 */
export function ProductAdminCard({ entry }: { entry: AdminProduct }) {
  const { product, stock } = entry;

  return (
    <li className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <Link
        href={`/admin/products/${product.sku}`}
        className="flex gap-3 rounded-3xl p-3 transition-colors hover:bg-slate-50 sm:gap-4 sm:p-4"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white sm:h-24 sm:w-24">
          {product.image ? (
            <ProductPhoto product={product} alt="" size="thumb" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
              <Icon name="image" className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] font-black tracking-widest text-brand-700 uppercase">
            {entry.brandName}
          </p>
          <p className="font-display text-sm leading-tight font-bold text-slate-900 sm:text-base">
            {productName(product)}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {product.packSize} · {product.sku}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-black whitespace-nowrap text-slate-900">
              {formatPrice(product.price)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {stock.available} in stock
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.outOfStock && <Chip tone="bad" icon="alert">Out of stock</Chip>}
            {entry.lowStock && <Chip tone="warn" icon="alert">Low stock</Chip>}
            {entry.onWebsite ? (
              <Chip tone="good" icon="eye">On the website</Chip>
            ) : (
              <Chip tone="warn" icon="eyeOff">
                {entry.blockReasons.length > 0
                  ? blockReasonLabel(entry.blockReasons[0])
                  : "Not on the website"}
              </Chip>
            )}
            {entry.syncIssue && <Chip tone="bad" icon="refresh">Sync issue</Chip>}
          </div>
        </div>

        <Icon name="chevronRight" className="mt-1 h-5 w-5 shrink-0 self-center text-slate-300" />
      </Link>
    </li>
  );
}
