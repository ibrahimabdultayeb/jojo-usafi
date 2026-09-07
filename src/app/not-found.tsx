import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <div className="shell flex flex-col items-center justify-center gap-5 py-24 text-center md:py-32">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="search" className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Page not found
        </h1>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500 md:text-base">
          That page has moved or never existed. The shelf is still here though.
        </p>
      </div>
      <Link
        href="/shop"
        className="flex min-h-14 items-center gap-2 rounded-full bg-slate-900 px-7 font-display text-base font-bold text-white transition-colors hover:bg-brand-600"
      >
        Browse all products
        <Icon name="arrowRight" className="h-5 w-5" />
      </Link>
    </div>
  );
}
