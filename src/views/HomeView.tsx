import Link from "next/link";
import { BrandSection } from "@/components/home/BrandSection";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { Hero, SHOP_SECTION_ID } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { TrustSection } from "@/components/home/TrustSection";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBestSellers, getCategories, getCategoryRail } from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";
import { site } from "@/lib/site";

/**
 * The homepage.
 *
 * Which sections appear is the Owner's decision, read from `shop_settings` and
 * defaulting to all of them — so the page is the approved Build 04 design until
 * somebody deliberately changes it. Switching a section off removes the section
 * and nothing else: the ones that remain do not reflow into the gap, because a
 * homepage that rearranges itself is a homepage nobody can describe over the
 * phone.
 */
export async function HomeView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const content = await getSiteContent(locale);
  const categories = await getCategories();
  // Ten so the widest shelf is two complete rows of five; narrower
  // column counts trim the tail themselves (see ProductGrid).
  const bestSellers = await getBestSellers(10);
  // One await for every rail, resolved together: a rail per category, but not
  // a database round trip per category — the catalogue is fetched once.
  const rails = await Promise.all(categories.map((c) => getCategoryRail(c.id, 5)));
  const shop = localePath(locale, "/shop");

  return (
    <>
      <Hero locale={locale} content={content} />

      {/* The promotion band. Both halves are required: a band switched on with
          nothing written in it would be an empty green stripe. */}
      {content.showPromo && content.promo && (
        <section className="shell pt-2 pb-6 md:pt-4">
          <p className="rounded-2xl bg-brand-50 px-5 py-4 text-center font-display text-sm font-bold text-brand-900 ring-1 ring-brand-200 ring-inset md:text-base">
            {content.promo}
          </p>
        </section>
      )}

      {/* Where the hero's down control lands. It lives here rather than on a
          section because every section below can be switched off, and an
          anchor that can disappear is a control that silently does nothing. */}
      <div id={SHOP_SECTION_ID} className="scroll-target outline-none" />

      {content.sections.categories && <CategoryStrip locale={locale} />}

      {content.sections.bestSellers && (
        <section className="shell scroll-mt-24 py-12 md:py-16" id="best-sellers">
          <SectionHeading
            title={t.home.bestSellers}
            eyebrow={t.home.thisMonth}
            action={{ label: t.home.shopAll, href: shop }}
          />
          <ProductGrid products={bestSellers} locale={locale} priorityCount={5} variant="twoRows" />
        </section>
      )}

      {content.sections.categoryGrids && categories.map((category, index) => (
        <section key={category.id} className="shell scroll-mt-24 pb-12 md:pb-16">
          <SectionHeading
            title={category.name}
            action={{ label: t.home.viewAll, href: `${shop}?category=${category.slug}` }}
          />
          <ProductGrid products={rails[index]} locale={locale} variant="rail" />
        </section>
      ))}

      {content.sections.trust && <TrustSection locale={locale} />}

      {content.sections.deliveryBanner && (
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
      )}

      {content.sections.brands && <BrandSection locale={locale} />}
      {content.sections.howItWorks && <HowItWorks locale={locale} />}
    </>
  );
}
