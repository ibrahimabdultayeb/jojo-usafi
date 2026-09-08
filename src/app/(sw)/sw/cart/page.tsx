import type { Metadata } from "next";
import { CartView } from "@/views/CartView";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "sw" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.cartTitle,
  alternates: localeAlternates(locale, "/cart"),
};

export default function Page() {
  return <CartView />;
}
