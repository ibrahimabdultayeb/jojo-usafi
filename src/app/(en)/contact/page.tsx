import type { Metadata } from "next";
import { ContactView } from "@/views/ContactView";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "en" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.contactTitle,
  description: getDictionary(locale).meta.contactDescription,
  alternates: localeAlternates(locale, "/contact"),
};

export default function Page() {
  return <ContactView locale={locale} />;
}
