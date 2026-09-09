"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  SaveState,
  SectionTitle,
  Toggle,
  inputClass,
} from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { can, currentUser } from "@/lib/admin/permissions";

import type { AdminProduct } from "@/mocks/admin/data";

/**
 * The product editor.
 *
 * The six things an operator changes weekly — price, offer price, stock, show
 * on website, featured, best seller — are the whole first screen. Everything
 * else is behind "More product details", because a shopkeeper editing a price
 * should not have to scroll past a supplier field to find it.
 *
 * Stock is changed by *adding* or *counting*, never by typing over a number:
 * that is what makes a mistake traceable once the stock ledger is real.
 */
export function ProductEditor({ product }: { product: AdminProduct }) {
  const editPricing = can(currentUser.role, "products.editPricing");
  const editStock = can(currentUser.role, "products.editStock");
  const editVisibility = can(currentUser.role, "products.editVisibility");

  const [price, setPrice] = useState(String(product.price));
  const [offerPrice, setOfferPrice] = useState(product.offerPrice ? String(product.offerPrice) : "");
  const [stock, setStock] = useState(product.stock);
  const [visible, setVisible] = useState(!product.hidden);
  const [featured, setFeatured] = useState(product.featured);
  const [bestSeller, setBestSeller] = useState(product.featured);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "pending">("idle");
  const [stockOpen, setStockOpen] = useState(false);
  const [stockAmount, setStockAmount] = useState("");
  const [stockMode, setStockMode] = useState<"add" | "count">("add");

  const offerInvalid = offerPrice !== "" && Number(offerPrice) >= Number(price);

  function mockSave() {
    setSave("saving");
    // Prototype only. A real save will be a server action that writes Supabase,
    // queues the Sheet write-back and records who changed what.
    window.setTimeout(() => setSave("saved"), 700);
    window.setTimeout(() => setSave("pending"), 2200);
    window.setTimeout(() => setSave("idle"), 5200);
  }

  function applyStock() {
    const n = Number(stockAmount);
    if (!Number.isFinite(n) || n < 0) return;
    setStock(stockMode === "add" ? stock + n : n);
    setStockAmount("");
    setStockOpen(false);
    mockSave();
  }

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price" hint="What the customer pays.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">
                TSh
              </span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={mockSave}
                disabled={!editPricing}
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
                onBlur={mockSave}
                disabled={!editPricing}
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
              <p className="font-display text-2xl font-black text-slate-900 tabular-nums">{stock}</p>
            </div>
            {editStock && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStockMode("add");
                    setStockOpen(true);
                  }}
                >
                  Add stock
                </Button>
                <Button
                  variant="secondary"
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
            <div className="mt-3 border-t border-slate-100 pt-3">
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => setStockOpen(false)} full>
                  Cancel
                </Button>
                <Button variant="accent" onClick={applyStock} disabled={stockAmount === ""} full>
                  {stockMode === "add" ? "Add to stock" : "Save count"}
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
            disabled={!editVisibility}
            onChange={(v) => {
              setVisible(v);
              mockSave();
            }}
          />
          <Toggle
            label="Featured"
            hint="Highlighted on the homepage."
            checked={featured}
            disabled={!editVisibility}
            onChange={(v) => {
              setFeatured(v);
              mockSave();
            }}
          />
          <Toggle
            label="Best seller"
            hint="Shown in the Best sellers row."
            checked={bestSeller}
            disabled={!editVisibility}
            onChange={(v) => {
              setBestSeller(v);
              mockSave();
            }}
          />
        </div>
      </Card>

      {/* Everything else, folded away */}
      <details className="group mb-5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 font-display text-sm font-bold text-slate-700">
          More product details
          <Icon name="chevronDown" className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <Card className="mt-2 space-y-4 p-4">
          <p className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
            These come from the product sheet. Changing them here will update the sheet too once
            syncing is switched on.
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
              <input defaultValue={product.categoryId.replace("cat_", "").replace(/-/g, " ")} className={inputClass} readOnly />
            </Field>
            <Field label="Supplier">
              <input defaultValue="EcoPlus Brands" className={inputClass} readOnly />
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
          <Button variant="secondary" icon="package" disabled={!editVisibility}>
            Archive product
          </Button>
        </div>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
        <Badge tone="neutral">Prototype</Badge>
        Nothing here is saved yet.
      </p>
    </>
  );
}
