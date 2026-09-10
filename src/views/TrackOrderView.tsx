"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { useLocale } from "@/lib/i18n/client";
import { useWhatsAppLink } from "@/lib/ContactContext";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { trackOrderAction } from "@/lib/commerce/actions";
import { emptyTrackState } from "@/lib/commerce/state";
import type { OrderState } from "@/lib/domain/orders";

/**
 * Real order lookup.
 *
 * The order number AND the phone that placed it are both required, and a
 * mismatch is answered exactly like a wrong number — otherwise knowing that
 * JU-000128 exists would be enough to read it, and every order in the shop
 * could be read by counting upward. The projection the server returns carries
 * nothing internal: no staff notes, no actor identities, no payment reference.
 */
export function TrackOrderView() {
  const { t, path } = useLocale();
  const helpHref = useWhatsAppLink(t.support.trackHelpMessage);
  const [state, formAction] = useActionState(trackOrderAction, emptyTrackState);
  const order = state.order;

  const timeline: { icon: IconName; label: string; note: string }[] = [
    { icon: "check", label: t.track.stage1, note: t.track.stage1Note },
    { icon: "package", label: t.track.stage2, note: t.track.stage2Note },
    { icon: "truck", label: t.track.stage3, note: t.track.stage3Note },
    { icon: "wallet", label: t.track.stage4, note: t.track.stage4Note },
  ];

  const field =
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none";

  return (
    <div className="shell py-8 md:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[11px] font-bold tracking-widest text-brand-700 uppercase">
            <Icon name="package" className="h-3.5 w-3.5" />
            {t.track.eyebrow}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {t.track.title}
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500 md:text-base">{t.track.subtitle}</p>
        </header>

        <form
          action={formAction}
          className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
        >
          <div>
            <label htmlFor="order-number" className="mb-1.5 block text-sm font-bold text-slate-900">
              {t.track.orderNumber}
            </label>
            <input
              id="order-number"
              name="orderNumber"
              required
              inputMode="text"
              autoComplete="off"
              placeholder={t.track.orderNumberPlaceholder}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-bold text-slate-900">
              {t.track.phone}
            </label>
            <input
              id="phone"
              name="phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t.track.phonePlaceholder}
              className={field}
            />
            <p className="mt-1.5 text-xs font-medium text-slate-400">{t.track.phoneHelp}</p>
          </div>

          <TrackButton label={t.track.submit} checking={t.track.checking} />

          {state.error && (
            <div
              role="alert"
              className="fade-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
            >
              {state.error}
            </div>
          )}
        </form>

        {order && (
          <section
            data-qa-anchor="track-result"
            className="fade-in mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {fill(t.track.resultTitle, { order: order.order_number })}
              </h2>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black tracking-wide text-brand-700 uppercase">
                {t.orderStatus[order.state as OrderState]}
              </span>
            </div>

            <ul className="mt-5 space-y-2.5 border-b border-slate-100 pb-4">
              {order.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 font-semibold text-slate-600">
                    <span className="text-slate-900">{item.quantity}×</span> {item.product_name}{" "}
                    <span className="text-slate-400">{item.pack_size}</span>
                  </span>
                  <span className="shrink-0 font-black whitespace-nowrap text-slate-900">
                    {formatPrice(item.line_total_tzs)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3 text-base">
                <dt className="font-bold text-slate-900">{t.track.totalLabel}</dt>
                <dd className="font-black text-slate-900">{formatPrice(order.total_tzs)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">{t.track.deliveryLabel}</dt>
                <dd className="font-bold text-slate-900">
                  {order.delivery_zone_name}
                  <span className="block font-semibold text-slate-600">
                    {order.delivery_address}
                  </span>
                </dd>
              </div>
            </dl>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-slate-900 md:text-xl">
            {t.track.stagesTitle}
          </h2>
          <ol className="mt-4 space-y-3">
            {timeline.map((stage, i) => (
              <li
                key={stage.label}
                className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon name={stage.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-slate-900 md:text-base">
                    <span className="mr-2 text-slate-300">{i + 1}</span>
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">{stage.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 flex flex-col gap-3 rounded-3xl bg-slate-50 p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm font-semibold text-slate-600">{t.track.helpText}</p>
          <a
            href={helpHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-[filter] hover:brightness-95"
          >
            <WhatsAppIcon className="h-5 w-5" />
            {t.track.helpCta}
          </a>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-slate-500">
          <Link href={path("/shop")} className="text-brand-700 hover:text-brand-800">
            {t.track.backToShopping}
          </Link>
        </p>
      </div>
    </div>
  );
}

function TrackButton({ label, checking }: { label: string; checking: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? checking : label}
      {!pending && <Icon name="arrowRight" className="h-5 w-5" />}
    </button>
  );
}
