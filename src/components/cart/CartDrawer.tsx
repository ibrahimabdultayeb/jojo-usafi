"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { useCart } from "@/lib/cart";
import { getBrand, productName } from "@/lib/catalogue/queries";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { site } from "@/lib/site";

/** Floating layer: `z-60` — a modal surface, above the header and the dock. */
export function CartDrawer() {
  const { isOpen, closeCart, items, count, subtotal, add, setQuantity, remove } = useCart();
  const { t, path } = useLocale();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60">
      <button
        type="button"
        aria-label={t.cart.closeCart}
        onClick={closeCart}
        className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.cart.title}
        className="sheet-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4 sm:px-5">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t.cart.title} {count > 0 && <span className="text-slate-400">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label={t.cart.closeCart}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Icon name="cart" className="h-8 w-8" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-slate-900">{t.cart.emptyTitle}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{t.cart.emptyBody}</p>
            </div>
            <Link
              href={path("/shop")}
              onClick={closeCart}
              className="mt-2 flex min-h-12 items-center rounded-full bg-slate-900 px-6 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
            >
              {t.cart.startShopping}
            </Link>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain px-4 sm:px-5">
            {items.map(({ product, quantity, lineTotal }) => {
              const name = productName(product);
              return (
                <li key={product.sku} className="flex gap-3 py-4">
                  <Link
                    href={path(`/product/${product.slug}`)}
                    onClick={closeCart}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white"
                  >
                    <ProductPhoto
                      product={product}
                      alt={fill(t.product.photoAlt, { name, size: product.packSize })}
                      size="thumb"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-[10px] font-black tracking-widest text-brand-700 uppercase">
                      {getBrand(product.brandId)?.name}
                    </p>
                    <Link
                      href={path(`/product/${product.slug}`)}
                      onClick={closeCart}
                      className="inline-flex min-h-11 items-center truncate font-display text-sm font-bold text-slate-900 hover:text-brand-700"
                    >
                      {name}
                    </Link>
                    <p className="text-xs font-semibold text-slate-500">{product.packSize}</p>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-12 items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.sku, quantity - 1)}
                          aria-label={fill(t.product.reduceAria, { name })}
                          className="flex h-full w-11 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Icon name={quantity === 1 ? "trash" : "minus"} className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-slate-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => add(product.sku)}
                          aria-label={fill(t.product.increaseAria, { name })}
                          className="flex h-full w-11 items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Icon name="plus" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="ml-auto text-sm font-black whitespace-nowrap text-slate-900">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(product.sku)}
                    aria-label={fill(t.product.removeAria, { name })}
                    className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <div className="shrink-0 space-y-3 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-base font-bold text-slate-900">
                {t.cart.subtotal}
              </span>
              <span className="font-display text-xl font-black text-slate-900">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-500">
              <Icon name="truck" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {t.cart.deliveryNote}
            </p>
            <Link
              href={path("/checkout")}
              onClick={closeCart}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
            >
              {t.cart.checkout}
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>
            <Link
              href={path("/cart")}
              onClick={closeCart}
              className="flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
            >
              {t.cart.viewFullCart}
            </Link>
            <p className="text-center text-[11px] font-semibold text-slate-400">
              {fill(t.cart.payOnDelivery, { area: site.serviceArea })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
