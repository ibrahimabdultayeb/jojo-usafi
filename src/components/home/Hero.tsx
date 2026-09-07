import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/lib/site";

const proofPoints = [
  { icon: "shield" as const, label: "Genuine products" },
  { icon: "truck" as const, label: "Delivered in Dar" },
  { icon: "wallet" as const, label: "Pay on delivery" },
];

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-5 pt-10 pb-12 sm:px-6 md:min-h-[76svh] md:py-24">
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 hidden h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50 opacity-70 blur-[120px] md:block"
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-20 -z-10 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl md:hidden"
      />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-[11px] font-bold tracking-widest text-brand-700 uppercase shadow-sm md:mb-8 md:text-xs">
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          Household essentials, delivered
        </span>

        <h1 className="mb-5 font-display text-[2.15rem] leading-[1.06] font-bold tracking-tight text-slate-900 sm:text-5xl md:mb-8 md:text-7xl md:leading-[1.02] lg:text-8xl">
          A cleaner home.
          <br />
          <span className="bg-gradient-to-r from-brand-600 to-emerald-400 bg-clip-text text-transparent">
            Without the trip.
          </span>
        </h1>

        <ul className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600 md:mb-8 md:text-sm">
          {proofPoints.map((point) => (
            <li key={point.label} className="inline-flex items-center gap-1.5">
              <Icon name={point.icon} className="h-4 w-4 text-brand-600" />
              {point.label}
            </li>
          ))}
        </ul>

        <p className="mx-auto mb-8 max-w-3xl text-base leading-relaxed font-medium text-slate-500 md:mb-10 md:text-xl lg:text-2xl">
          From restocking your shower gel to refilling a 20&nbsp;litre detergent, Jojo Usafi brings
          household essentials to your door across {site.serviceArea}.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row md:gap-4">
          <Link
            href="/shop"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-slate-900 px-8 font-display text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-200 md:px-10 md:text-lg"
          >
            Shop all products
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
          <Link
            href="/track-order"
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 font-display text-base font-bold text-slate-900 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 md:px-10 md:text-lg"
          >
            Track my order
          </Link>
        </div>
      </div>

      <div
        aria-hidden
        className="mt-14 hidden flex-col items-center text-brand-400 md:flex"
      >
        <Icon name="chevronsDown" className="h-7 w-7 animate-pulse" />
      </div>
    </section>
  );
}
