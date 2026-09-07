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
import { site } from "@/lib/site";

export default function HomePage() {
  const categories = getCategories();
  const bestSellers = getBestSellers(8);

  return (
    <>
      <Hero />
      <CategoryStrip />

      <section className="shell scroll-mt-24 py-12 md:py-16" id="best-sellers">
        <SectionHeading
          title="Best sellers"
          eyebrow="This month"
          action={{ label: "Shop all", href: "/shop" }}
        />
        <ProductGrid products={bestSellers} />
      </section>

      {categories.map((category) => (
        <section key={category.id} className="shell scroll-mt-24 pb-12 md:pb-16">
          <SectionHeading
            title={category.name}
            action={{ label: "View all", href: `/shop?category=${category.slug}` }}
          />
          <ProductGrid products={getCategoryRail(category.id, 4)} />
        </section>
      ))}

      <TrustSection />

      <section className="bg-white py-12 md:py-16">
        <div className="shell">
          <div className="flex flex-col gap-6 rounded-[2rem] bg-gradient-to-br from-brand-600 to-emerald-500 p-6 text-white shadow-xl shadow-brand-600/20 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl">
              <p className="text-[11px] font-black tracking-widest text-white/80 uppercase">
                Where we deliver
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                Delivering across {site.serviceArea}.
              </h2>
              <p className="mt-3 text-sm leading-relaxed font-medium text-white/90 md:text-base">
                Tell us your area at checkout and we will confirm your delivery window before we set
                off. Not sure whether we reach you yet? Ask us.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 font-display text-base font-bold text-brand-700 transition-transform hover:-translate-y-0.5"
            >
              <Icon name="mapPin" className="h-5 w-5" />
              Check my area
            </Link>
          </div>
        </div>
      </section>

      <BrandSection />
      <HowItWorks />
    </>
  );
}
