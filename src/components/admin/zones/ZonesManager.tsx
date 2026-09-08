"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, SaveState, Sheet, Toggle, inputClass } from "@/components/admin/ui";
import { formatTsh } from "@/lib/admin/format";
import { Icon } from "@/components/ui/Icon";
import { DEFAULT_ZONE_FEE, zones as seedZones, type AdminZone } from "@/mocks/admin/data";

/**
 * Delivery zones.
 *
 * A zone is four decisions — name, fee, free or not, on or off — so the editor
 * is four controls and nothing else. Turning on Free delivery visibly disables
 * the fee rather than hiding it, so it is obvious the fee is being ignored
 * rather than lost.
 */
export function ZonesManager() {
  const [zones, setZones] = useState<AdminZone[]>(seedZones);
  const [editing, setEditing] = useState<AdminZone | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "pending">("idle");

  function mockSave() {
    setSave("saving");
    window.setTimeout(() => setSave("saved"), 700);
    window.setTimeout(() => setSave("idle"), 3400);
  }

  function upsert(zone: AdminZone) {
    setZones((current) => {
      const exists = current.some((z) => z.id === zone.id);
      return exists ? current.map((z) => (z.id === zone.id ? zone : z)) : [...current, zone];
    });
    setEditing(null);
    mockSave();
  }

  function newZone(): AdminZone {
    return {
      id: `z${Date.now()}`,
      name: "",
      fee: DEFAULT_ZONE_FEE,
      freeDelivery: false,
      active: true,
      priority: zones.length + 1,
    };
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SaveState state={save} />
        <Button variant="accent" icon="plus" onClick={() => setEditing(newZone())}>
          Add a zone
        </Button>
      </div>

      <ul className="grid gap-2.5">
        {[...zones]
          .sort((a, b) => a.priority - b.priority)
          .map((zone) => (
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
                        <Badge tone="neutral">{formatTsh(zone.fee)}</Badge>
                      )}
                      {zone.active ? <Badge tone="info">Active</Badge> : <Badge tone="warn">Switched off</Badge>}
                      <span className="text-xs font-medium text-slate-400">Shows {zone.priority}
                        {zone.priority === 1 ? "st" : zone.priority === 2 ? "nd" : zone.priority === 3 ? "rd" : "th"}
                      </span>
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setEditing(zone)}>
                    Edit
                  </Button>
                </div>
              </Card>
            </li>
          ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs font-medium text-slate-600">
        <Icon name="truck" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Customers pick their area at checkout and pay the fee shown here. Switching a zone off
        removes it from checkout but never changes orders already placed.
      </p>

      {editing && <ZoneEditor zone={editing} onCancel={() => setEditing(null)} onSave={upsert} />}
    </>
  );
}

function ZoneEditor({
  zone,
  onCancel,
  onSave,
}: {
  zone: AdminZone;
  onCancel: () => void;
  onSave: (zone: AdminZone) => void;
}) {
  const [draft, setDraft] = useState(zone);
  const isNew = zone.name === "";

  return (
    <Sheet open onClose={onCancel} title={isNew ? "Add a delivery zone" : `Edit ${zone.name}`}>
      <div className="space-y-4">
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
              value={draft.freeDelivery ? "" : String(draft.fee)}
              onChange={(e) => setDraft({ ...draft, fee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
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
            value={String(draft.priority)}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value.replace(/[^0-9]/g, "")) || 1 })}
            inputMode="numeric"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel} full>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => onSave(draft)} disabled={draft.name.trim() === ""} full>
            {isNew ? "Add zone" : "Save changes"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
