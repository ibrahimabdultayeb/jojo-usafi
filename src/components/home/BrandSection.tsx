import Link from "next/link";
import { getBrands } from "@/lib/catalogue/queries";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";
import { toneSet } from "@/lib/tones";

/**
 * Jojo Usafi is the retailer, not the manufacturer. This section makes the shelf
 * read as a shop that carries brands, so adding an unrelated brand later needs no
 * new story. Only brands with something publishable on the shelf are listed, so
 * a tile never leads into an empty catalogue.
 */
export function BrandSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const brands = getBrands();

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="shell">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 md:p-10">
          <div className="mb-6 max-w-2xl md:mb-8">
            <p className="text-[11px] font-black tracking-widest text-brand-700 uppercase">
              {t.brands.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {t.brands.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed font-medium text-slate-500 md:text-base">
              {t.brands.body}
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {brands.map((brand) => {
              const tone = toneSet(brand.tone);
              return (
                <li key={brand.id}>
                  <Link
                    href={`${localePath(locale, "/shop")}?brand=${brand.slug}`}
                    className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl font-display text-lg font-black ${tone.tile}`}
                    >
                      {brand.mark}
                    </span>
                    <span className="font-display text-sm font-bold text-slate-900">
                      {brand.name}
                    </span>
                    <span className="text-[10px] leading-tight font-semibold text-slate-400">
                      {brand.tagline}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
