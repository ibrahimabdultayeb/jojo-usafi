"use client";

import { useState, useTransition, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button, Field, PrimaryAction, Sheet, useSheetPresence, inputClass } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { formatTsh } from "@/lib/admin/format";
import { can, type Role } from "@/lib/admin/permissions";
import {
  advanceOrderAction,
  amendOrderAction,
  cancelOrderAction,
  completeOrderAction,
  failDeliveryAction,
  type ActionResult,
} from "@/lib/admin/actions";
import { AmendSheet, type AmendableProduct } from "@/components/admin/orders/AmendSheet";
import {
  CANCELLATION_REASONS,
  DELIVERY_FAILURE_REASONS,
  NEXT_ACTION,
  orderTotals,
  type AdminOrder,
  type OrderStage,
} from "@/lib/admin/model";

/**
 * The order's actions.
 *
 * One obvious next action, sized so it is the first thing a thumb finds. The
 * two ways an order can go wrong live below it, visibly secondary, and both
 * demand a reason before they will complete.
 *
 * Every button here calls a tested server operation. None of them computes
 * anything: reservation maths, transition legality and the payment rules live
 * in the database, so the screen cannot disagree with the shop.
 */
/**
 * The four stages during which what is in the box is still a decision rather
 * than a physical fact. Repeated from `jojo_amend_order`, which refuses every
 * other stage regardless — this list decides what the screen OFFERS, never
 * what is allowed.
 */
const AMENDABLE: readonly OrderStage[] = ["new", "awaiting_confirmation", "confirmed", "preparing"];

export function OrderActions({
  order,
  role,
  catalogue = [],
  details,
  sidebar,
}: {
  order: AdminOrder;
  role: Role;
  catalogue?: readonly AmendableProduct[];
  details?: ReactNode;
  sidebar?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const cancelPresent = useSheetPresence(cancelOpen);
  const failedPresent = useSheetPresence(failedOpen);
  const payPresent = useSheetPresence(payOpen);
  const amendPresent = useSheetPresence(amendOpen);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);

  // The stage comes from the server on every render. Keeping a local copy would
  // mean the screen could disagree with the database about what happened, which
  // is exactly the disagreement these operations exist to prevent.
  const stage: OrderStage = order.stage;
  const writtenOff = stage === "delivery_failed" && order.stockReservationReleased;
  const next = writtenOff ? undefined : NEXT_ACTION[stage];
  const mayCancel = stage !== "completed" && stage !== "cancelled" && stage !== "out_for_delivery";
  const mayFailDelivery = stage === "out_for_delivery";
  const mayAmend = AMENDABLE.includes(stage) && can(role, "orders.advance");

  function announce(message: string, bad = false) {
    setToast({ text: message, bad });
    window.setTimeout(() => setToast(null), 4200);
  }

  /**
   * Every operation goes the same way: ask the server, show what it said, and
   * refresh so the page redraws from the database rather than from a guess.
   * The database decides whether the move was legal — this never asks twice.
   */
  function run(operation: () => Promise<ActionResult>, onDone?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await operation();
        if (result.ok) { announce(result.message); onDone?.(); router.refresh(); }
        else { setError(result.message); announce(result.message, true); }
      } catch { setError("Could not save the change. Check your connection and try again."); }
      finally { inFlight.current = false; }
    });
  }

  function advance() {
    if (!next) return;
    // Completing always asks for the payment first: an order must never reach
    // Completed without a record of what was actually collected.
    if (next.becomes === "completed") {
      setError(null);
      setPayOpen(true);
      return;
    }
    run(() => advanceOrderAction(order.id, next.becomes));
  }

  return (
    <>
      <div className="admin-detail-grid">
        <div className="admin-stack">
          {next && can(role, "orders.advance") && <section className="admin-card admin-next-step">
            <p className="admin-eyebrow">NEXT STEP</p>
            <div><p>{stage === "new" || stage === "awaiting_confirmation" ? "Contact the customer and confirm the items, address and total before proceeding." : stage === "confirmed" ? "Pick the items and check the quantities before packing the order." : stage === "preparing" ? "Check the packed items and delivery address, then hand the order to the rider." : "Confirm delivery and record the payment actually collected."}</p>
            <PrimaryAction busy={pending} onClick={advance} disabled={pending}>{pending ? "Working…" : next.label}</PrimaryAction></div>
            {error && !payOpen && !amendOpen && !cancelOpen && !failedOpen && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
          </section>}
          {writtenOff && <p className="admin-exception">The items were written off. Cancel this order before arranging a replacement.</p>}
          {details}
        </div>
        <div className="admin-stack">
          {sidebar}
          {(mayAmend || mayCancel || mayFailDelivery) && <section className="admin-card p-4"><p className="admin-eyebrow">OTHER ACTIONS</p><div className="flex flex-col gap-2">
            {stage === "new" && can(role,"orders.advance") && <Button busy={pending} variant="quiet" icon="clock" disabled={pending} onClick={()=>run(()=>advanceOrderAction(order.id,"awaiting_confirmation"))}>Await customer confirmation</Button>}
            {mayAmend && <Button variant="quiet" icon="pencil" disabled={pending} onClick={()=>{setError(null);setAmendOpen(true);}}>Amend items</Button>}
            {mayCancel && can(role,"orders.cancel") && <Button variant="danger" icon="close" disabled={pending} onClick={()=>{setError(null);setCancelOpen(true);}}>Cancel order</Button>}
            {mayFailDelivery && can(role,"orders.cancel") && <Button variant="danger" icon="truck" disabled={pending} onClick={()=>{setError(null);setFailedOpen(true);}}>Delivery failed</Button>}
          </div></section>}
        </div>
      </div>

      {toast && createPortal(
        <div
          role="status"
          className={`fixed inset-x-4 bottom-24 z-70 mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-bold text-white shadow-xl lg:bottom-6 ${
            toast.bad ? "bg-rose-700" : "bg-slate-900"
          }`}
        >
          {toast.text}
        </div>, document.body
      )}

      {cancelPresent && <CancelSheet
        open={cancelOpen}
        pending={pending}
        error={error}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => run(() => cancelOrderAction(order.id, reason), () => setCancelOpen(false))}
      />}

      {failedPresent && <DeliveryFailedSheet
        open={failedOpen}
        pending={pending}
        error={error}
        onClose={() => setFailedOpen(false)}
        onConfirm={(reason, returned) =>
          run(() => failDeliveryAction(order.id, returned, reason), () => setFailedOpen(false))
        }
      />}

      {/*
        Unmounted after its exit finishes, so every amendment starts from what the
        order says NOW. A sheet that stayed mounted would reopen showing the
        draft from the last time somebody changed their mind.
      */}
      {mayAmend && amendPresent && (
        <AmendSheet
          open={amendOpen}
          order={order}
          catalogue={catalogue}
          pending={pending}
          error={error}
          onClose={() => setAmendOpen(false)}
          onConfirm={(lines, reason) =>
            run(() => amendOrderAction(order.id, lines, reason), () => setAmendOpen(false))
          }
        />
      )}

      {payPresent && <PaymentSheet
        open={payOpen}
        pending={pending}
        error={error}
        order={order}
        onClose={() => setPayOpen(false)}
        onConfirm={(method, reference) =>
          run(
            () => completeOrderAction(order.id, method === "Digital" ? "digital" : "cash", reference),
            () => setPayOpen(false),
          )
        }
      />}
    </>
  );
}

/* -------------------------------------------------------------- sheets */

function CancelSheet({
  open,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const needsNote = reason === "Other";

  return (
    <Sheet open={open} onClose={onClose} busy={pending} error={error} title="Cancel this order">
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
          busy={pending}
          onClick={() => onConfirm(needsNote ? `${reason}: ${note.trim()}` : reason)}
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
  pending,
  error,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string, returned: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState<boolean | null>(null);

  return (
    <Sheet open={open} onClose={onClose} busy={pending} error={error} title="Delivery did not happen">
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
          busy={pending}
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
  pending,
  error,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  order: AdminOrder;
  onClose: () => void;
  onConfirm: (method: string, reference: string) => void;
}) {
  const [method, setMethod] = useState<"Cash" | "Digital" | "">("");
  const [reference, setReference] = useState("");
  const needsReference = method === "Digital";

  return (
    <Sheet open={open} onClose={onClose} busy={pending} error={error} title="Record payment & complete">
      <div className="admin-payment-amount"><span>Amount to collect</span><strong>{formatTsh(orderTotals(order).total)}</strong></div>
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
          busy={pending}
          onClick={() => onConfirm(method, reference.trim())}
        >
          Complete order
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-500">
        <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Completing the order also takes these items out of stock. It cannot be undone from here.
      </p>
    </Sheet>
  );
}
