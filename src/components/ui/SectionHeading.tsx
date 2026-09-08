import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface SectionHeadingProps {
  title: string;
  eyebrow?: string;
  action?: { label: string; href: string };
  /** `page` is the large top-of-section title; `rail` sits above a product grid. */
  level?: "page" | "rail";
}

export function SectionHeading({ title, eyebrow, action, level = "rail" }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex items-center gap-3 sm:gap-4 md:mb-8">
      <h2
        className={
          level === "page"
            ? "font-display text-2xl font-bold tracking-tight text-slate-900 md:text-4xl"
            : "font-display text-xl font-bold tracking-tight text-slate-900 uppercase md:text-3xl"
        }
      >
        {title}
      </h2>
      {eyebrow && (
        <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase sm:inline-block">
          {eyebrow}
        </span>
      )}
      <span className="h-px flex-1 bg-slate-200" aria-hidden />
      {action && (
        <Link
          href={action.href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          {action.label}
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
