import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getDictionary, localePath, type Locale } from "@/lib/i18n";

export function NotFoundView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <div className="shell flex flex-col items-center justify-center gap-5 py-24 text-center md:py-32">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="search" className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          {t.notFound.title}
        </h1>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500 md:text-base">
          {t.notFound.body}
        </p>
      </div>
      <Link
        href={localePath(locale, "/shop")}
        className="flex min-h-14 items-center gap-2 rounded-full bg-slate-900 px-7 font-display text-base font-bold text-white transition-colors hover:bg-brand-600"
      >
        {t.notFound.cta}
        <Icon name="arrowRight" className="h-5 w-5" />
      </Link>
    </div>
  );
}
