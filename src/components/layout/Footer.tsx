import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getCategories } from "@/lib/catalogue/queries";
import { site, whatsappLink } from "@/lib/site";

const shopLinks = [
  { label: "All Products", href: "/shop" },
  { label: "Track Your Order", href: "/track-order" },
  { label: "Contact Us", href: "/contact" },
];

export function Footer() {
  const categories = getCategories();

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
            Household cleaning and personal care essentials, delivered across {site.serviceArea}.
            Order online, pay when it arrives.
          </p>
          <a
            href={whatsappLink(`Hi ${site.name}, I have a question.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="whatsapp" className="h-4 w-4" />
            Chat on WhatsApp
          </a>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">Shop</h2>
          <ul className="mt-4 space-y-1">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">Categories</h2>
          <ul className="mt-4 space-y-1">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/shop?category=${category.slug}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-black tracking-widest text-slate-900 uppercase">Jojo Usafi</h2>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
            <li className="flex items-start gap-2.5">
              <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{site.addressLine}</span>
            </li>
            <li>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="flex min-h-11 items-center gap-2.5 hover:text-brand-700">
                <Icon name="phone" className="h-4 w-4 shrink-0 text-brand-600" />
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="flex min-h-11 items-center gap-2.5 break-all hover:text-brand-700">
                <Icon name="mail" className="h-4 w-4 shrink-0 text-brand-600" />
                {site.email}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                {site.hours}
                <br />
                <span className="font-medium text-slate-400">Orders online, any time.</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="shell flex flex-col items-center justify-between gap-2 py-6 text-center text-xs font-semibold text-slate-500 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Jojo Usafi. All rights reserved.</p>
          <p>
            Prices in <span className="font-black text-slate-700">TSh</span> · Delivering across{" "}
            {site.serviceArea}
          </p>
        </div>
      </div>
    </footer>
  );
}
