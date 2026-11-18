import Link from "@/components/ui/LoadingLink";
import { Logo } from "./Logo";
import { MotionPreference } from "./ShowroomMotion";
import { showroomCopy } from "@/components/home/showroom-copy";
import { getCatalogue } from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";

export async function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const copy = showroomCopy(locale);
  const { categories } = await getCatalogue();
  const home = localePath(locale, "/");
  const shop = localePath(locale, "/shop");
  const contact = localePath(locale, "/contact");
  const layout = [
    ["laundry-care", copy.categories[0][0]], ["washroom-and-surface-care", copy.categories[2][0]],
    ["housekeeping", copy.categories[3][0]], ["personal-care", copy.categories[4][0]],
  ];
  const shopLinks = [
    { href: shop, label: t.footer.allProducts },
    ...layout.filter(([slug]) => categories.some((category) => category.slug === slug))
      .map(([slug, label]) => ({ href: `${shop}?category=${slug}`, label })),
  ];

  return (
    <footer className="showroom-footer">
      <div className="showroom-wrap showroom-footer-grid">
        <div className="showroom-footer-brand">
          <Logo compact />
          <p>{fill(t.footer.blurb, { area: site.serviceArea })}</p>
        </div>
        <div>
          <h2>{t.footer.shop}</h2>
          <ul>
            {shopLinks.map(({ href, label }) => <li key={href}><Link href={href}>{label}</Link></li>)}
            <li><Link href={`${shop}?need=kitchen`}>{copy.categories[1][0]}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{copy.information}</h2>
          <ul>
            <li><Link href={localePath(locale, "/track-order")}>{t.footer.trackOrder}</Link></li>
            <li><Link href={contact}>{t.footer.contactUs}</Link></li>
            <li><Link href={localePath(locale, "/checkout")}>{copy.deliveryAreas}</Link></li>
            <li><Link href={`${home}#how-ordering-works`}>{copy.ordering}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t.footer.company}</h2>
          <ul>
            <li>Dar es Salaam, Tanzania</li>
            <li><Link href={contact}>{t.footer.contactUs}</Link></li>
          </ul>
          <MotionPreference label={copy.reduceMotion} />
        </div>
      </div>
      <div className="showroom-wrap showroom-footer-bottom">
        <span>{fill(t.footer.rights, { year: new Date().getFullYear() })}</span>
        <span>{fill(t.footer.delivering, { area: site.serviceArea })}</span>
      </div>
    </footer>
  );
}
