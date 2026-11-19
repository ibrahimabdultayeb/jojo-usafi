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
import { useCatalogue } from "./catalogue/CatalogueContext";
import type { CartLine, Product } from "./catalogue/types";
import { MAX_PER_LINE, normalizeCartLines, cartQuantityLimit } from "./cart-lines";

/** SKU-only persistence; live checkout remains authoritative for prices and stock. */
const STORAGE_KEY = "jojo-usafi.cart.v1";

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
    return normalizeCartLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // The cart stores SKUs; the catalogue turns them back into products to draw.
  const { productsBySku } = useCatalogue();
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

  const setQuantity = useCallback((sku: string, quantity: number) => {
    if (!Number.isFinite(quantity) || !sku.trim()) return;
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
    const product = productsBySku.get(sku);
    if (!product || !Number.isFinite(quantity) || quantity < 1) return;
    const limit = cartQuantityLimit(product);
    setLines((current) => {
      const existing = current.find((line) => line.sku === sku);
      if ((existing?.quantity ?? 0) >= limit) return current;
      const next = Math.min(limit, (existing?.quantity ?? 0) + Math.floor(quantity));
      return existing
        ? current.map((line) => line.sku === sku ? { ...line, quantity: next } : line)
        : [...current, { sku, quantity: next }];
    });
  }, [productsBySku]);

  const remove = useCallback((sku: string) => {
    setLines((current) => current.filter((l) => l.sku !== sku));
  }, []);

  const value = useMemo<CartValue>(() => {
    const items: CartItem[] = lines.flatMap((line) => {
      const product = productsBySku.get(line.sku);
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
  }, [lines, hydrated, isOpen, add, setQuantity, remove, productsBySku]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}
