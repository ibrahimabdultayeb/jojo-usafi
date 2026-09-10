"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Sheet, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { ROLE_LABELS, type Role } from "@/lib/admin/permissions";
import { whenWords } from "@/lib/admin/format";
import {
  changeStaffRoleAction,
  inviteStaffAction,
  setStaffActiveAction,
  type ActionResult,
} from "@/lib/admin/owner-actions";
import type { StaffMember } from "@/lib/admin/staff";

/**
 * Who can use the dashboard.
 *
 * Owner-only, and it says so rather than showing a Manager a screen full of
 * controls that will all be refused. Passwords appear nowhere: Supabase sends
 * the invitation and owns the credential, and this screen never sees one.
 *
 * The last active Owner is drawn without controls at all. The database refuses
 * to demote or deactivate them regardless — that guarantee is a trigger, not a
 * disabled button — but offering the button and then refusing would be a worse
 * way to learn it.
 */
export function StaffManager({
  staff,
  role,
  currentId,
}: {
  staff: StaffMember[];
  role: Role;
  currentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const isOwner = role === "owner";

  function run(operation: () => Promise<ActionResult>, onDone?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await operation();
      setResult(outcome);
      if (outcome.ok) {
        onDone?.();
        router.refresh();
      }
    });
  }

  if (!isOwner) {
    return (
      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">Only the Owner manages staff</p>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Adding people, changing what they can do and switching accounts off are the Owner&rsquo;s
          to decide. Ask them if somebody needs access.
        </p>
      </Card>
    );
  }

  const active = staff.filter((person) => person.active);
  const inactive = staff.filter((person) => !person.active);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">
          {active.length} {active.length === 1 ? "person" : "people"} can sign in
        </p>
        <Button variant="accent" icon="plus" disabled={pending} onClick={() => setInviteOpen(true)}>
          Add someone
        </Button>
      </div>

      {result && (
        <Card className={`mb-4 p-4 ${result.ok ? "" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-sm font-bold ${result.ok ? "text-slate-900" : "text-amber-900"}`}>
            {result.message}
          </p>
        </Card>
      )}

      <ul className="mb-5 grid gap-2.5">
        {active.map((person) => (
          <li key={person.id}>
            <StaffCard
              person={person}
              isYou={person.id === currentId}
              pending={pending}
              onRole={(next) => run(() => changeStaffRoleAction(person.id, next))}
              onActive={(next) => run(() => setStaffActiveAction(person.id, next))}
            />
          </li>
        ))}
      </ul>

      {inactive.length > 0 && (
        <>
          <p className="mb-2 text-sm font-bold text-slate-500">Switched off</p>
          <ul className="mb-5 grid gap-2.5">
            {inactive.map((person) => (
              <li key={person.id}>
                <StaffCard
                  person={person}
                  isYou={person.id === currentId}
                  pending={pending}
                  onRole={(next) => run(() => changeStaffRoleAction(person.id, next))}
                  onActive={(next) => run(() => setStaffActiveAction(person.id, next))}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Nobody can sign up on their own — an account exists only because you added it, and no
        password is ever shown here. Setting one is not built yet: somebody you add today cannot
        sign in until that screen exists.
      </p>

      <InviteSheet
        open={inviteOpen}
        pending={pending}
        onClose={() => setInviteOpen(false)}
        onInvite={(name, email, inviteRole) =>
          run(() => inviteStaffAction(name, email, inviteRole), () => setInviteOpen(false))
        }
      />
    </>
  );
}

function StaffCard({
  person,
  isYou,
  pending,
  onRole,
  onActive,
}: {
  person: StaffMember;
  isYou: boolean;
  pending: boolean;
  onRole: (role: Role) => void;
  onActive: (active: boolean) => void;
}) {
  // The last Owner and your own account are the two cards without controls.
  // Both are refused by the database anyway; not drawing the button is the
  // difference between a rule and a trap.
  const locked = person.isLastOwner || isYou;

  return (
    <Card className={`p-4 ${person.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-slate-900">
            {person.name}
            {isYou && <span className="ml-2 text-xs font-semibold text-slate-400">you</span>}
          </p>
          <p className="truncate text-sm font-medium text-slate-500">{person.email ?? "No email"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={person.role === "owner" ? "good" : "neutral"}>
              {ROLE_LABELS[person.role]}
            </Badge>
            {!person.active && <Badge tone="warn">Switched off</Badge>}
            {!person.hasLogin && <Badge tone="warn">Has not signed in yet</Badge>}
            {person.isLastOwner && <Badge tone="info">The only Owner</Badge>}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            Last seen {whenWords(person.lastSeenAt).toLowerCase()}
          </p>
        </div>
      </div>

      {!locked && (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-500">What they can do</span>
            <select
              value={person.role}
              disabled={pending || !person.active}
              onChange={(event) => onRole(event.target.value as Role)}
              className={`${inputClass} disabled:opacity-50`}
            >
              <option value="order_staff">Order staff</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </label>

          <div className="flex items-end">
            <Button
              variant={person.active ? "danger" : "secondary"}
              full
              disabled={pending}
              onClick={() => onActive(!person.active)}
            >
              {person.active ? "Switch off" : "Switch back on"}
            </Button>
          </div>
        </div>
      )}

      {person.isLastOwner && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
          The shop must always have one Owner, so this account cannot be changed or switched off.
          Make somebody else an Owner first.
        </p>
      )}
    </Card>
  );
}

function InviteSheet({
  open,
  pending,
  onClose,
  onInvite,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onInvite: (name: string, email: string, role: Role) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("order_staff");

  if (!open) return null;

  return (
    <Sheet open onClose={onClose} title="Add someone to the shop">
      <div className="space-y-4">
        <Field label="Their name" hint="As you would say it to them.">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="e.g. Neema Mushi"
          />
        </Field>

        <Field label="Their email address" hint="This is how they sign in and set a password.">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            className={inputClass}
            placeholder="name@example.com"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-bold text-slate-900">What can they do?</p>
          <div className="grid gap-2">
            {(["order_staff", "manager"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                aria-pressed={role === option}
                className={`flex min-h-14 items-start justify-between rounded-xl border-2 px-4 py-2 text-left transition-colors ${
                  role === option
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">
                    {ROLE_LABELS[option]}
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {option === "order_staff"
                      ? "Work on orders and see customers"
                      : "Everything except staff and shop settings"}
                  </span>
                </span>
                {role === option && <Icon name="check" className="mt-1 h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            An Owner is not invited. Add the person first, then change their role if you want them
            to be one.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onClose} full>
            Cancel
          </Button>
          <Button
            variant="accent"
            full
            disabled={pending || name.trim().length < 2 || email.trim() === ""}
            onClick={() => onInvite(name, email, role)}
          >
            {pending ? "Adding…" : "Add them"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
