import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { getCategories } from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site, whatsappLink } from "@/lib/site";

export async function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const categories = await getCategories();
  const path = (p: string) => localePath(locale, p);

  const shopLinks = [
    { label: t.footer.allProducts, href: "/shop" },
    { label: t.footer.trackOrder, href: "/track-order" },
    { label: t.footer.contactUs, href: "/contact" },
  ];

  return (
    <footer className="relative z-10 border-t border-slate-200 bg-slate-50">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 md:py-16 lg:grid-cols-4 lg:gap-8">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 shadow-lg shadow-brand-600/25">
              <span className="font-display text-xl leading-none font-bold text-white">J</span>
            </span>
            <span className="font-display text-xl leading-none font-bold tracking-tight text-slate-900">
              JOJO <span className="text-brand-600">USAFI</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed font-medium text-slate-500">
            {fill(t.footer.blurb, { area: site.serviceArea })}
          </p>
          <a
            href={whatsappLink(t.support.questionMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-[filter] hover:brightness-95"
          >
            <WhatsAppIcon className="h-5 w-5" />
            {t.footer.whatsappCta}
          </a>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">
            {t.footer.shop}
          </h2>
          <ul className="mt-4 space-y-1">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={path(link.href)}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">
            {t.footer.categories}
          </h2>
          <ul className="mt-4 space-y-1">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`${path("/shop")}?category=${category.slug}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">
            {t.footer.company}
          </h2>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
            <li className="flex items-start gap-2.5">
              <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{site.addressLine}</span>
            </li>
            <li>
              <a
                href={`tel:${site.phone.replace(/\s/g, "")}`}
                className="flex min-h-11 items-center gap-2.5 hover:text-brand-700"
              >
                <Icon name="phone" className="h-4 w-4 shrink-0 text-brand-600" />
                {site.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="flex min-h-11 items-center gap-2.5 break-all hover:text-brand-700"
              >
                <Icon name="mail" className="h-4 w-4 shrink-0 text-brand-600" />
                {site.email}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                {site.hours}
                <br />
                <span className="font-medium text-slate-400">{t.footer.ordersAnytime}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="shell flex flex-col items-center justify-between gap-2 py-6 text-center text-xs font-semibold text-slate-500 sm:flex-row sm:text-left">
          <p>{fill(t.footer.rights, { year: new Date().getFullYear() })}</p>
          <p>
            {t.footer.pricesIn} <span className="font-black text-slate-700">{site.currency}</span> ·{" "}
            {fill(t.footer.delivering, { area: site.serviceArea })}
          </p>
        </div>
      </div>
    </footer>
  );
}
