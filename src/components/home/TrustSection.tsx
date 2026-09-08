import { Icon, type IconName } from "@/components/ui/Icon";
import { getDictionary, type Locale } from "@/lib/i18n";

export function TrustSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  const pillars: { icon: IconName; title: string; body: string }[] = [
    { icon: "wallet", title: t.trust.pillarPriceTitle, body: t.trust.pillarPriceBody },
    { icon: "leaf", title: t.trust.pillarSafeTitle, body: t.trust.pillarSafeBody },
    { icon: "truck", title: t.trust.pillarHeavyTitle, body: t.trust.pillarHeavyBody },
  ];

  return (
    <section className="bg-slate-50 py-14 md:py-20">
      <div className="shell">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {t.trust.title}
          </h2>
          <p className="mt-3 text-base font-medium text-slate-500 md:text-lg">{t.trust.subtitle}</p>
        </div>

        <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
          {pillars.map((pillar) => (
            <li
              key={pillar.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg md:p-8"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon name={pillar.icon} className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold text-slate-900 md:text-xl">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed font-medium text-slate-500">
                {pillar.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
