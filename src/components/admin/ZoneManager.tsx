"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useRole } from "@/components/admin/RoleContext";
import { Card, Chip } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { DEFAULT_ZONE_FEE } from "@/lib/admin/mock/zones";
import type { DeliveryZone } from "@/lib/admin/types";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

/**
 * Delivery zones.
 *
 * When Free Delivery is on, the fee box is disabled and the card says FREE, so
 * nobody has to reason about which of two numbers wins.
 *
 * PROTOTYPE: edits live on this screen only. The real list of areas Jojo Usafi
 * serves, and what each one costs, is still Ibrahim's decision.
 */
export function ZoneManager({ zones: initial }: { zones: DeliveryZone[] }) {
  const { allows } = useRole();
  const canEdit = allows("zones.edit");

  const [zones, setZones] = useState(initial);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [isNew, setIsNew] = useState(false);

  function openNew() {
    setIsNew(true);
    setEditing({
      id: `zone_${Date.now()}`,
      name: "",
      fee: DEFAULT_ZONE_FEE,
      freeDelivery: false,
      active: true,
      sortPriority: zones.length + 1,
    });
  }

  function openEdit(zone: DeliveryZone) {
    setIsNew(false);
    setEditing({ ...zone });
  }

  function save() {
    if (!editing || !editing.name.trim()) return;
    setZones((current) =>
      isNew
        ? [...current, editing]
        : current.map((zone) => (zone.id === editing.id ? editing : zone)),
    );
    setEditing(null);
  }

  const field =
    "min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
  const label = "mb-1.5 block text-sm font-bold text-slate-900";

  return (
    <div>
      {canEdit && (
        <button
          type="button"
          onClick={openNew}
          className="mb-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700"
        >
          <Icon name="plus" className="h-5 w-5" />
          Add a zone
        </button>
      )}

      <ul className="space-y-3">
        {zones
          .slice()
          .sort((a, b) => a.sortPriority - b.sortPriority)
          .map((zone) => (
            <li key={zone.id}>
              <Card className={zone.active ? "" : "opacity-70"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-slate-900">{zone.name}</p>
                    <p className="mt-0.5 font-display text-base font-black text-slate-900">
                      {zone.freeDelivery ? "FREE delivery" : formatPrice(zone.fee)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {zone.freeDelivery && <Chip tone="good" icon="check">Free delivery</Chip>}
                      {zone.active ? (
                        <Chip tone="good">Active</Chip>
                      ) : (
                        <Chip tone="neutral" icon="eyeOff">Not in use</Chip>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEdit(zone)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ))}
      </ul>

      <AdminDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? "Add a zone" : "Edit zone"}
        description="Where you deliver, and what it costs the customer."
        footer={
          <button
            type="button"
            onClick={save}
            disabled={!editing?.name.trim()}
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {isNew ? "Add zone" : "Save changes"}
          </button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label htmlFor="zone-name" className={label}>
                Zone name
              </label>
              <input
                id="zone-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus
                placeholder="e.g. Upanga"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="zone-fee" className={label}>
                Delivery fee ({site.currency})
              </label>
              <input
                id="zone-fee"
                value={editing.freeDelivery ? "" : String(editing.fee)}
                onChange={(e) => setEditing({ ...editing, fee: Number(e.target.value) || 0 })}
                disabled={editing.freeDelivery}
                inputMode="numeric"
                placeholder={editing.freeDelivery ? "Not used — delivery is free" : "4000"}
                className={field}
              />
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                {editing.freeDelivery
                  ? "Delivery is free in this zone, so no fee is charged."
                  : `New zones start at ${formatPrice(DEFAULT_ZONE_FEE)} until you change it.`}
              </p>
            </div>

            <ZoneToggle
              id="zone-free"
              label="Free delivery"
              hint="Customers in this zone pay nothing for delivery."
              checked={editing.freeDelivery}
              onChange={(value) => setEditing({ ...editing, freeDelivery: value })}
            />

            <ZoneToggle
              id="zone-active"
              label="Active"
              hint="Customers can choose this zone at checkout."
              checked={editing.active}
              onChange={(value) => setEditing({ ...editing, active: value })}
            />

            <div>
              <label htmlFor="zone-order" className={label}>
                Position in the list
              </label>
              <input
                id="zone-order"
                value={String(editing.sortPriority)}
                onChange={(e) =>
                  setEditing({ ...editing, sortPriority: Number(e.target.value) || 1 })
                }
                inputMode="numeric"
                className={field}
              />
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                1 shows first to customers.
              </p>
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

function ZoneToggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block font-display text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-xs font-medium text-slate-500">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
