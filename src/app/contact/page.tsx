import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Reach the Jojo Usafi team about an order, a delivery area or a product.",
};

const channels = [
  {
    icon: "whatsapp" as const,
    title: "WhatsApp",
    body: "Fastest way to reach us about an order or a delivery area.",
    action: { label: "Open WhatsApp", href: whatsappLink(`Hi ${site.name}, I have a question.`), external: true },
  },
  {
    icon: "phone" as const,
    title: "Call us",
    body: site.hours,
    action: { label: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}`, external: false },
  },
  {
    icon: "mail" as const,
    title: "Email",
    body: "For invoices, bulk orders and anything that needs a paper trail.",
    action: { label: site.email, href: `mailto:${site.email}`, external: false },
  },
];

export default function ContactPage() {
  return (
    <div className="shell py-8 md:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Talk to us
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500 md:text-base">
            Questions about a product, a delivery area or an order already on its way — we are here
            {" "}
            {site.hours.toLowerCase()}.
          </p>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {channels.map((channel) => (
            <li
              key={channel.title}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon name={channel.icon} className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-base font-bold text-slate-900">{channel.title}</h2>
              <p className="mt-1 flex-1 text-sm font-medium text-slate-500">{channel.body}</p>
              <a
                href={channel.action.href}
                {...(channel.action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-bold break-all text-white transition-colors hover:bg-brand-600"
              >
                {channel.action.label}
              </a>
            </li>
          ))}
        </ul>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-slate-900 md:text-2xl">
            Where we deliver
          </h2>
          <p className="mt-2 text-sm leading-relaxed font-medium text-slate-500 md:text-base">
            Jojo Usafi delivers across {site.serviceArea}. If you are not sure whether we reach your
            street yet, send us your area and we will tell you straight away — and let you know when
            we do.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Icon name="mapPin" className="h-4 w-4 text-brand-600" />
            {site.addressLine}
          </p>
        </section>
      </div>
    </div>
  );
}
