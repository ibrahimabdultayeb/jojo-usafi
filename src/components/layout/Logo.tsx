import Link from "next/link";
import { site } from "@/lib/site";

/**
 * PLACEHOLDER BRAND MARK — a typographic lockup standing in until the real
 * Jojo Usafi logo exists.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2 lg:gap-2.5" aria-label={`${site.name} home`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 shadow-lg shadow-brand-600/25 transition-shadow group-hover:shadow-brand-600/40 lg:h-10 lg:w-10">
        <span className="font-display text-lg leading-none font-bold text-white lg:text-xl">J</span>
      </span>
      <span
        className={`font-display leading-none font-bold tracking-tight text-slate-900 ${
          compact ? "text-lg" : "hidden text-lg min-[360px]:block lg:text-xl"
        }`}
      >
        JOJO <span className="text-brand-600">USAFI</span>
      </span>
    </Link>
  );
}
