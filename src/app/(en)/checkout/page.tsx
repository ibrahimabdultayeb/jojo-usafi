import type { Metadata } from "next";
import { CheckoutView } from "@/views/CheckoutView";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "en" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.checkoutTitle,
  alternates: localeAlternates(locale, "/checkout"),
};

export default function Page() {
  return <CheckoutView />;
}
