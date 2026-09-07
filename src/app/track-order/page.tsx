"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { site, whatsappLink } from "@/lib/site";

/**
 * VISUAL SHELL ONLY.
 *
 * There is no order lookup in this prototype — submitting shows the state the
 * real page will use once orders live in Firestore.
 */

const timeline: { icon: IconName; label: string; note: string }[] = [
  { icon: "check", label: "Order received", note: "We have your order and your delivery area." },
  { icon: "package", label: "Being prepared", note: "Your items are picked and packed." },
  { icon: "truck", label: "Out for delivery", note: "On the way to you with your delivery window." },
  { icon: "wallet", label: "Delivered & paid", note: "Pay cash or mobile money on arrival." },
];

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="shell py-8 md:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[11px] font-bold tracking-widest text-brand-700 uppercase">
            <Icon name="package" className="h-3.5 w-3.5" />
            Order tracking
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Track your order
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500 md:text-base">
            Enter your order number and the phone number you ordered with.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
        >
          <div>
            <label htmlFor="order-number" className="mb-1.5 block text-sm font-bold text-slate-900">
              Order number
            </label>
            <input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              inputMode="text"
              autoComplete="off"
              placeholder="JU-10428"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-bold text-slate-900">
              Phone number
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07XX XXX XXX"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
            <p className="mt-1.5 text-xs font-medium text-slate-400">
              The same number you used when placing the order.
            </p>
          </div>

          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
          >
            Track order
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>

          {submitted && (
            <div className="fade-in rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Order tracking is not connected yet — this is a design preview. Once orders are live,
              your status will appear right here.
            </div>
          )}
        </form>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-slate-900 md:text-xl">
            What the stages mean
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
          <p className="text-sm font-semibold text-slate-600">
            Cannot find your order number? Our team can look it up for you.
          </p>
          <a
            href={whatsappLink(`Hi ${site.name}, I need help tracking my order.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="whatsapp" className="h-4 w-4" />
            Ask on WhatsApp
          </a>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-slate-500">
          <Link href="/shop" className="text-brand-700 hover:text-brand-800">
            Back to shopping
          </Link>
        </p>
      </div>
    </div>
  );
}
