"use client";

import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useRole } from "@/components/admin/RoleContext";
import { Card, Chip, DetailRow, SectionTitle, SyncBadge } from "@/components/admin/ui";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Icon } from "@/components/ui/Icon";
import { blockReasonLabel, type AdminProduct } from "@/lib/admin/queries";
import type { ProductAdminStatus, SyncState } from "@/lib/admin/types";
import { productName } from "@/lib/catalogue/queries";
import { site } from "@/lib/site";

/**
 * The product editor.
 *
 * Everyday things first — price, stock, whether customers can see it. Everything
 * else is behind "More product details", because a member of staff changing a
 * price at 7am should not have to walk past a supplier field to reach it.
 *
 * RULES:
 *   - The item code is shown but never editable. Orders already reference it.
 *   - Stock is never a free-text overwrite. You either add what arrived, or
 *     record what you counted — two different facts the future backend has to
 *     tell apart.
 *   - There is no delete. Products are Active, Hidden or Archived, so history
 *     and past orders keep their meaning.
 *
 * PROTOTYPE: nothing is saved. There is no backend.
 */

type StockDialog = "none" | "add" | "count";

export function ProductEditor({ entry }: { entry: AdminProduct }) {
  const { product, stock } = entry;
  const { allows } = useRole();
  const canEdit = allows("products.editEveryday");
  const canStock = allows("products.adjustStock");
  const canLifecycle = allows("products.changeLifecycle");

  const [price, setPrice] = useState(String(product.price));
  const [offerPrice, setOfferPrice] = useState("");
  const [available, setAvailable] = useState(stock.available);
  const [onWebsite, setOnWebsite] = useState(product.publishable);
  const [featured, setFeatured] = useState(product.featured);
  const [bestSeller, setBestSeller] = useState(product.bestSeller);
  const [lifecycle, setLifecycle] = useState<ProductAdminStatus>(entry.lifecycle);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [stockDialog, setStockDialog] = useState<StockDialog>("none");
  const [stockInput, setStockInput] = useState("");

  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [saved, setSaved] = useState(false);

  const stockNumber = Number(stockInput);
  const stockValid = stockInput.trim() !== "" && Number.isFinite(stockNumber) && stockNumber >= 0;

  function applyStock() {
    if (!stockValid) return;
    setAvailable(stockDialog === "add" ? available + stockNumber : stockNumber);
    setStockDialog("none");
    setStockInput("");
    setSyncState("pending");
    setSaved(false);
  }

  function save() {
    setSyncState("syncing");
    setSaved(true);
    // A prototype cannot really sync. Land on "pending" so the screen never
    // claims a change reached the Google Sheet.
    window.setTimeout(() => setSyncState("pending"), 700);
  }

  const field =
    "min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60";
  const label = "mb-1.5 block text-sm font-bold text-slate-900";

  return (
    <div className="space-y-4">
      {/* Identity — read only. */}
      <Card>
        <div className="flex gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {product.image ? (
              <ProductPhoto
                product={product}
                alt={`${productName(product)} ${product.packSize}`}
                size="thumb"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                <Icon name="image" className="h-7 w-7" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-widest text-brand-700 uppercase">
              {entry.brandName}
            </p>
            <h2 className="font-display text-lg leading-tight font-bold text-slate-900">
              {productName(product)}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">{product.packSize}</p>

            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5">
              <Icon name="tag" className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="font-mono text-sm font-bold text-slate-900">{product.sku}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <Icon name="shield" className="h-3.5 w-3.5" />
                Locked
              </span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-500">
              The item code can never be changed. Past orders use it.
            </p>
          </div>
        </div>

        {!entry.onWebsite && entry.blockReasons.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Customers cannot see this product:{" "}
              {entry.blockReasons.map(blockReasonLabel).join(" · ")}.
              {entry.blockReasons.includes("price_needs_checking") &&
                " The price looks wrong and has been left exactly as it is in the Product Master."}
            </span>
          </p>
        )}
      </Card>

      {/* Everyday controls. */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>Everyday</SectionTitle>
          <SyncBadge state={syncState} />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="price" className={label}>
              Price ({site.currency})
            </label>
            <input
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!canEdit}
              inputMode="numeric"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="offer-price" className={label}>
              Offer price ({site.currency})
            </label>
            <input
              id="offer-price"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              disabled={!canEdit}
              inputMode="numeric"
              placeholder="Leave empty for no offer"
              className={field}
            />
          </div>

          {/* Stock is a fact you record, not a box you overwrite. */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">Available stock</p>
            <p className="mt-1 font-display text-3xl font-black text-slate-900">{available}</p>
            {stock.source === "demo" && (
              <p className="mt-1">
                <Chip tone="warn" icon="alert">Sample stock figure</Chip>
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canStock}
                onClick={() => {
                  setStockDialog("add");
                  setStockInput("");
                }}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-40"
              >
                <Icon name="plus" className="h-4 w-4" />
                Add Stock
              </button>
              <button
                type="button"
                disabled={!canStock}
                onClick={() => {
                  setStockDialog("count");
                  setStockInput("");
                }}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
              >
                <Icon name="clipboard" className="h-4 w-4" />
                Count Stock
              </button>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Use <span className="font-bold">Add Stock</span> when new stock arrives. Use{" "}
              <span className="font-bold">Count Stock</span> after counting the shelf.
            </p>
          </div>

          <Toggle
            id="on-website"
            label="Show on the website"
            hint="Customers can find and buy this product."
            checked={onWebsite}
            disabled={!canEdit || !product.publishable}
            onChange={setOnWebsite}
            note={
              !product.publishable
                ? "Cannot be shown yet — see the warning above."
                : undefined
            }
          />
          <Toggle
            id="featured"
            label="Featured"
            hint="Appears in the featured row on the homepage."
            checked={featured}
            disabled={!canEdit}
            onChange={setFeatured}
          />
          <Toggle
            id="best-seller"
            label="Best seller"
            hint="Appears in the best sellers row on the homepage."
            checked={bestSeller}
            disabled={!canEdit}
            onChange={setBestSeller}
          />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!canEdit}
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
        >
          Save Changes
        </button>

        {saved && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed font-semibold text-amber-900">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            Prototype only — nothing was saved. There is no database and no Google Sheet
            connection yet.
          </p>
        )}
      </Card>

      {/* Secondary details. */}
      <Card>
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="font-display text-base font-bold text-slate-900">
            More product details
          </span>
          <Icon
            name="chevronDown"
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
              detailsOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {detailsOpen && (
          <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1">
            <DetailRow label="Product name">{productName(product)}</DetailRow>
            <DetailRow label="Description">
              {product.description || (
                <span className="font-semibold text-slate-400">Not written yet</span>
              )}
            </DetailRow>
            <DetailRow label="Category">{entry.categoryName}</DetailRow>
            <DetailRow label="Brand">{entry.brandName}</DetailRow>
            <DetailRow label="Size">{product.packSize}</DetailRow>
            <DetailRow label="Barcode">
              {product.barcode || <span className="font-semibold text-slate-400">None</span>}
            </DetailRow>
            <DetailRow label="Photo">
              {product.image ? "Approved photo in use" : "No approved photo"}
            </DetailRow>
            <DetailRow label="Supplied by">EcoPlus Brands</DetailRow>
            <DetailRow label="Web address">
              <span className="font-mono text-xs break-all">/product/{product.slug}</span>
            </DetailRow>
          </dl>
        )}
      </Card>

      {/* Lifecycle — no delete anywhere. */}
      <Card>
        <SectionTitle>Product status</SectionTitle>
        <p className="mb-3 text-sm font-medium text-slate-500">
          Products are never deleted, so past orders keep their meaning.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              { value: "active", label: "Active", hint: "Selling normally" },
              { value: "hidden", label: "Hidden", hint: "Kept, but off the website" },
              { value: "archived", label: "Archived", hint: "No longer stocked" },
            ] as { value: ProductAdminStatus; label: string; hint: string }[]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!canLifecycle}
              onClick={() => setLifecycle(option.value)}
              aria-pressed={lifecycle === option.value}
              className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left transition-colors disabled:opacity-50 ${
                lifecycle === option.value
                  ? "border-brand-600 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="font-display text-sm font-bold text-slate-900">{option.label}</span>
              <span className="text-xs font-semibold text-slate-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------ stock dialogs --- */}
      <AdminDialog
        open={stockDialog !== "none"}
        onClose={() => setStockDialog("none")}
        title={stockDialog === "add" ? "Add stock" : "Count stock"}
        description={
          stockDialog === "add"
            ? "How many arrived? This is added to what is already on the shelf."
            : "How many did you count on the shelf? This replaces the current figure."
        }
        footer={
          <button
            type="button"
            onClick={applyStock}
            disabled={!stockValid}
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {stockDialog === "add" ? "Add to stock" : "Save the count"}
          </button>
        }
      >
        <label htmlFor="stock-input" className={label}>
          {stockDialog === "add" ? "Quantity received" : "Counted quantity"}
        </label>
        <input
          id="stock-input"
          value={stockInput}
          onChange={(e) => setStockInput(e.target.value)}
          autoFocus
          inputMode="numeric"
          placeholder="0"
          className={field}
        />
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          Now: <span className="font-black text-slate-900">{available}</span>
          {stockValid && (
            <>
              {" → After: "}
              <span className="font-black text-slate-900">
                {stockDialog === "add" ? available + stockNumber : stockNumber}
              </span>
            </>
          )}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Adding stock and correcting a count are different things, and are kept apart so the
          shop can tell later what actually happened.
        </p>
      </AdminDialog>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onChange,
  note,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  note?: string;
}) {
  return (
    <div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 disabled:hover:bg-white"
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
      {note && <p className="mt-1.5 px-1 text-xs font-semibold text-amber-700">{note}</p>}
    </div>
  );
}
