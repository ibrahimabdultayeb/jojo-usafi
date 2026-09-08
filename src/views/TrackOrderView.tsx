"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon, WhatsAppGlyph, type IconName } from "@/components/ui/Icon";
import { useLocale } from "@/lib/i18n/client";
import { whatsappLink } from "@/lib/site";

/**
 * VISUAL SHELL ONLY.
 *
 * There is no order lookup in this prototype — submitting shows the state the
 * real page will use once orders exist in the database.
 */
export function TrackOrderView() {
  const { t, path } = useLocale();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

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
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
        >
          <div>
            <label htmlFor="order-number" className="mb-1.5 block text-sm font-bold text-slate-900">
              {t.track.orderNumber}
            </label>
            <input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t.track.phonePlaceholder}
              className={field}
            />
            <p className="mt-1.5 text-xs font-medium text-slate-400">{t.track.phoneHelp}</p>
          </div>

          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
          >
            {t.track.submit}
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>

          {submitted && (
            <div
              role="status"
              className="fade-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
            >
              {t.track.notConnected}
            </div>
          )}
        </form>

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
            href={whatsappLink(t.support.trackHelpMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-[filter] hover:brightness-95"
          >
            <WhatsAppGlyph className="h-4 w-4" />
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
