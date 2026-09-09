"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Field,
  SaveState,
  SectionTitle,
  Toggle,
  inputClass,
} from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, type Role } from "@/lib/admin/permissions";
import {
  addStockAction,
  countStockAction,
  saveProductAction,
  type ActionResult,
  type ProductPatch,
} from "@/lib/admin/actions";

import type { AdminProduct } from "@/lib/admin/model";

/**
 * The product editor.
 *
 * The six things an operator changes weekly — price, offer price, stock, show
 * on website, featured, best seller — are the whole first screen. Everything
 * else is behind "More product details", because a shopkeeper editing a price
 * should not have to scroll past a supplier field to find it.
 *
 * Stock is changed by *adding* or *counting*, never by typing over a number.
 * Both go through the ledger-backed database functions, so every movement
 * carries who, when, how many and why — and `on_hand` is never overwritten by
 * the screen.
 *
 * The SKU is read-only for the same reason it always was: past orders point at
 * it. There is no delete button; a product that is gone is archived.
 */

/** Why a counted number differs from the system's. The database insists on one. */
const COUNT_REASONS = [
  "Stock take",
  "Damaged or expired items removed",
  "Found extra stock",
  "Correcting an earlier mistake",
];

export function ProductEditor({ product, role }: { product: AdminProduct; role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const editPricing = can(role, "products.editPricing");
  const editStock = can(role, "products.editStock");
  const editVisibility = can(role, "products.editVisibility");

  const [price, setPrice] = useState(String(product.price));
  const [offerPrice, setOfferPrice] = useState(product.offerPrice ? String(product.offerPrice) : "");
  const [visible, setVisible] = useState(product.visible);
  const [featured, setFeatured] = useState(product.featured);
  const [bestSeller, setBestSeller] = useState(product.bestSeller);
  const [lifecycle, setLifecycle] = useState(product.lifecycle);

  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const [stockOpen, setStockOpen] = useState(false);
  const [stockAmount, setStockAmount] = useState("");
  const [stockMode, setStockMode] = useState<"add" | "count">("add");
  const [stockNote, setStockNote] = useState("");
  const [countReason, setCountReason] = useState("");

  const offerInvalid = offerPrice !== "" && Number(offerPrice) >= Number(price);

  /**
   * One shape for every write: ask the server, show what it said, and refresh
   * so the numbers on screen come back from the database rather than from the
   * guess this component just made.
   */
  function run(operation: () => Promise<ActionResult>, onDone?: () => void) {
    setSave("saving");
    setProblem(null);
    startTransition(async () => {
      const result = await operation();
      if (result.ok) {
        setSave("saved");
        onDone?.();
        router.refresh();
        window.setTimeout(() => setSave("idle"), 3000);
      } else {
        setSave("failed");
        setProblem(result.message);
      }
    });
  }

  /**
   * Everything on the everyday card is saved as one patch. The alternative —
   * a save per field — could leave a price written and a visibility toggle not,
   * which is exactly the half-applied state the operator cannot see.
   */
  function saveEveryday(overrides: Partial<ProductPatch> = {}) {
    if (offerInvalid) {
      setSave("failed");
      setProblem("The offer price must be lower than the price.");
      return;
    }
    const patch: ProductPatch = {
      priceTzs: Number(price) || 0,
      offerPriceTzs: offerPrice === "" ? null : Number(offerPrice),
      storefrontVisible: visible,
      featured,
      bestSeller,
      lifecycle: lifecycle as ProductPatch["lifecycle"],
      ...overrides,
    };
    run(() => saveProductAction(product.id, patch));
  }

  function applyStock() {
    const n = Number(stockAmount);
    if (!Number.isFinite(n) || n < 0) return;

    if (stockMode === "add") {
      run(() => addStockAction(product.id, n, stockNote.trim() || "Added in the dashboard"), reset);
    } else {
      const reason = [countReason, stockNote.trim()].filter(Boolean).join(" — ");
      run(() => countStockAction(product.id, n, reason), reset);
    }

    function reset() {
      setStockAmount("");
      setStockNote("");
      setCountReason("");
      setStockOpen(false);
    }
  }

  const canApplyStock =
    stockAmount !== "" && !pending && (stockMode === "add" || countReason !== "");

  return (
    <>
      {/* Identity */}
      <Card className="mb-5 flex items-center gap-4 p-4">
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {product.image ? (
            <Image
              src={product.image.src}
              alt={product.name}
              fill
              sizes="80px"
              className="object-contain"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-300">
              <Icon name="package" className="h-6 w-6" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-slate-900">{product.name}</p>
          <p className="text-sm font-medium text-slate-500">
            {product.brandName} · {product.packSize}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Icon name="shield" className="h-3 w-3" />
            {product.sku} · cannot be changed
          </p>
        </div>
      </Card>

      {/* Everyday controls */}
      <SectionTitle action={<SaveState state={save} />}>Everyday settings</SectionTitle>
      <Card className="mb-5 space-y-4 p-4">
        {problem && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">
            {problem}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price" hint="What the customer pays.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">
                TSh
              </span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => price !== String(product.price) && saveEveryday()}
                disabled={!editPricing || pending}
                inputMode="numeric"
                className={`${inputClass} pl-12 tabular-nums`}
              />
            </div>
          </Field>

          <Field
            label="Offer price"
            hint={offerInvalid ? "The offer price must be lower than the price." : "Leave empty for no offer."}
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">
                TSh
              </span>
              <input
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() =>
                  offerPrice !== (product.offerPrice ? String(product.offerPrice) : "") && saveEveryday()
                }
                disabled={!editPricing || pending}
                inputMode="numeric"
                placeholder="—"
                className={`${inputClass} pl-12 tabular-nums ${offerInvalid ? "border-rose-400" : ""}`}
              />
            </div>
          </Field>
        </div>

        {/* Stock is an action, not a text box. */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Available stock</p>
              <p className="font-display text-2xl font-black text-slate-900 tabular-nums">
                {product.available}
              </p>
              {product.reserved > 0 && (
                <p className="text-xs font-semibold text-slate-500 tabular-nums">
                  {product.stock} on the shelf · {product.reserved} set aside for orders
                </p>
              )}
            </div>
            {editStock && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setStockMode("add");
                    setStockOpen(true);
                  }}
                >
                  Add stock
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setStockMode("count");
                    setStockOpen(true);
                  }}
                >
                  Set counted stock
                </Button>
              </div>
            )}
          </div>

          {stockOpen && (
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              <Field
                label={stockMode === "add" ? "How many are you adding?" : "How many did you count?"}
                hint={
                  stockMode === "add"
                    ? "This is added to what is already here."
                    : "This replaces the number above with what is actually on the shelf."
                }
              >
                <input
                  autoFocus
                  value={stockAmount}
                  onChange={(e) => setStockAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className={`${inputClass} tabular-nums`}
                />
              </Field>

              {/*
                A count has to say why it differs — otherwise a missing item and
                a mistyped number look identical a month later. Tap, don't type.
              */}
              {stockMode === "count" && (
                <div>
                  <p className="mb-1.5 text-sm font-bold text-slate-900">Why is it different?</p>
                  <div className="grid gap-2">
                    {COUNT_REASONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCountReason(option)}
                        aria-pressed={countReason === option}
                        className={`flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left text-sm font-bold transition-colors ${
                          countReason === option
                            ? "border-brand-500 bg-brand-50 text-brand-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {option}
                        {countReason === option && <Icon name="check" className="h-4 w-4 text-brand-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Field
                label={stockMode === "add" ? "Delivery note or invoice number" : "Anything to add?"}
                hint="Optional. Kept with the stock record."
              >
                <input
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  className={inputClass}
                  placeholder={stockMode === "add" ? "e.g. INV-4821" : "e.g. two bottles leaked"}
                />
              </Field>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => setStockOpen(false)} full>
                  Cancel
                </Button>
                <Button variant="accent" onClick={applyStock} disabled={!canApplyStock} full>
                  {pending ? "Working…" : stockMode === "add" ? "Add to stock" : "Save count"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Toggle
            label="Show on website"
            hint={visible ? "Customers can see and buy this." : "Hidden from the shop."}
            checked={visible}
            disabled={!editVisibility || pending}
            onChange={(v) => {
              setVisible(v);
              saveEveryday({ storefrontVisible: v });
            }}
          />
          <Toggle
            label="Featured"
            hint="Highlighted on the homepage."
            checked={featured}
            disabled={!editVisibility || pending}
            onChange={(v) => {
              setFeatured(v);
              saveEveryday({ featured: v });
            }}
          />
          <Toggle
            label="Best seller"
            hint="Shown in the Best sellers row."
            checked={bestSeller}
            disabled={!editVisibility || pending}
            onChange={(v) => {
              setBestSeller(v);
              saveEveryday({ bestSeller: v });
            }}
          />
        </div>

        {/*
          Where the truth is, stated plainly. There is no Google Sheet write-back
          yet, so the screen says so rather than showing a reassuring "Synced".
        */}
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
          <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          Saved straight to the shop, and the website updates immediately. Product sheet sync: not
          connected yet.
        </p>
      </Card>

      {/* Everything else, folded away */}
      <details className="group mb-5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 font-display text-sm font-bold text-slate-700">
          More product details
          <Icon name="chevronDown" className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <Card className="mt-2 space-y-4 p-4">
          <p className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
            These come from the product sheet and are read-only here. They become editable when
            sheet syncing is switched on.
          </p>

          <Field label="Product name">
            <input defaultValue={product.name} className={inputClass} readOnly />
          </Field>
          <Field label="Description" hint="The product sheet has no description for this product yet.">
            <textarea
              defaultValue={product.description}
              rows={3}
              placeholder="No description yet"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base font-semibold placeholder:font-medium placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
              readOnly
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <input defaultValue={product.brandName ?? ""} className={inputClass} readOnly />
            </Field>
            <Field label="Size">
              <input defaultValue={product.packSize} className={inputClass} readOnly />
            </Field>
            <Field label="Category">
              <input defaultValue={product.categoryName} className={inputClass} readOnly />
            </Field>
            <Field label="Low stock warning at">
              <input defaultValue={String(product.lowStockThreshold)} className={`${inputClass} tabular-nums`} readOnly />
            </Field>
          </div>
          <Field label="SKU" locked hint="The SKU never changes once a product has been ordered.">
            <input defaultValue={product.sku} className={inputClass} readOnly disabled />
          </Field>
          <Field label="Web address" hint="Used in the product link customers share.">
            <input defaultValue={`/product/${product.slug}`} className={inputClass} readOnly />
          </Field>
        </Card>
      </details>

      {/* No delete: products are archived, never destroyed. */}
      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">Retiring a product</p>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Products are never deleted, because past orders refer to them. Switch off{" "}
          <span className="font-bold text-slate-700">Show on website</span> to take one off the shop,
          or archive it when it is gone for good.
        </p>
        <div className="mt-3">
          {lifecycle === "archived" ? (
            <Button
              variant="secondary"
              icon="package"
              disabled={!editVisibility || pending}
              onClick={() => {
                setLifecycle("active");
                saveEveryday({ lifecycle: "active" });
              }}
            >
              Bring back from the archive
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon="package"
              disabled={!editVisibility || pending}
              onClick={() => {
                // Archiving also takes it off the shop: an archived product that
                // is still buyable is a contradiction the customer would find.
                setLifecycle("archived");
                setVisible(false);
                saveEveryday({ lifecycle: "archived", storefrontVisible: false });
              }}
            >
              Archive product
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}
