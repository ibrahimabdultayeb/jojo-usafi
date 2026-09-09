"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { productName } from "@/lib/catalogue/format";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { site } from "@/lib/site";

/**
 * VISUAL SHELL ONLY.
 *
 * No order is created and nothing is sent anywhere. The real checkout will write
 * the order to the database before any customer contact happens.
 */
export function CheckoutView() {
  const { items, count, subtotal, hydrated } = useCart();
  const { t, path } = useLocale();
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

  const field =
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none";
  const label = "mb-1.5 block text-sm font-bold text-slate-900";

  return (
    <div className="shell py-8 md:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-xs font-bold text-slate-400"
      >
        <Link href={path("/cart")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
          {t.checkout.breadcrumbCart}
        </Link>
        <Icon name="chevronRight" className="h-3 w-3" />
        <span className="text-slate-700">{t.checkout.breadcrumbCheckout}</span>
      </nav>

      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
        {t.checkout.title}
      </h1>
      <p className="mt-2 text-sm font-medium text-slate-500 md:text-base">{t.checkout.subtitle}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <legend className="px-2 font-display text-lg font-bold text-slate-900">
              {t.checkout.yourDetails}
            </legend>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="name" className={label}>
                  {t.checkout.fullName}
                </label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder={t.checkout.fullNamePlaceholder}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="tel" className={label}>
                  {t.checkout.phone}
                </label>
                <input
                  id="tel"
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t.checkout.phonePlaceholder}
                  className={field}
                />
                <p className="mt-1.5 text-xs font-medium text-slate-400">{t.checkout.phoneHelp}</p>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <legend className="px-2 font-display text-lg font-bold text-slate-900">
              {t.checkout.delivery}
            </legend>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="area" className={label}>
                  {t.checkout.area}
                </label>
                <input
                  id="area"
                  name="area"
                  placeholder={t.checkout.areaPlaceholder}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="directions" className={label}>
                  {t.checkout.directions}
                </label>
                <textarea
                  id="directions"
                  name="directions"
                  rows={3}
                  placeholder={t.checkout.directionsPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={hydrated && count === 0}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-40"
          >
            {t.checkout.placeOrder}
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>

          {submitted && (
            <div
              role="status"
              className="fade-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
            >
              {t.checkout.notConnected}
            </div>
          )}
        </form>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t.checkout.orderSummary}
          </h2>

          {!hydrated ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm font-medium text-slate-500">
              {t.checkout.emptyCart}{" "}
              <Link href={path("/shop")} className="font-bold text-brand-700 hover:text-brand-800">
                {t.checkout.addSomething}
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5 border-b border-slate-100 pb-4">
              {items.map(({ product, quantity, lineTotal }) => (
                <li key={product.sku} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 font-semibold text-slate-600">
                    <span className="text-slate-900">{quantity}×</span> {productName(product)}{" "}
                    <span className="text-slate-400">{product.packSize}</span>
                  </span>
                  <span className="shrink-0 font-black whitespace-nowrap text-slate-900">
                    {formatPrice(lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3 font-semibold text-slate-600">
              <dt>{t.checkout.subtotal}</dt>
              <dd className="font-black whitespace-nowrap text-slate-900">
                {formatPrice(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-slate-600">
              <dt>{t.checkout.deliveryRow}</dt>
              <dd className="text-right text-xs font-bold text-slate-500">
                {t.checkout.deliveryValue}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-500">
            <Icon name="wallet" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {fill(t.checkout.payNote, { area: site.serviceArea })}
          </p>
        </aside>
      </div>
    </div>
  );
}
