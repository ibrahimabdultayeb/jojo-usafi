import { Card } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * A screen that exists in the navigation but is not built yet.
 *
 * It says plainly what it will do and what it is waiting for, so nobody has to
 * guess whether the feature is missing or broken.
 */
export function ComingSoon({
  icon,
  what,
  waitingFor,
  bullets,
}: {
  icon: IconName;
  what: string;
  waitingFor: string;
  bullets: string[];
}) {
  return (
    <Card>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-slate-900">Not built yet</h2>
      <p className="mt-1.5 text-sm leading-relaxed font-medium text-slate-500">{what}</p>

      <p className="mt-4 text-sm font-bold text-slate-900">It will cover</p>
      <ul className="mt-2 space-y-1.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm font-medium text-slate-600">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            {bullet}
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed font-semibold text-slate-600">
        <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
        Waiting for {waitingFor}.
      </p>
    </Card>
  );
}
