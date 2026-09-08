import Link from "next/link";
import { BrandSection } from "@/components/home/BrandSection";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { TrustSection } from "@/components/home/TrustSection";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBestSellers, getCategories, getCategoryRail } from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";

export function HomeView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const categories = getCategories();
  const bestSellers = getBestSellers(8);
  const shop = localePath(locale, "/shop");

  return (
    <>
      <Hero locale={locale} />
      <CategoryStrip locale={locale} />

      <section className="shell scroll-mt-24 py-12 md:py-16" id="best-sellers">
        <SectionHeading
          title={t.home.bestSellers}
          eyebrow={t.home.thisMonth}
          action={{ label: t.home.shopAll, href: shop }}
        />
        <ProductGrid products={bestSellers} locale={locale} priorityCount={4} />
      </section>

      {categories.map((category) => (
        <section key={category.id} className="shell scroll-mt-24 pb-12 md:pb-16">
          <SectionHeading
            title={category.name}
            action={{ label: t.home.viewAll, href: `${shop}?category=${category.slug}` }}
          />
          <ProductGrid products={getCategoryRail(category.id, 4)} locale={locale} />
        </section>
      ))}

      <TrustSection locale={locale} />

      <section className="bg-white py-12 md:py-16">
        <div className="shell">
          <div className="flex flex-col gap-6 rounded-[2rem] bg-gradient-to-br from-brand-600 to-emerald-500 p-6 text-white shadow-xl shadow-brand-600/20 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl">
              <p className="text-[11px] font-black tracking-widest text-white/80 uppercase">
                {t.home.deliveryEyebrow}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                {fill(t.home.deliveryTitle, { area: site.serviceArea })}
              </h2>
              <p className="mt-3 text-sm leading-relaxed font-medium text-white/90 md:text-base">
                {t.home.deliveryBody}
              </p>
            </div>
            <Link
              href={localePath(locale, "/contact")}
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 font-display text-base font-bold text-brand-700 transition-transform hover:-translate-y-0.5"
            >
              <Icon name="mapPin" className="h-5 w-5" />
              {t.home.deliveryCta}
            </Link>
          </div>
        </div>
      </section>

      <BrandSection locale={locale} />
      <HowItWorks locale={locale} />
    </>
  );
}
