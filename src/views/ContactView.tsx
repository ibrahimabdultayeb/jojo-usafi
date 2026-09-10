import { Icon } from "@/components/ui/Icon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { fill, getDictionary, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";
import { getContact, whatsappHref } from "@/lib/contact";

export async function ContactView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  // The shop’s own details when Ibrahim has provided them, the placeholders
  // in `site.ts` while he has not. One cached read, shared with the layout.
  const reach = await getContact();

  const channels = [
    {
      key: "whatsapp",
      title: t.contact.whatsappTitle,
      body: t.contact.whatsappBody,
      action: {
        label: t.contact.whatsappCta,
        href: whatsappHref(reach.whatsappNumber, t.support.questionMessage),
        external: true,
      },
    },
    {
      key: "phone",
      title: t.contact.callTitle,
      body: site.hours,
      action: {
        label: reach.phone,
        href: `tel:${reach.phone.replace(/\s/g, "")}`,
        external: false,
      },
    },
    {
      key: "mail",
      title: t.contact.emailTitle,
      body: t.contact.emailBody,
      action: { label: reach.email, href: `mailto:${reach.email}`, external: false },
    },
  ];

  return (
    <div className="shell py-8 md:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {t.contact.title}
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500 md:text-base">
            {fill(t.contact.subtitle, { hours: site.hours.toLowerCase() })}
          </p>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {channels.map((channel) => (
            <li
              key={channel.key}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                {channel.key === "whatsapp" ? (
                  <WhatsAppIcon className="h-5 w-5" />
                ) : (
                  <Icon name={channel.key === "phone" ? "phone" : "mail"} className="h-5 w-5" />
                )}
              </span>
              <h2 className="mt-4 font-display text-base font-bold text-slate-900">
                {channel.title}
              </h2>
              <p className="mt-1 flex-1 text-sm font-medium text-slate-500">{channel.body}</p>
              <a
                href={channel.action.href}
                {...(channel.action.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-bold break-all text-white transition-colors hover:bg-brand-600"
              >
                {channel.action.label}
              </a>
            </li>
          ))}
        </ul>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-slate-900 md:text-2xl">
            {t.contact.areaTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed font-medium text-slate-500 md:text-base">
            {fill(t.contact.areaBody, { area: site.serviceArea })}
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Icon name="mapPin" className="h-4 w-4 text-brand-600" />
            {reach.addressLine}
          </p>
        </section>
      </div>
    </div>
  );
}
