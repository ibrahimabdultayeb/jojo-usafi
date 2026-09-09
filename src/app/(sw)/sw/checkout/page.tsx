import type { Metadata } from "next";
import { CheckoutView } from "@/views/CheckoutView";
import { getCheckoutZones } from "@/lib/commerce/checkout";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "sw" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.checkoutTitle,
  alternates: localeAlternates(locale, "/checkout"),
};

export default async function Page() {
  // Only ACTIVE zones, read as a shopper would read them.
  const zones = await getCheckoutZones();
  return <CheckoutView zones={zones} />;
}
