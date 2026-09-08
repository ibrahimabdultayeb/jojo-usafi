import type { Metadata } from "next";
import { ShopView, type ShopSearchParams } from "@/views/ShopView";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "sw" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.shopTitle,
  description: getDictionary(locale).meta.shopDescription,
  alternates: localeAlternates(locale, "/shop"),
};

export default function Page({ searchParams }: { searchParams: ShopSearchParams }) {
  return <ShopView locale={locale} searchParams={searchParams} />;
}
