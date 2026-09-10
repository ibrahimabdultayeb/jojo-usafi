import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StableText } from "@/components/ui/StableText";
import { ScrollToSection } from "@/components/ui/ScrollToSection";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";

/** The id the down control scrolls to — the first shopping section on the page. */
export const SHOP_SECTION_ID = "shop-start";

/**
 * `content` is what the Owner typed on the Website screen. Each field is an
 * override: null means the designed copy below stands, so a shop that never
 * opens that screen has the homepage it was designed with.
 *
 * A supplied heading replaces the two-line gradient title with one line. The
 * gradient half is a typographic composition of a sentence this file wrote;
 * splitting somebody else's sentence in two to keep the effect would break
 * their wording to preserve our decoration.
 */
export function Hero({
  locale,
  content,
}: {
  locale: Locale;
  content?: {
    heroHeading: string | null;
    heroSub: string | null;
    heroCtaLabel: string | null;
    heroCtaHref: string | null;
  };
}) {
  const t = getDictionary(locale);
  const heading = content?.heroHeading ?? null;
  const sub = content?.heroSub ?? null;
  const ctaLabel = content?.heroCtaLabel ?? null;
  const ctaHref = content?.heroCtaHref ?? null;

  const proofPoints = [
    { icon: "shield" as const, label: t.hero.proofGenuine },
    { icon: "truck" as const, label: t.hero.proofDelivered },
    { icon: "wallet" as const, label: t.hero.proofPay },
  ];

  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-5 pt-10 pb-8 sm:px-6 md:min-h-[76svh] md:py-20">
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 hidden h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-50 opacity-70 blur-[120px] md:block"
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-20 -z-10 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl md:hidden"
      />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-[11px] font-bold tracking-widest text-brand-700 uppercase shadow-sm md:mb-8 md:text-xs">
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          {t.hero.badge}
        </span>

        <h1 className="mb-5 font-display text-[2.15rem] leading-[1.06] font-bold tracking-tight text-slate-900 sm:text-5xl md:mb-8 md:text-7xl md:leading-[1.02] lg:text-8xl">
          {heading ?? (
            <>
              {t.hero.titleTop}
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-emerald-400 bg-clip-text text-transparent">
                {t.hero.titleBottom}
              </span>
            </>
          )}
        </h1>

        <ul className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600 md:mb-8 md:text-sm">
          {proofPoints.map((point) => (
            <li key={point.label} className="inline-flex items-center gap-1.5">
              <Icon name={point.icon} className="h-4 w-4 text-brand-600" />
              {point.label}
            </li>
          ))}
        </ul>

        <p className="mx-auto mb-8 max-w-3xl text-base leading-relaxed font-medium text-slate-500 md:mb-10 md:text-xl lg:text-2xl">
          {sub ?? fill(t.hero.body, { area: site.serviceArea })}
        </p>

        {/* The two hero actions keep their size across languages, so the most
            prominent button row on the site is the same row in both. The
            anchors sit on the buttons rather than on this row: the row is as
            wide as the centred column, which the translated headline and body
            copy legitimately size. */}
        <div className="flex flex-col justify-center gap-3 sm:flex-row md:gap-4">
          {/* A typed button label is one specific string, so it cannot be
              width-stabilised against both dictionaries the way ours is. */}
          <Link
            href={localePath(locale, ctaHref ?? "/shop")}
            data-qa-anchor="hero-cta-shop"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-slate-900 px-8 font-display text-base font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-brand-200 md:px-10 md:text-lg"
          >
            {ctaLabel ?? <StableText pick={(d) => d.hero.ctaShop}>{t.hero.ctaShop}</StableText>}
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
          <Link
            href={localePath(locale, "/track-order")}
            data-qa-anchor="hero-cta-track"
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 font-display text-base font-bold text-slate-900 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 md:px-10 md:text-lg"
          >
            <StableText pick={(d) => d.hero.ctaTrack}>{t.hero.ctaTrack}</StableText>
          </Link>
        </div>
      </div>

      {/* A real control, not a decorative chevron: tab-reachable, Enter/Space
          operable, and it moves focus to the shelf so the keyboard follows. */}
      <ScrollToSection
        targetId={SHOP_SECTION_ID}
        label={t.hero.scrollToShop}
        className="group mt-8 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-700 md:mt-12"
      >
        <Icon
          name="chevronsDown"
          className="h-7 w-7 animate-pulse transition-transform group-hover:translate-y-0.5"
        />
      </ScrollToSection>
    </section>
  );
}
