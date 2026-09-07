"use client";

import Link from "next/link";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { getBrand, productName } from "@/lib/catalogue/queries";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

export default function CartPage() {
  const { items, count, subtotal, add, setQuantity, remove, hydrated } = useCart();

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
        Your cart
      </h1>
      <p className="mt-2 text-sm font-medium text-slate-500 md:text-base">
        Delivery is added at checkout once we know your area in Dar es Salaam.
      </p>

      {!hydrated ? (
        <div className="mt-8 space-y-3" aria-busy="true" aria-label="Loading your cart">
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
            <p className="font-display text-lg font-bold text-slate-900">Your cart is empty</p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Add a few essentials and they will show up here.
            </p>
          </div>
          <Link
            href="/shop"
            className="flex min-h-12 items-center rounded-full bg-slate-900 px-6 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
          <ul className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => (
              <li
                key={product.sku}
                className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-4 sm:p-4"
              >
                <Link
                  href={`/product/${product.slug}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-50 sm:h-28 sm:w-28"
                >
                  <ProductVisual product={product} className="h-full w-full" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black tracking-widest text-brand-700 uppercase">
                        {getBrand(product.brandId)?.name}
                      </p>
                      <Link
                        href={`/product/${product.slug}`}
                        className="block font-display text-sm font-bold text-slate-900 hover:text-brand-700 sm:text-base"
                      >
                        {productName(product)}
                      </Link>
                      <p className="text-xs font-semibold text-slate-500">
                        {product.packSize} · {formatPrice(product.price)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(product.sku)}
                      aria-label={`Remove ${productName(product)} from cart`}
                      className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex items-center gap-2 pt-3">
                    <div className="flex h-11 items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setQuantity(product.sku, quantity - 1)}
                        aria-label={`Reduce quantity of ${productName(product)}`}
                        className="flex h-full w-11 items-center justify-center text-slate-600 hover:bg-slate-100"
                      >
                        <Icon name={quantity === 1 ? "trash" : "minus"} className="h-4 w-4" />
                      </button>
                      <span className="w-9 text-center text-sm font-black text-slate-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => add(product.sku)}
                        aria-label={`Increase quantity of ${productName(product)}`}
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
            ))}
          </ul>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
            <h2 className="font-display text-lg font-bold text-slate-900">Order summary</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between font-semibold text-slate-600">
                <dt>
                  Subtotal ({count} {count === 1 ? "item" : "items"})
                </dt>
                <dd className="font-black text-slate-900">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between font-semibold text-slate-600">
                <dt>Delivery</dt>
                <dd className="text-right text-xs font-bold text-slate-500">Calculated at checkout</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
              <span className="font-display text-base font-bold text-slate-900">Total so far</span>
              <span className="font-display text-2xl font-black text-slate-900">{formatPrice(subtotal)}</span>
            </div>

            <Link
              href="/checkout"
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
            >
              Checkout
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>

            <Link
              href="/shop"
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
            >
              Continue shopping
            </Link>

            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-500">
              <Icon name="wallet" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Lipa ukipokea — pay when your order reaches you, anywhere in {site.serviceArea}.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
