"use client";

import { AnimatedList } from "@/components/ui/AnimatedList";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, SaveState, Sheet, Toggle, inputClass, useSheetPresence } from "@/components/admin/ui";
import { parseMoneyInput } from "@/lib/domain/money";
import { formatTsh } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import { saveZoneAction, type ZonePatch } from "@/lib/admin/actions";
import type { AdminZoneRow } from "@/lib/admin/orders";
import { DEFAULT_ZONE_FEE } from "@/lib/admin/model";

/**
 * Delivery zones.
 *
 * A zone is four decisions — name, fee, free or not, on or off — so the editor
 * is four controls and nothing else. Turning on Free delivery visibly disables
 * the fee rather than hiding it, so it is obvious the fee is being ignored
 * rather than lost.
 *
 * These are the real zones checkout quotes from. A fee changed here is the fee
 * the next customer is charged, which is why the list says so out loud.
 */

/** A zone the editor has not saved yet. `id` is null until the database gives one. */
type ZoneDraft = ZonePatch & { id: string | null; isDevelopmentFixture: boolean };

const toDraft = (zone: AdminZoneRow): ZoneDraft => ({
  id: zone.id,
  name: zone.name,
  feeTzs: zone.feeTzs,
  freeDelivery: zone.freeDelivery,
  active: zone.active,
  sortPriority: zone.sortPriority,
  isDevelopmentFixture: zone.isDevelopmentFixture,
});

export function ZonesManager({ zones, role }: { zones: AdminZoneRow[]; role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ZoneDraft | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorPresent = useSheetPresence(editorOpen);
  const inFlight = useRef(false);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const mayEdit = can(role, "delivery.manage");

  function edit(draft: ZoneDraft) {
    setProblem(null);
    setSave("idle");
    setEditing(draft);
    setEditorOpen(true);
  }

  function upsert(draft: ZoneDraft) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSave("saving");
    setProblem(null);
    startTransition(async () => {
      const patch: ZonePatch = {
        name: draft.name,
        feeTzs: draft.feeTzs,
        freeDelivery: draft.freeDelivery,
        active: draft.active,
        sortPriority: draft.sortPriority,
      };
      let result;
      try { result = await saveZoneAction(draft.id, patch); } catch {
        setSave("failed");
        setProblem("Could not save the change. Check your connection and try again.");
        return;
      } finally {
        inFlight.current = false;
      }
      if (result.ok) {
        setSave("saved");
        setEditorOpen(false);
        router.refresh();
        window.setTimeout(() => setSave("idle"), 3000);
      } else {
        setSave("failed");
        setProblem(result.message);
      }
    });
  }

  function newZone(): ZoneDraft {
    return {
      id: null,
      name: "",
      feeTzs: DEFAULT_ZONE_FEE,
      freeDelivery: false,
      active: true,
      sortPriority: zones.length + 1,
      isDevelopmentFixture: false,
    };
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SaveState state={save} />
        {mayEdit && (
          <Button variant="accent" icon="plus" disabled={pending} onClick={() => edit(newZone())}>
            Add a zone
          </Button>
        )}
      </div>

      {problem && !editorOpen && (
        <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">
          {problem}
        </p>
      )}

      <AnimatedList as="ul" className="grid gap-2.5">
        {zones.map((zone, index) => (
          <li key={zone.id}>
            <Card className={`p-4 ${zone.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-slate-900">
                    {zone.name || "Untitled zone"}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {zone.freeDelivery ? (
                      <Badge tone="good">Free delivery</Badge>
                    ) : (
                      <Badge tone="neutral">{formatTsh(zone.feeTzs)}</Badge>
                    )}
                    {zone.active ? <Badge tone="info">Active</Badge> : <Badge tone="warn">Switched off</Badge>}
                    {/* Placeholder areas are marked, never quietly passed off as real. */}
                    {zone.isDevelopmentFixture && <Badge tone="warn">Example area — replace</Badge>}
                    <span className="text-xs font-medium text-slate-400">Shows {index + 1}
                      {index + 1 === 1 ? "st" : index + 1 === 2 ? "nd" : index + 1 === 3 ? "rd" : "th"}
                    </span>
                  </p>
                </div>
                {mayEdit && (
                  <Button variant="secondary" disabled={pending} onClick={() => edit(toDraft(zone))}>
                    Edit
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </AnimatedList>

      {zones.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm font-bold text-slate-900">No delivery areas yet</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Add the first one and customers will be able to choose it at checkout.
          </p>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="truck" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Customers pick their area at checkout and pay the fee shown here. Switching a zone off
        removes it from checkout but never changes orders already placed.
      </p>

      {editorPresent && editing && (
        <ZoneEditor key={editing.id ?? "new"} open={editorOpen} zone={editing} pending={pending} problem={problem} onCancel={() => setEditorOpen(false)} onSave={upsert} />
      )}
    </>
  );
}

function ZoneEditor({
  open,
  zone,
  pending,
  problem,
  onCancel,
  onSave,
}: {
  open: boolean;
  zone: ZoneDraft;
  pending: boolean;
  problem: string | null;
  onCancel: () => void;
  onSave: (zone: ZoneDraft) => void;
}) {
  const [draft, setDraft] = useState(zone);
  const [feeInput, setFeeInput] = useState(String(zone.feeTzs));
  const [priorityInput, setPriorityInput] = useState(String(zone.sortPriority));
  const fee = parseMoneyInput(feeInput);
  const priorityValid = /^\d+$/.test(priorityInput.trim()) && Number(priorityInput) <= 2_147_483_647;
  const invalidFee = !draft.freeDelivery && !fee.ok;
  const fieldProblem = invalidFee && !fee.ok ? fee.reason : !priorityValid ? "List position must be a whole number, starting at 0." : null;
  const isNew = zone.id === null;

  return (
    <Sheet open={open} busy={pending} error={problem} onClose={onCancel} title={isNew ? "Add a delivery zone" : `Edit ${zone.name}`}>
      <div className="space-y-4">
        {draft.isDevelopmentFixture && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
            This is an example area added during development. Rename it to a real one, or switch it
            off before the shop opens.
          </p>
        )}

        <Field label="Area name" hint="What customers will see at checkout.">
          <input
            disabled={pending}
            maxLength={60}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Mikocheni"
            className={inputClass}
          />
        </Field>

        <Field
          label="Delivery fee"
          hint={
            draft.freeDelivery
              ? "Free delivery is on, so nothing is charged for this area."
              : `New zones start at ${formatTsh(DEFAULT_ZONE_FEE)}.`
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">
              TSh
            </span>
            <input
              value={draft.freeDelivery ? "" : feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              disabled={draft.freeDelivery || pending}
              aria-invalid={invalidFee}
              inputMode="numeric"
              placeholder={draft.freeDelivery ? "No charge" : undefined}
              className={`${inputClass} pl-12 tabular-nums`}
            />
          </div>
        </Field>

        <Toggle
          label="Free delivery"
          disabled={pending}
          hint="Customers in this area pay nothing for delivery."
          checked={draft.freeDelivery}
          onChange={(v) => setDraft({ ...draft, freeDelivery: v })}
        />

        <Toggle
          label="Active"
          disabled={pending}
          hint={draft.active ? "Customers can choose this area." : "Hidden from checkout."}
          checked={draft.active}
          onChange={(v) => setDraft({ ...draft, active: v })}
        />

        <Field label="Where it appears in the list" hint="1 shows first.">
          <input
            value={priorityInput}
            onChange={(e) => setPriorityInput(e.target.value)}
            disabled={pending}
            aria-invalid={!priorityValid}
            inputMode="numeric"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        {fieldProblem && <p role="alert" className="text-sm font-semibold text-rose-700">{fieldProblem}</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" disabled={pending} onClick={onCancel} full>
            Cancel
          </Button>
          <Button busy={pending}
            variant="accent"
            onClick={() => { if (!fieldProblem) onSave({ ...draft, feeTzs: draft.freeDelivery ? 0 : fee.ok ? fee.value : 0, sortPriority: Number(priorityInput) }); }}
            disabled={draft.name.trim().length < 2 || !!fieldProblem || pending}
            full
          >
            {pending ? "Saving…" : isNew ? "Add zone" : "Save changes"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
