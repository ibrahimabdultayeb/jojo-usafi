import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "@/app/globals.css";

import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LanguageGate } from "@/components/layout/LanguageGate";
import { MobileDock } from "@/components/layout/MobileDock";
import { SupportButton } from "@/components/layout/SupportButton";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/lib/cart";
import { CatalogueProvider } from "@/lib/catalogue/CatalogueContext";
import { ContactProvider } from "@/lib/ContactContext";
import { getContact } from "@/lib/contact";
import { getCatalogue } from "@/lib/catalogue/queries";
import { LocaleProvider } from "@/lib/i18n/client";
import { getDictionary, localeAlternates, localeTag, type Locale } from "@/lib/i18n";
import { isStaging } from "@/lib/environment";
import { getSiteContent } from "@/lib/site-content";
import { site } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

/** Root metadata for one language, including its hreflang alternates. */
export function storefrontMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.siteTitle, template: `%s · ${site.name}` },
    description: t.meta.siteDescription,
    alternates: localeAlternates(locale, "/"),
    // Belt and braces with `robots.txt`. That file asks a crawler not to FETCH
    // a page; this asks it not to LIST one — and a page linked from elsewhere
    // can be listed without ever being fetched.
    ...(isStaging() ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      siteName: site.name,
      locale: localeTag[locale].replace("-", "_"),
      type: "website",
    },
  };
}

/**
 * The shared storefront chrome.
 *
 * Each language has its own root layout so `<html lang>` is correct in the
 * static HTML rather than corrected after hydration. Both call this with their
 * own locale, so there is exactly one copy of the markup.
 */
export async function StorefrontLayout({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  // One fetch of the published catalogue for the whole page, handed to the
  // client components that need to turn a SKU back into a product.
  const catalogue = await getCatalogue();
  const t = getDictionary(locale);
  // What the Owner has decided about the words and the switches. One cached
  // read for the whole page; blank fields mean the wording below stands.
  const content = await getSiteContent(locale);
  // The shop's own telephone number and address, or the placeholders in
  // `site.ts` while Ibrahim has not provided them.
  const contact = await getContact();

  return (
    <html lang={localeTag[locale]} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased selection:bg-brand-100">
        <LocaleProvider locale={locale}>
          <CatalogueProvider catalogue={catalogue}>
          <ContactProvider contact={contact}>
          <CartProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-xl"
            >
              {t.skipToContent}
            </a>
            {content.showAnnouncement && <AnnouncementBar override={content.announcement} />}
            <Header />
            <main id="main" className="relative z-0 flex w-full flex-col bg-white">
              {children}
            </main>
            <Footer locale={locale} contact={contact} />
            <MobileDock />
            <SupportButton />
            <CartDrawer />
            <LanguageGate />
          </CartProvider>
          </ContactProvider>
          </CatalogueProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
