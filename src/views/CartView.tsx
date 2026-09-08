"use client";

import Link from "next/link";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { getBrand, productName } from "@/lib/catalogue/queries";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { site } from "@/lib/site";

export function CartView() {
  const { items, count, subtotal, add, setQuantity, remove, hydrated } = useCart();
  const { t, path } = useLocale();

  const itemsLabel = fill(count === 1 ? t.cart.itemsOne : t.cart.itemsMany, { count });

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
        {t.cart.title}
      </h1>
      <p className="mt-2 text-sm font-medium text-slate-500 md:text-base">{t.cart.subtitle}</p>

      {!hydrated ? (
        <div className="mt-8 space-y-3" aria-busy="true" aria-label={t.cart.loading}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="cart" className="h-7 w-7" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-slate-900">{t.cart.emptyTitle}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{t.cart.emptyBody}</p>
          </div>
          <Link
            href={path("/shop")}
            className="flex min-h-12 items-center rounded-full bg-slate-900 px-6 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
          >
            {t.cart.startShopping}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
          <ul className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => {
              const name = productName(product);
              return (
                <li
                  key={product.sku}
                  className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-4 sm:p-4"
                >
                  <Link
                    href={path(`/product/${product.slug}`)}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white sm:h-28 sm:w-28"
                  >
                    <ProductPhoto
                      product={product}
                      alt={fill(t.product.photoAlt, { name, size: product.packSize })}
                      size="thumb"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black tracking-widest text-brand-700 uppercase">
                          {getBrand(product.brandId)?.name}
                        </p>
                        <Link
                          href={path(`/product/${product.slug}`)}
                          className="inline-flex min-h-11 items-center font-display text-sm font-bold text-slate-900 hover:text-brand-700 sm:text-base"
                        >
                          {name}
                        </Link>
                        <p className="text-xs font-semibold text-slate-500">
                          {product.packSize} · {formatPrice(product.price)} {t.cart.each}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(product.sku)}
                        aria-label={fill(t.product.removeAria, { name })}
                        className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Icon name="close" className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-3">
                      <div className="flex h-12 items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.sku, quantity - 1)}
                          aria-label={fill(t.product.reduceAria, { name })}
                          className="flex h-full w-11 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Icon name={quantity === 1 ? "trash" : "minus"} className="h-4 w-4" />
                        </button>
                        <span className="w-9 text-center text-sm font-black text-slate-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => add(product.sku)}
                          aria-label={fill(t.product.increaseAria, { name })}
                          className="flex h-full w-11 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Icon name="plus" className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="ml-auto font-display text-base font-black whitespace-nowrap text-slate-900">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
            <h2 className="font-display text-lg font-bold text-slate-900">{t.cart.orderSummary}</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3 font-semibold text-slate-600">
                <dt>{fill(t.cart.subtotalWithCount, { items: itemsLabel })}</dt>
                <dd className="font-black whitespace-nowrap text-slate-900">
                  {formatPrice(subtotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 font-semibold text-slate-600">
                <dt>{t.cart.deliveryRow}</dt>
                <dd className="text-right text-xs font-bold text-slate-500">
                  {t.cart.deliveryCalculated}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="font-display text-base font-bold text-slate-900">
                {t.cart.totalSoFar}
              </span>
              <span className="font-display text-2xl font-black whitespace-nowrap text-slate-900">
                {formatPrice(subtotal)}
              </span>
            </div>

            <Link
              href={path("/checkout")}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
            >
              {t.cart.checkout}
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>

            <Link
              href={path("/shop")}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
            >
              {t.cart.continueShopping}
            </Link>

            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-500">
              <Icon name="wallet" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {fill(t.cart.payNoteFull, { area: site.serviceArea })}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
