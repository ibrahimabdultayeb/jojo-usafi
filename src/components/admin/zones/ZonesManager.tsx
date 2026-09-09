"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, SaveState, Sheet, Toggle, inputClass } from "@/components/admin/ui";
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
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const mayEdit = can(role, "delivery.manage");

  function upsert(draft: ZoneDraft) {
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
      const result = await saveZoneAction(draft.id, patch);
      if (result.ok) {
        setSave("saved");
        setEditing(null);
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
          <Button variant="accent" icon="plus" disabled={pending} onClick={() => setEditing(newZone())}>
            Add a zone
          </Button>
        )}
      </div>

      {problem && (
        <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">
          {problem}
        </p>
      )}

      <ul className="grid gap-2.5">
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
                  <Button variant="secondary" disabled={pending} onClick={() => setEditing(toDraft(zone))}>
                    Edit
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

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

      {editing && (
        <ZoneEditor zone={editing} pending={pending} onCancel={() => setEditing(null)} onSave={upsert} />
      )}
    </>
  );
}

function ZoneEditor({
  zone,
  pending,
  onCancel,
  onSave,
}: {
  zone: ZoneDraft;
  pending: boolean;
  onCancel: () => void;
  onSave: (zone: ZoneDraft) => void;
}) {
  const [draft, setDraft] = useState(zone);
  const isNew = zone.id === null;

  return (
    <Sheet open onClose={onCancel} title={isNew ? "Add a delivery zone" : `Edit ${zone.name}`}>
      <div className="space-y-4">
        {draft.isDevelopmentFixture && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
            This is an example area added during development. Rename it to a real one, or switch it
            off before the shop opens.
          </p>
        )}

        <Field label="Area name" hint="What customers will see at checkout.">
          <input
            autoFocus
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
              value={draft.freeDelivery ? "" : String(draft.feeTzs)}
              onChange={(e) => setDraft({ ...draft, feeTzs: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
              disabled={draft.freeDelivery}
              inputMode="numeric"
              placeholder={draft.freeDelivery ? "No charge" : undefined}
              className={`${inputClass} pl-12 tabular-nums`}
            />
          </div>
        </Field>

        <Toggle
          label="Free delivery"
          hint="Customers in this area pay nothing for delivery."
          checked={draft.freeDelivery}
          onChange={(v) => setDraft({ ...draft, freeDelivery: v })}
        />

        <Toggle
          label="Active"
          hint={draft.active ? "Customers can choose this area." : "Hidden from checkout."}
          checked={draft.active}
          onChange={(v) => setDraft({ ...draft, active: v })}
        />

        <Field label="Where it appears in the list" hint="1 shows first.">
          <input
            value={String(draft.sortPriority)}
            onChange={(e) =>
              setDraft({ ...draft, sortPriority: Number(e.target.value.replace(/[^0-9]/g, "")) || 1 })
            }
            inputMode="numeric"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} full>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={() => onSave(draft)}
            disabled={draft.name.trim() === "" || pending}
            full
          >
            {pending ? "Saving…" : isNew ? "Add zone" : "Save changes"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
