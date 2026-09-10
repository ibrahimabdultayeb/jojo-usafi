"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Field, Sheet, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatTsh } from "@/lib/admin/format";
import type { AdminOrder } from "@/lib/admin/model";

/**
 * Changing what is in an order, before it goes out.
 *
 * Mobile-first and deliberately blunt: a row per item with minus, the number,
 * plus, and remove. No drag handles, no inline search results competing with a
 * keyboard on a 390px screen.
 *
 * WHAT IT DOES NOT DO IS THE POINT. It never computes a total, never checks
 * stock and never decides whether a change is possible. The figure it shows
 * before saving is labelled as an estimate for exactly that reason: the real
 * total comes back from the database, priced from the catalogue, and if the two
 * ever disagree the database is right.
 */

export interface AmendableProduct {
  readonly sku: string;
  readonly name: string;
  readonly packSize: string;
  readonly priceTzs: number;
  readonly available: number;
}

interface Line {
  sku: string;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
  /** True for a line that was not on the order when the sheet opened. */
  added: boolean;
}

export function AmendSheet({
  order,
  catalogue,
  pending,
  onClose,
  onConfirm,
}: {
  order: AdminOrder;
  catalogue: readonly AmendableProduct[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (lines: { sku: string; quantity: number }[], reason: string) => void;
}) {
  const original = useMemo(
    () =>
      order.lines.map((line) => ({
        sku: line.sku,
        name: line.name,
        size: line.size,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        added: false,
      })),
    [order.lines],
  );

  const [lines, setLines] = useState<Line[]>(original);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const setQuantity = (sku: string, quantity: number) =>
    setLines((current) =>
      current.map((line) => (line.sku === sku ? { ...line, quantity: Math.max(1, quantity) } : line)),
    );

  const remove = (sku: string) => setLines((current) => current.filter((line) => line.sku !== sku));

  const add = (product: AmendableProduct) => {
    setLines((current) =>
      current.some((line) => line.sku === product.sku)
        ? current.map((line) =>
            line.sku === product.sku ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [
            ...current,
            {
              sku: product.sku,
              name: product.name,
              size: product.packSize,
              quantity: 1,
              unitPrice: product.priceTzs,
              added: true,
            },
          ],
    );
    setAdding(false);
    setSearch("");
  };

  /* --------------------------------------------------- what changed */

  const changes: string[] = [];
  for (const before of original) {
    const now = lines.find((line) => line.sku === before.sku);
    if (!now) changes.push(`${before.name} removed`);
    else if (now.quantity !== before.quantity) {
      changes.push(`${before.name}: ${before.quantity} → ${now.quantity}`);
    }
  }
  for (const line of lines) {
    if (!original.some((before) => before.sku === line.sku)) {
      changes.push(`${line.name} added (${line.quantity})`);
    }
  }

  const estimate =
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) +
    (order.delivery.freeDelivery ? 0 : order.delivery.fee);

  const matches = catalogue
    .filter((product) => {
      const query = search.trim().toLowerCase();
      if (query === "") return false;
      return `${product.name} ${product.sku}`.toLowerCase().includes(query);
    })
    .slice(0, 6);

  const ready = changes.length > 0 && reason.trim().length > 0 && lines.length > 0;

  return (
    <Sheet open onClose={onClose} title={`Change ${order.number}`}>
      <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {lines.map((line) => (
          <li key={line.sku} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{line.name}</p>
                <p className="text-xs font-medium text-slate-500">
                  {line.size} · {formatTsh(line.unitPrice)} each
                  {line.added && <Badge tone="good" className="ml-2">New</Badge>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(line.sku)}
                disabled={pending}
                aria-label={`Remove ${line.name}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(line.sku, line.quantity - 1)}
                disabled={pending || line.quantity <= 1}
                aria-label="One fewer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40"
              >
                <Icon name="minus" className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-display text-lg font-black text-slate-900 tabular-nums">
                {line.quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(line.sku, line.quantity + 1)}
                disabled={pending}
                aria-label="One more"
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40"
              >
                <Icon name="plus" className="h-4 w-4" />
              </button>
              <span className="ml-auto text-sm font-black text-slate-900 tabular-nums">
                {formatTsh(line.unitPrice * line.quantity)}
              </span>
            </div>
          </li>
        ))}

        {lines.length === 0 && (
          <li className="p-4 text-sm font-medium text-rose-700">
            An order cannot be empty. Put something back, or cancel the order instead.
          </li>
        )}
      </ul>

      {adding ? (
        <div className="mb-4">
          <Field label="Which product?" hint="Search by name or SKU.">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="e.g. Multix"
            />
          </Field>
          <ul className="mt-2 grid gap-1.5">
            {matches.map((product) => (
              <li key={product.sku}>
                <button
                  type="button"
                  onClick={() => add(product)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {product.name}
                    </span>
                    <span className="block text-xs font-medium text-slate-500">
                      {product.packSize} · {product.available} available
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-slate-900 tabular-nums">
                    {formatTsh(product.priceTzs)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="quiet" full className="mt-2" onClick={() => setAdding(false)}>
            Never mind
          </Button>
        </div>
      ) : (
        <Button variant="secondary" icon="plus" full className="mb-4" disabled={pending} onClick={() => setAdding(true)}>
          Add another product
        </Button>
      )}

      {/* What changed, said back before anything is saved. */}
      {changes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-brand-200 bg-brand-50 p-3">
          <p className="text-sm font-black text-brand-900">What is changing</p>
          <ul className="mt-1 space-y-0.5">
            {changes.map((change) => (
              <li key={change} className="text-sm font-semibold text-brand-900">
                {change}
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-brand-200 pt-2 text-sm font-bold text-brand-900">
            New total about {formatTsh(estimate)}
            <span className="block text-xs font-medium text-brand-800">
              The shop works out the exact figure when you save.
            </span>
          </p>
        </div>
      )}

      <div className="mb-4">
        <Field label="Why is it changing?" hint="Goes on the order's record.">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={inputClass}
            placeholder="e.g. Customer called and wanted two more"
          />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onClose} full disabled={pending}>
          Leave it as it was
        </Button>
        <Button
          variant="accent"
          full
          disabled={!ready || pending}
          onClick={() =>
            onConfirm(
              lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
              reason,
            )
          }
        >
          {pending ? "Saving…" : "Save the change"}
        </Button>
      </div>
    </Sheet>
  );
}
