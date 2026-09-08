"use client";

import { useState } from "react";
import { Badge, Button, Field, PrimaryAction, Sheet, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, currentUser } from "@/lib/admin/permissions";
import {
  CANCELLATION_REASONS,
  DELIVERY_FAILURE_REASONS,
  NEXT_ACTION,
  STAGE_LABEL,
  type AdminOrder,
  type OrderStage,
} from "@/mocks/admin/data";

/**
 * The order's actions.
 *
 * One obvious next action, sized so it is the first thing a thumb finds. The
 * two ways an order can go wrong live below it, visibly secondary, and both
 * demand a reason before they will complete.
 *
 * Nothing here writes anything. The point of the prototype is that the *shape*
 * of the decision is right before a backend exists to make it real.
 */
export function OrderActions({ order }: { order: AdminOrder }) {
  const [stage, setStage] = useState<OrderStage>(order.stage);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const next = NEXT_ACTION[stage];
  const closed = stage === "completed" || stage === "cancelled" || stage === "delivery_failed";

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function advance() {
    if (!next) return;
    // Completing an order always asks for the payment first: an order must never
    // reach Completed without a record of what was actually collected.
    if (next.becomes === "completed") {
      setPayOpen(true);
      return;
    }
    setStage(next.becomes);
    announce(`${order.number} moved to ${STAGE_LABEL[next.becomes]}.`);
  }

  return (
    <>
      <div className="space-y-2.5">
        {next && can(currentUser.role, "orders.advance") ? (
          <PrimaryAction onClick={advance}>{next.label}</PrimaryAction>
        ) : (
          <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 text-sm font-bold text-slate-500">
            <Icon name="check" className="h-4 w-4" />
            {STAGE_LABEL[stage]} — nothing left to do
          </div>
        )}

        {!closed && can(currentUser.role, "orders.cancel") && (
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-slate-600 hover:text-slate-900">
              Something went wrong with this order
              <Icon name="chevronDown" className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
              <Button variant="secondary" icon="close" onClick={() => setCancelOpen(true)} full>
                Cancel order
              </Button>
              <Button variant="danger" icon="truck" onClick={() => setFailedOpen(true)} full>
                Delivery failed
              </Button>
            </div>
          </details>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-60 mx-auto max-w-sm rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white shadow-xl lg:bottom-6"
        >
          {toast}
        </div>
      )}

      <CancelSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          setStage("cancelled");
          setCancelOpen(false);
          announce(`${order.number} cancelled — ${reason.toLowerCase()}. Stock released.`);
        }}
      />

      <DeliveryFailedSheet
        open={failedOpen}
        onClose={() => setFailedOpen(false)}
        onConfirm={(reason, returned) => {
          setStage("delivery_failed");
          setFailedOpen(false);
          announce(
            returned
              ? `${order.number} marked delivery failed. Items returned — stock put back.`
              : `${order.number} marked delivery failed. Items not returned — stock written off.`,
          );
        }}
      />

      <PaymentSheet
        open={payOpen}
        order={order}
        onClose={() => setPayOpen(false)}
        onConfirm={(method) => {
          setStage("completed");
          setPayOpen(false);
          announce(`${order.number} completed. Payment recorded as ${method.toLowerCase()}.`);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------- sheets */

function CancelSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const needsNote = reason === "Other";

  return (
    <Sheet open={open} onClose={onClose} title="Cancel this order">
      <p className="mb-4 text-sm font-medium text-slate-600">
        The customer will not receive this order, and the stock goes back on the shelf. Tell us why,
        so the shop can see the pattern later.
      </p>

      <div className="mb-4 grid gap-2">
        {CANCELLATION_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setReason(option)}
            aria-pressed={reason === option}
            className={`flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left text-sm font-bold transition-colors ${
              reason === option
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option}
            {reason === option && <Icon name="check" className="h-4 w-4 text-brand-600" />}
          </button>
        ))}
      </div>

      {needsNote && (
        <div className="mb-4">
          <Field label="What happened?">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="A short note for the record"
            />
          </Field>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onClose} full>
          Keep the order
        </Button>
        <Button
          variant="danger"
          full
          disabled={!reason || (needsNote && note.trim().length === 0)}
          onClick={() => onConfirm(reason)}
        >
          Cancel order
        </Button>
      </div>
    </Sheet>
  );
}

function DeliveryFailedSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, returned: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState<boolean | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Delivery did not happen">
      <div className="mb-4 grid gap-2">
        <p className="text-sm font-bold text-slate-900">What went wrong?</p>
        {DELIVERY_FAILURE_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setReason(option)}
            aria-pressed={reason === option}
            className={`flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left text-sm font-bold transition-colors ${
              reason === option
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option}
            {reason === option && <Icon name="check" className="h-4 w-4 text-brand-600" />}
          </button>
        ))}
      </div>

      {/*
        The question that decides whether stock comes back. No default answer:
        guessing it wrong quietly loses or invents inventory.
      */}
      <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-black text-amber-900">Were the items returned to the shop?</p>
        <p className="mt-1 text-xs font-medium text-amber-800">
          This decides whether the stock goes back on the shelf.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setReturned(true)}
            aria-pressed={returned === true}
            className={`min-h-14 rounded-xl border-2 px-3 text-sm font-bold transition-colors ${
              returned === true ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-800"
            }`}
          >
            Yes, we have them
            <span className="mt-0.5 block text-[11px] font-semibold opacity-80">Stock goes back</span>
          </button>
          <button
            type="button"
            onClick={() => setReturned(false)}
            aria-pressed={returned === false}
            className={`min-h-14 rounded-xl border-2 px-3 text-sm font-bold transition-colors ${
              returned === false ? "border-rose-600 bg-rose-600 text-white" : "border-slate-300 bg-white text-slate-800"
            }`}
          >
            No, they are gone
            <span className="mt-0.5 block text-[11px] font-semibold opacity-80">Stock written off</span>
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onClose} full>
          Go back
        </Button>
        <Button
          variant="danger"
          full
          disabled={!reason || returned === null}
          onClick={() => onConfirm(reason, returned === true)}
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}

function PaymentSheet({
  open,
  order,
  onClose,
  onConfirm,
}: {
  open: boolean;
  order: AdminOrder;
  onClose: () => void;
  onConfirm: (method: string) => void;
}) {
  const [method, setMethod] = useState<"Cash" | "Digital" | "">("");
  const [reference, setReference] = useState("");
  const needsReference = method === "Digital";

  return (
    <Sheet open={open} onClose={onClose} title="Record the payment">
      <p className="mb-4 text-sm font-medium text-slate-600">
        The customer chose <span className="font-bold text-slate-900">{order.payment.preference}</span>.
        Record what was actually collected — an order cannot be completed without it.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["Cash", "Digital"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            aria-pressed={method === option}
            className={`min-h-14 rounded-xl border-2 text-sm font-bold transition-colors ${
              method === option
                ? "border-brand-600 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {needsReference && (
        <div className="mb-4">
          <Field label="Transaction reference" hint="Required for a digital payment, so it can be traced later.">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
              placeholder="e.g. M-Pesa QK4RT77J21"
              inputMode="text"
            />
          </Field>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onClose} full>
          Not yet
        </Button>
        <Button
          variant="accent"
          full
          disabled={!method || (needsReference && reference.trim().length === 0)}
          onClick={() => onConfirm(method)}
        >
          Complete order
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-500">
        <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Nothing is saved in this preview. <Badge tone="neutral" className="ml-1">Prototype</Badge>
      </p>
    </Sheet>
  );
}
