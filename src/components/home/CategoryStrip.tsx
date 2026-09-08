import Link from "next/link";
import { SHOP_SECTION_ID } from "@/components/home/Hero";
import { getCategories, getProductsByCategory } from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { toneSet } from "@/lib/tones";

/**
 * Shop by category, and the target of the hero's down control — the first
 * shopping surface below the fold. On phones this is a horizontal rail so the
 * categories stay one thumb-swipe away instead of pushing the shelf off screen.
 */
export function CategoryStrip({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const categories = getCategories();

  return (
    <section
      id={SHOP_SECTION_ID}
      className="scroll-target border-y border-slate-100 bg-white py-8 outline-none md:py-12"
    >
      <div className="shell">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {t.categories.title}
          </h2>
          <Link
            href={localePath(locale, "/shop")}
            className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-brand-700 hover:text-brand-800 md:text-sm"
          >
            {t.categories.viewAll}
          </Link>
        </div>
      </div>

      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible">
        {categories.map((category) => {
          const tone = toneSet(category.tone);
          const total = getProductsByCategory(category.id).length;
          return (
            <Link
              key={category.id}
              href={`${localePath(locale, "/shop")}?category=${category.slug}`}
              className="group flex w-[9.5rem] shrink-0 snap-start flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg sm:w-[11rem] lg:w-auto lg:p-5"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.tile}`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden
                >
                  <path d={category.icon} />
                </svg>
              </span>
              <span className="font-display text-sm leading-tight font-bold text-slate-900 group-hover:text-brand-700 lg:text-base">
                {category.name}
              </span>
              <span className="mt-auto text-[11px] font-bold text-slate-400">
                {fill(t.categories.productCount, { count: total })}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
