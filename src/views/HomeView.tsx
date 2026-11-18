import { FeaturedShelf } from "@/components/home/FeaturedShelf";
import { BrandMarquee, ClosingShowroom, OrderingJourney, ShopByNeed, ShowroomHero, WhyJojo } from "@/components/home/Showroom";
import { SurfexStory } from "@/components/home/SurfexStory";
import { getCatalogue } from "@/lib/catalogue/queries";
import type { Locale } from "@/lib/i18n";
import { getSiteContent } from "@/lib/site-content";

export async function HomeView({ locale }: { locale: Locale }) {
  const [content, { categories, brands, products }] = await Promise.all([getSiteContent(locale), getCatalogue()]);
  const surfex = products.find((product) => product.sku === "EP18-A07");
  const ozone = products.find((product) => product.sku === "EP05-A03");

  return (
    <div className="showroom-home">
      <ShowroomHero locale={locale} content={content} products={products} />
      {content.showPromo && content.promo && <p className="showroom-promo">{content.promo}</p>}
      {content.sections.brands && <BrandMarquee locale={locale} brands={brands} />}
      {content.sections.categories && (
        <ShopByNeed locale={locale} categories={categories} order={content.categoryOrder} />
      )}
      {(content.sections.featured || content.sections.bestSellers) && (
        <FeaturedShelf locale={locale} products={products} />
      )}
      {content.sections.featured && surfex && <SurfexStory locale={locale} slug={surfex.slug} />}
      {content.sections.trust && <WhyJojo locale={locale} ozone={ozone} />}
      {content.sections.howItWorks && <OrderingJourney locale={locale} />}
      {content.sections.deliveryBanner && <ClosingShowroom locale={locale} />}
    </div>
  );
}
