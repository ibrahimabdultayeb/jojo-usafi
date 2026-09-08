import { Card } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";

/** A placeholder that explains what will be here, rather than an empty page. */
export function ComingSoon({
  icon,
  title,
  body,
  bullets,
}: {
  icon: IconName;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <Card className="p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm font-medium text-slate-500">{body}</p>
      <ul className="mt-4 space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {bullet}
          </li>
        ))}
      </ul>
    </Card>
  );
}
