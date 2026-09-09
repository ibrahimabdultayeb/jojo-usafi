"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/client";
import { whatsappLink } from "@/lib/site";
import type { PlacedOrderSummary } from "@/lib/commerce/state";

/**
 * The order already exists before this screen renders.
 *
 * That is the whole point of the sequence: the row, its lines, its reservation
 * and its history are in PostgreSQL, and only then does the shopper see a
 * number. WhatsApp is offered underneath as support — a way to ask a question
 * about an order that is already placed, never the way to place one.
 */
export function OrderReceived({ order }: { order: PlacedOrderSummary }) {
  const { t, path } = useLocale();

  const payingBy =
    order.paymentPreference === "digital_on_delivery"
      ? t.checkout.paymentDigital
      : t.checkout.paymentCash;

  return (
    <div className="shell py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-center md:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600">
            <Icon name="check" className="h-7 w-7 text-white" />
          </span>

          <p className="mt-4 text-xs font-black tracking-widest text-brand-700 uppercase">
            {t.confirmation.eyebrow}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {t.confirmation.title}
          </h1>

          <p className="mt-4 text-sm font-bold text-slate-600">
            {t.confirmation.orderNumberLabel}
          </p>
          <p
            data-qa-anchor="order-number"
            className="font-display text-3xl font-black tracking-tight text-slate-900 md:text-4xl"
          >
            {order.orderNumber}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{t.confirmation.keepSafe}</p>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t.confirmation.items}
          </h2>

          <ul className="mt-4 space-y-2.5 border-b border-slate-100 pb-4">
            {order.items.map((item) => (
              <li key={item.sku} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 font-semibold text-slate-600">
                  <span className="text-slate-900">{item.quantity}×</span> {item.name}{" "}
                  <span className="text-slate-400">{item.packSize}</span>
                </span>
                <span className="shrink-0 font-black whitespace-nowrap text-slate-900">
                  {formatPrice(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3 font-semibold text-slate-600">
              <dt>{t.confirmation.subtotal}</dt>
              <dd className="font-black text-slate-900">{formatPrice(order.subtotalTzs)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-slate-600">
              <dt>{t.confirmation.delivery}</dt>
              <dd className="font-black text-slate-900">
                {order.deliveryFeeTzs === 0
                  ? t.checkout.free
                  : formatPrice(order.deliveryFeeTzs)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2.5 text-base">
              <dt className="font-bold text-slate-900">{t.confirmation.total}</dt>
              <dd className="font-black text-slate-900">{formatPrice(order.totalTzs)}</dd>
            </div>
          </dl>

          <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-xs font-bold text-slate-400">
                {t.confirmation.deliveringTo}
              </dt>
              <dd className="font-bold text-slate-900">
                {order.zoneName}
                <span className="block font-semibold text-slate-600">{order.address}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-400">{t.confirmation.paying}</dt>
              <dd className="font-bold text-slate-900">{payingBy}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-6 space-y-3">
          <Link
            href={path("/track-order")}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 text-base font-bold text-white transition hover:bg-slate-800"
          >
            {t.confirmation.trackMyOrder}
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>

          <a
            href={whatsappLink(fill(t.confirmation.whatsappMessage, { order: order.orderNumber }))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-slate-300 px-6 text-base font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <WhatsAppIcon className="h-5 w-5" />
            {t.confirmation.whatsappUs}
          </a>

          <Link
            href={path("/shop")}
            className="flex min-h-12 w-full items-center justify-center text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            {t.confirmation.keepShopping}
          </Link>
        </div>
      </div>
    </div>
  );
}
