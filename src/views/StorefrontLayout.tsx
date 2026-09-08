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
import { LocaleProvider } from "@/lib/i18n/client";
import { getDictionary, localeAlternates, localeTag, type Locale } from "@/lib/i18n";
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
export function StorefrontLayout({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getDictionary(locale);

  return (
    <html lang={localeTag[locale]} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased selection:bg-brand-100">
        <LocaleProvider locale={locale}>
          <CartProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-xl"
            >
              {t.skipToContent}
            </a>
            <AnnouncementBar />
            <Header />
            <main id="main" className="relative z-0 flex w-full flex-col bg-white">
              {children}
            </main>
            <Footer locale={locale} />
            <MobileDock />
            <SupportButton />
            <CartDrawer />
            <LanguageGate />
          </CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
