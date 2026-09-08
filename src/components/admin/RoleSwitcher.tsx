"use client";

import { useRole } from "@/components/admin/RoleContext";
import { Icon } from "@/components/ui/Icon";
import { roleDescription, roleLabel, roles } from "@/lib/admin/permissions";

/**
 * PROTOTYPE CONTROL — not a security feature.
 *
 * There is no sign-in yet, so this switch is how the permission-aware screens
 * can actually be tried out: pick a role and watch the buttons a role cannot use
 * disappear. It protects nothing, and it disappears the moment Supabase Auth
 * provides a real session.
 */
export function RoleSwitcher() {
  const { role, setRole } = useRole();

  return (
    <div>
      <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
        There is no sign-in yet. This switch is only here so you can see how the admin changes
        for each role.
      </p>

      <div role="radiogroup" aria-label="Preview a role" className="mt-3 space-y-2">
        {roles.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={role === option}
            onClick={() => setRole(option)}
            className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left transition-colors ${
              role === option
                ? "border-brand-600 bg-brand-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="min-w-0">
              <span className="block font-display text-sm font-bold text-slate-900">
                {roleLabel[option]}
              </span>
              <span className="block text-xs font-medium text-slate-500">
                {roleDescription[option]}
              </span>
            </span>
            {role === option && (
              <Icon name="check" className="h-5 w-5 shrink-0 text-brand-700" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
