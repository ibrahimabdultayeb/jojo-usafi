"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useRole } from "@/components/admin/RoleContext";
import { StatusPill } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import {
  CANCELLATION_REASONS,
  canCancel,
  canMarkDeliveryFailed,
  nextAction,
  orderStatusHint,
  paymentIsComplete,
} from "@/lib/admin/orders";
import type { CancellationReason, Order, OrderStatus, PaymentMethod } from "@/lib/admin/types";
import { formatPrice } from "@/lib/format";

/**
 * The one thing a member of staff does to an order.
 *
 * CONFIRMED RULES, all enforced here:
 *   - No status dropdown. One primary action, named for what it does.
 *   - No raw status values on screen, ever.
 *   - An order cannot be completed until a payment is recorded, and a digital
 *     payment cannot be recorded without a transaction reference.
 *   - Cancelling requires a reason, and never competes visually with the
 *     primary action.
 *   - After a failed delivery, "Were the items returned?" has NO default. The
 *     future backend uses that answer to decide whether stock goes back, so a
 *     pre-selected answer would silently corrupt inventory.
 *
 * PROTOTYPE: acting updates this screen only. Nothing is saved anywhere.
 */
export function NextActionPanel({ order }: { order: Order }) {
  const { allows } = useRole();

  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [payment, setPayment] = useState(order.recordedPayment);
  const [cancelReason, setCancelReason] = useState<CancellationReason | null>(
    order.cancellationReason ?? null,
  );
  const [itemsReturned, setItemsReturned] = useState<boolean | null>(order.itemsReturned);
  const [changed, setChanged] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);

  // Payment dialog state.
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState("");

  // Failed-delivery dialog state — deliberately starts with no answer chosen.
  const [returnedAnswer, setReturnedAnswer] = useState<boolean | null>(null);

  const working: Order = { ...order, status, recordedPayment: payment };
  const action = nextAction(working);
  const canAdvance = allows("orders.advance");

  function advance() {
    if (!action) return;
    if (action.requiresPayment) {
      setMethod(null);
      setReference("");
      setPaymentOpen(true);
      return;
    }
    setStatus(action.to);
    setChanged(true);
  }

  function confirmPayment() {
    if (!paymentIsComplete(method, reference) || !action) return;
    setPayment({
      method: method as PaymentMethod,
      reference: method === "digital" ? reference.trim() : undefined,
      recordedAt: "Just now",
    });
    setStatus(action.to);
    setChanged(true);
    setPaymentOpen(false);
  }

  function confirmCancel() {
    if (!cancelReason) return;
    setStatus("cancelled");
    setChanged(true);
    setCancelOpen(false);
  }

  function confirmFailed() {
    if (returnedAnswer === null) return;
    setItemsReturned(returnedAnswer);
    setStatus("delivery_failed");
    setChanged(true);
    setFailedOpen(false);
  }

  const paymentReady = paymentIsComplete(method, reference);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-slate-900">What happens next</h2>
        <StatusPill status={status} />
      </div>
      <p className="mt-1.5 text-sm font-medium text-slate-500">{orderStatusHint(status)}</p>

      {changed && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          Prototype only — this change is not saved anywhere. There is no order backend yet.
        </p>
      )}

      {action ? (
        <>
          <button
            type="button"
            onClick={advance}
            disabled={!canAdvance}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {action.label}
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>
          <p className="mt-2 text-center text-xs font-medium text-slate-500">
            {action.explanation}
          </p>
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" />
          Nothing more to do on this order.
        </p>
      )}

      {status === "delivery_failed" && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          Items returned to the shop:{" "}
          <span className="font-black text-slate-900">
            {itemsReturned === null ? "Not answered yet" : itemsReturned ? "Yes" : "No"}
          </span>
        </p>
      )}

      {status === "cancelled" && cancelReason && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          Cancelled because:{" "}
          <span className="font-black text-slate-900">
            {CANCELLATION_REASONS.find((r) => r.value === cancelReason)?.label}
          </span>
        </p>
      )}

      {/* Secondary actions. Quiet on purpose — they must never compete with the
          primary next action above. */}
      {(canMarkDeliveryFailed(working) || canCancel(working)) && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {canMarkDeliveryFailed(working) && allows("orders.markDeliveryFailed") && (
            <button
              type="button"
              onClick={() => {
                setReturnedAnswer(null);
                setFailedOpen(true);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="alert" className="h-4 w-4" />
              Mark Delivery Failed
            </button>
          )}
          {canCancel(working) && allows("orders.cancel") && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
            >
              Cancel Order
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------ payment gate --- */}
      <AdminDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Record the payment"
        description={`This order cannot be completed until the payment is recorded. Total ${formatPrice(order.total)}.`}
        footer={
          <>
            <button
              type="button"
              onClick={confirmPayment}
              disabled={!paymentReady}
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
            >
              Complete Order
            </button>
            {!paymentReady && (
              <p className="text-center text-xs font-semibold text-slate-500">
                {method === null
                  ? "Choose how the customer paid."
                  : "Enter the transaction reference to continue."}
              </p>
            )}
          </>
        }
      >
        <p className="mb-3 text-sm font-bold text-slate-900">How did the customer pay?</p>
        <div className="grid grid-cols-2 gap-3">
          {(["cash", "digital"] as PaymentMethod[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMethod(option)}
              aria-pressed={method === option}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 font-display text-base font-bold transition-colors ${
                method === option
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <Icon name={option === "cash" ? "banknote" : "phone"} className="h-5 w-5" />
              {option === "cash" ? "Cash" : "Digital"}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500">
          The customer said they would pay by{" "}
          <span className="font-bold text-slate-700">
            {order.paymentPreference === "cash" ? "cash" : "mobile money or card"}
          </span>
          . Record what actually happened.
        </p>

        {method === "digital" && (
          <div className="mt-4">
            <label
              htmlFor="payment-reference"
              className="mb-1.5 block text-sm font-bold text-slate-900"
            >
              Transaction reference
            </label>
            <input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="e.g. MPESA-8F42QK71"
              className="min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
            <p className="mt-1.5 text-xs font-medium text-slate-500">
              Required for digital payments, so the money can be matched later.
            </p>
          </div>
        )}
      </AdminDialog>

      {/* ------------------------------------------------- cancellation --- */}
      <AdminDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order"
        description="Tell us why. This order will not be delivered."
        footer={
          <>
            <button
              type="button"
              onClick={confirmCancel}
              disabled={!cancelReason}
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-rose-600 px-6 font-display text-base font-bold text-white transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-40"
            >
              Cancel Order
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold text-slate-600 hover:text-slate-900"
            >
              Keep the order
            </button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-slate-900">Reason</legend>
          <div className="space-y-2">
            {CANCELLATION_REASONS.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => setCancelReason(reason.value)}
                aria-pressed={cancelReason === reason.value}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left text-sm font-bold transition-colors ${
                  cancelReason === reason.value
                    ? "border-rose-500 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {reason.label}
                {cancelReason === reason.value && <Icon name="check" className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </fieldset>
      </AdminDialog>

      {/* --------------------------------------------- delivery failed --- */}
      <AdminDialog
        open={failedOpen}
        onClose={() => setFailedOpen(false)}
        title="Delivery failed"
        description="The rider could not hand the order over."
        footer={
          <>
            <button
              type="button"
              onClick={confirmFailed}
              disabled={returnedAnswer === null}
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
            >
              Save
            </button>
            {returnedAnswer === null && (
              <p className="text-center text-xs font-semibold text-slate-500">
                Answer the question above to continue.
              </p>
            )}
          </>
        }
      >
        <fieldset>
          <legend className="text-base font-bold text-slate-900">
            Were the items returned to the shop?
          </legend>
          <p className="mt-1.5 mb-4 text-sm font-medium text-slate-500">
            Answer carefully. This decides whether the stock goes back on the shelf.
          </p>

          {/* NEITHER option is preselected, and neither is styled as the
              expected answer. The two buttons are deliberately identical. */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setReturnedAnswer(option.value)}
                aria-pressed={returnedAnswer === option.value}
                className={`flex min-h-16 items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition-colors ${
                  returnedAnswer === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </AdminDialog>
    </section>
  );
}
