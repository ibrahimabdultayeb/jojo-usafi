"use client";

import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/catalogue/types";
import { fullProductName } from "@/lib/catalogue/queries";

/**
 * Compact control used on product cards: a single round "+" that expands into a
 * quantity stepper once the item is in the cart. Both states are 44px tall so
 * the card never shifts height and the target stays thumb-sized.
 */
export function AddToCartControl({ product }: { product: Product }) {
  const { quantityOf, add, setQuantity, hydrated } = useCart();
  const quantity = hydrated ? quantityOf(product.sku) : 0;
  const label = fullProductName(product);

  if (!product.inStock) {
    return (
      <span className="ml-auto inline-flex h-11 shrink-0 items-center rounded-full bg-slate-100 px-4 text-xs font-bold text-slate-500">
        Out of stock
      </span>
    );
  }

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={() => add(product.sku)}
        aria-label={`Add ${label} to cart`}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition-colors hover:bg-brand-600"
      >
        <Icon name="plus" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="ml-auto flex h-11 w-[7.5rem] shrink-0 items-center overflow-hidden rounded-full border border-brand-200 bg-brand-100">
      <button
        type="button"
        onClick={() => setQuantity(product.sku, quantity - 1)}
        aria-label={`Reduce quantity of ${label}`}
        className="flex h-full w-11 items-center justify-center text-brand-700 transition-colors hover:bg-brand-200"
      >
        <Icon name={quantity === 1 ? "trash" : "minus"} className="h-3.5 w-3.5" />
      </button>
      <span aria-live="polite" className="flex-1 text-center text-sm font-black text-brand-900">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => add(product.sku)}
        aria-label={`Increase quantity of ${label}`}
        className="flex h-full w-11 items-center justify-center text-brand-700 transition-colors hover:bg-brand-200"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Full-width variant for the product detail page. */
export function AddToCartButton({ product }: { product: Product }) {
  const { quantityOf, add, setQuantity, openCart, hydrated } = useCart();
  const quantity = hydrated ? quantityOf(product.sku) : 0;
  const label = fullProductName(product);

  if (!product.inStock) {
    return (
      <div className="flex min-h-14 w-full items-center justify-center rounded-full bg-slate-100 px-6 font-display text-base font-bold text-slate-500">
        Out of stock
      </div>
    );
  }

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={() => add(product.sku)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
      >
        <Icon name="cart" className="h-5 w-5" />
        Add to cart
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex h-14 flex-1 items-center overflow-hidden rounded-full border border-brand-200 bg-brand-100">
        <button
          type="button"
          onClick={() => setQuantity(product.sku, quantity - 1)}
          aria-label={`Reduce quantity of ${label}`}
          className="flex h-full w-14 items-center justify-center text-brand-700 transition-colors hover:bg-brand-200"
        >
          <Icon name={quantity === 1 ? "trash" : "minus"} className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="flex-1 text-center font-display text-lg font-black text-brand-900">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => add(product.sku)}
          aria-label={`Increase quantity of ${label}`}
          className="flex h-full w-14 items-center justify-center text-brand-700 transition-colors hover:bg-brand-200"
        >
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={openCart}
        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 font-display text-base font-bold text-white transition-colors hover:bg-brand-600"
      >
        View cart
      </button>
    </div>
  );
}
