"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProductBySku } from "./catalogue/queries";
import type { CartLine, Product } from "./catalogue/types";

/**
 * Prototype cart.
 *
 * Lines are stored by SKU only, so the cart survives a catalogue price change and
 * is trivial to hand to a real order document later. Persistence is localStorage
 * for now; there is no order backend in this prototype.
 */

const STORAGE_KEY = "jojo-usafi.cart.v1";
const MAX_PER_LINE = 99;

export interface CartItem {
  product: Product;
  quantity: number;
  lineTotal: number;
}

interface CartValue {
  lines: CartLine[];
  items: CartItem[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  quantityOf: (sku: string) => number;
  add: (sku: string, quantity?: number) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function readStored(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as CartLine).sku === "string" &&
          typeof (l as CartLine).quantity === "number",
      )
      .filter((l) => Boolean(getProductBySku(l.sku)) && l.quantity > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLines(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // A full or blocked storage quota must never break the storefront.
    }
  }, [lines, hydrated]);

  // The drawer is a modal surface: hold the page still while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const setQuantity = useCallback((sku: string, quantity: number) => {
    setLines((current) => {
      const next = Math.max(0, Math.min(MAX_PER_LINE, Math.round(quantity)));
      if (next === 0) return current.filter((l) => l.sku !== sku);
      if (current.some((l) => l.sku === sku)) {
        return current.map((l) => (l.sku === sku ? { ...l, quantity: next } : l));
      }
      return [...current, { sku, quantity: next }];
    });
  }, []);

  const add = useCallback((sku: string, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.sku === sku);
      if (!existing) return [...current, { sku, quantity }];
      return current.map((l) =>
        l.sku === sku ? { ...l, quantity: Math.min(MAX_PER_LINE, l.quantity + quantity) } : l,
      );
    });
  }, []);

  const remove = useCallback((sku: string) => {
    setLines((current) => current.filter((l) => l.sku !== sku));
  }, []);

  const value = useMemo<CartValue>(() => {
    const items: CartItem[] = lines.flatMap((line) => {
      const product = getProductBySku(line.sku);
      if (!product) return [];
      return [{ product, quantity: line.quantity, lineTotal: product.price * line.quantity }];
    });

    return {
      lines,
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
      hydrated,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      quantityOf: (sku: string) => lines.find((l) => l.sku === sku)?.quantity ?? 0,
      add,
      setQuantity,
      remove,
      clear: () => setLines([]),
    };
  }, [lines, hydrated, isOpen, add, setQuantity, remove]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}
