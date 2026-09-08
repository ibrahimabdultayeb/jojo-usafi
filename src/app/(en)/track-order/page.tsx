import type { Metadata } from "next";
import { TrackOrderView } from "@/views/TrackOrderView";
import { getDictionary, localeAlternates } from "@/lib/i18n";

const locale = "en" as const;

export const metadata: Metadata = {
  title: getDictionary(locale).meta.trackTitle,
  alternates: localeAlternates(locale, "/track-order"),
};

export default function Page() {
  return <TrackOrderView />;
}
