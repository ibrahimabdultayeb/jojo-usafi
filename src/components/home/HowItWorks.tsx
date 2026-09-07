import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { site } from "@/lib/site";

const steps: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "cart",
    title: "Add what you need",
    body: "Browse the catalogue, choose your sizes and place the order online. No account needed.",
  },
  {
    icon: "message",
    title: "We confirm your delivery",
    body: "Our team confirms your order and your delivery window for your area in Dar es Salaam.",
  },
  {
    icon: "wallet",
    title: "Pay when it arrives",
    body: "Lipa ukipokea — pay by cash or mobile money once your order is in your hands.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-14 text-white md:py-20">
      <div aria-hidden className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-brand-600/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="shell relative">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-4xl">
            How ordering works.
          </h2>
          <p className="mt-3 text-base font-medium text-slate-300 md:text-lg">
            No accounts. No prepayment. Delivered across {site.serviceArea}.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                  <Icon name={step.icon} className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold md:text-xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed font-medium text-slate-300">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/shop"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 font-display text-base font-bold text-slate-900 transition-colors hover:bg-brand-500 hover:text-white sm:w-auto"
          >
            Start an order
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-white/20 px-8 font-display text-base font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            Ask a question
          </Link>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-slate-400">
          WhatsApp is here for support — you never need it to place an order.
        </p>
      </div>
    </section>
  );
}
