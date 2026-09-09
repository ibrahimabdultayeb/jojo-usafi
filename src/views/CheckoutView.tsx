"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { productName } from "@/lib/catalogue/format";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { site } from "@/lib/site";
import { placeOrderAction, quoteAction } from "@/lib/commerce/actions";
import { emptyCheckoutState } from "@/lib/commerce/state";
import type { Quote } from "@/lib/commerce/checkout";
import type { CheckoutZone } from "@/lib/commerce/checkout";
import { OrderReceived } from "@/components/checkout/OrderReceived";

/**
 * Guest checkout. No account, four required fields, one button.
 *
 * THE MONEY ON THIS SCREEN IS NOT THIS SCREEN'S OPINION. The cart knows SKUs
 * and quantities; every figure shown here comes back from `quoteAction`, which
 * prices the basket inside PostgreSQL. If a price moved while the basket sat
 * open, the shopper sees today's price before they commit, not after.
 *
 * The same is true of stock: the quote reports what is actually available, and
 * a line that cannot be filled says so by name and by number rather than as a
 * generic failure.
 */

interface CheckoutViewProps {
  zones: CheckoutZone[];
}

export function CheckoutView({ zones }: CheckoutViewProps) {
  const { items, count, hydrated, clear } = useCart();
  const { t, path, locale } = useLocale();

  const [zoneSlug, setZoneSlug] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [state, formAction] = useActionState(placeOrderAction, emptyCheckoutState);

  const lines = items.map((item) => ({ sku: item.product.sku, quantity: item.quantity }));
  const cartField = JSON.stringify(lines);

  // Re-price whenever the basket or the area changes. The server is asked; the
  // browser never computes a total it then asks somebody to agree to.
  useEffect(() => {
    if (!hydrated || lines.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    quoteAction(lines, zoneSlug || null)
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartField, zoneSlug, hydrated]);

  // The basket has done its job once the order exists in the database.
  useEffect(() => {
    if (state.placed) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.placed]);

  if (state.placed) {
    return <OrderReceived order={state.placed} />;
  }

  const field =
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none";
  const label = "mb-1.5 block text-sm font-bold text-slate-900";

  const selectedZone = zones.find((zone) => zone.slug === zoneSlug);
  const canOrder = hydrated && count > 0 && zones.length > 0 && Boolean(quote?.ok);

  return (
    <div className="shell py-8 md:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-xs font-bold text-slate-400"
      >
        <Link
          href={path("/cart")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700"
        >
          {t.checkout.breadcrumbCart}
        </Link>
        <Icon name="chevronRight" className="h-3 w-3" />
        <span className="text-slate-700">{t.checkout.breadcrumbCheckout}</span>
      </nav>

      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
        {t.checkout.title}
      </h1>
      <p className="mt-1.5 text-sm font-semibold text-slate-500 md:text-base">
        {t.checkout.subtitle}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="cart" value={cartField} />
          <input type="hidden" name="locale" value={locale} />

          {state.error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900"
            >
              <p className="font-bold">{t.checkout.basketProblem}</p>
              <p className="mt-1">{state.error}</p>
              {state.problems.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {state.problems.map((problem, index) => (
                    <li key={`${problem.kind}-${index}`}>{problem.message}</li>
                  ))}
                </ul>
              )}
              <Link
                href={path("/cart")}
                className="mt-3 inline-flex min-h-11 items-center font-bold underline"
              >
                {t.checkout.fixBasket}
              </Link>
            </div>
          )}

          {/* ---------------------------------------------------- contact */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t.checkout.yourDetails}
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="fullName" className={label}>
                  {t.checkout.fullName} <Required text={t.checkout.required} />
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  required
                  autoComplete="name"
                  className={field}
                  placeholder={t.checkout.fullNamePlaceholder}
                />
              </div>

              <div>
                <label htmlFor="phone" className={label}>
                  {t.checkout.phone} <Required text={t.checkout.required} />
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  className={field}
                  placeholder={t.checkout.phonePlaceholder}
                />
                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                  {t.checkout.phoneHelp}
                </p>
              </div>

              <div>
                <label htmlFor="email" className={label}>
                  {t.checkout.email}{" "}
                  <span className="text-xs font-semibold text-slate-400">
                    {t.checkout.optional}
                  </span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={field}
                  placeholder={t.checkout.emailPlaceholder}
                />
                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                  {t.checkout.emailHelp}
                </p>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- delivery */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t.checkout.delivery}
            </h2>

            {zones.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                {t.checkout.zoneNone}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="zoneSlug" className={label}>
                    {t.checkout.zone} <Required text={t.checkout.required} />
                  </label>
                  <select
                    id="zoneSlug"
                    name="zoneSlug"
                    required
                    value={zoneSlug}
                    onChange={(event) => setZoneSlug(event.target.value)}
                    className={field}
                  >
                    <option value="">{t.checkout.zoneChoose}</option>
                    {zones.map((zone) => (
                      <option key={zone.slug} value={zone.slug}>
                        {zone.name} —{" "}
                        {zone.freeDelivery ? t.checkout.free : formatPrice(zone.feeTzs)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="address" className={label}>
                    {t.checkout.directions} <Required text={t.checkout.required} />
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    required
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
                    placeholder={t.checkout.directionsPlaceholder}
                  />
                </div>

                <div>
                  <label htmlFor="instructions" className={label}>
                    {t.checkout.notes}{" "}
                    <span className="text-xs font-semibold text-slate-400">
                      {t.checkout.optional}
                    </span>
                  </label>
                  <input
                    id="instructions"
                    name="instructions"
                    className={field}
                    placeholder={t.checkout.notesPlaceholder}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------- payment */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t.checkout.payment}
            </h2>

            <div className="mt-4 space-y-3">
              <PaymentChoice
                value="cash_on_delivery"
                defaultChecked
                title={t.checkout.paymentCash}
                note={t.checkout.paymentCashNote}
              />
              <PaymentChoice
                value="digital_on_delivery"
                title={t.checkout.paymentDigital}
                note={t.checkout.paymentDigitalNote}
              />
            </div>
          </section>

          <PlaceOrderButton
            disabled={!canOrder}
            total={quote ? formatPrice(quote.total_tzs) : ""}
            label={t.checkout.placeOrderWithTotal}
            placing={t.checkout.placing}
            fallback={t.checkout.placeOrder}
          />
        </form>

        {/* ---------------------------------------------------- summary */}
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
            <>
              <ul className="mt-4 space-y-2.5 border-b border-slate-100 pb-4">
                {items.map(({ product, quantity }) => {
                  // The quote's figure, not the cart's — they can differ, and
                  // when they do the shop's number is the true one.
                  const priced = quote?.items.find((line) => line.sku === product.sku);
                  const lineTotal = priced ? priced.line_total : null;
                  const short = priced && priced.available < quantity;

                  return (
                    <li key={product.sku} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 font-semibold text-slate-600">
                        <span className="text-slate-900">{quantity}×</span>{" "}
                        {productName(product)}{" "}
                        <span className="text-slate-400">{product.packSize}</span>
                        {short && (
                          <span className="mt-0.5 block text-xs font-bold text-amber-700">
                            {priced!.available === 0
                              ? t.checkout.basketProblem
                              : `${priced!.available} ${t.checkout.free === "FREE" ? "left" : "zimebaki"}`}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-black whitespace-nowrap text-slate-900">
                        {lineTotal === null ? "—" : formatPrice(lineTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label={t.checkout.subtotal} value={quote ? formatPrice(quote.subtotal_tzs) : "—"} />
                <Row
                  label={t.checkout.deliveryRow}
                  value={
                    !selectedZone
                      ? t.checkout.deliveryValue
                      : selectedZone.freeDelivery
                        ? t.checkout.free
                        : formatPrice(quote?.delivery_fee_tzs ?? selectedZone.feeTzs)
                  }
                />
                {quote && quote.discount_tzs > 0 && (
                  <Row label={t.checkout.discount} value={`− ${formatPrice(quote.discount_tzs)}`} />
                )}
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2.5 text-base">
                  <dt className="font-bold text-slate-900">{t.checkout.total}</dt>
                  <dd className="font-black whitespace-nowrap text-slate-900">
                    {quote ? formatPrice(quote.total_tzs) : "—"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs font-semibold text-slate-400" aria-live="polite">
                {quoting ? t.checkout.placing : t.checkout.priceUpdated}
              </p>
            </>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-500">
            <Icon name="wallet" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {fill(t.checkout.payNote, { area: site.serviceArea })}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Required({ text }: { text: string }) {
  return <span className="text-xs font-bold text-brand-700">{text}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 font-semibold text-slate-600">
      <dt>{label}</dt>
      <dd className="text-right font-black whitespace-nowrap text-slate-900">{value}</dd>
    </div>
  );
}

function PaymentChoice({
  value,
  title,
  note,
  defaultChecked,
}: {
  value: string;
  title: string;
  note: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="relative flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
      {/*
        The input covers the whole card rather than sitting inside it. What a
        thumb has to hit on a 390px phone is then the 56px card, not the 20px
        dot — which is the difference the QA gate's 44px rule is about. The dot
        below is drawn with `peer-checked`, so it still shows the real state of
        a real radio and keyboard focus still lands on the control.
      */}
      <input
        type="radio"
        name="paymentPreference"
        value={value}
        defaultChecked={defaultChecked}
        required
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 peer-checked:border-brand-600"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-transparent peer-checked:bg-brand-600" />
      </span>
      <span>
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-slate-500">{note}</span>
      </span>
    </label>
  );
}

/**
 * `useFormStatus` is what stops a double order: while the action is in flight
 * the button is disabled by the framework itself, not by a piece of state this
 * component has to remember to reset.
 */
function PlaceOrderButton({
  disabled,
  total,
  label,
  placing,
  fallback,
}: {
  disabled: boolean;
  total: string;
  label: string;
  placing: string;
  fallback: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      data-qa-anchor="checkout-place-order"
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-base font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? placing : total ? fill(label, { total }) : fallback}
      {!pending && <Icon name="arrowRight" className="h-5 w-5" />}
    </button>
  );
}
