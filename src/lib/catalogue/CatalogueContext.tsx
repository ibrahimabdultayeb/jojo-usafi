"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Brand, Catalogue, Category, Product } from "./types";

/**
 * The published catalogue, handed to the browser once.
 *
 * The cart is stored in `localStorage` as SKUs and quantities — nothing else,
 * because a price cached in a browser is a price that goes stale. To draw a
 * cart line the client therefore has to turn a SKU back into a product, and it
 * cannot `await` a server query to do it.
 *
 * So the server fetches the shelf once (see `queries.ts`) and passes it through
 * this context. Before Build 07 the whole 201-row generated catalogue was
 * imported directly into these components and shipped in the JavaScript bundle;
 * this is the same data reaching the browser by a shorter route, and less of it
 * — 95 published products rather than 201 rows including the withheld ones.
 *
 * It is a CACHE FOR DRAWING, never an authority. Checkout prices the order from
 * the database on the server.
 */

interface CatalogueContextValue {
  readonly products: readonly Product[];
  readonly brands: readonly Brand[];
  readonly categories: readonly Category[];
  readonly productsBySku: ReadonlyMap<string, Product>;
  readonly brandsById: ReadonlyMap<string, Brand>;
}

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueProvider({
  catalogue,
  children,
}: {
  catalogue: Catalogue;
  children: ReactNode;
}) {
  const value = useMemo<CatalogueContextValue>(
    () => ({
      products: catalogue.products,
      brands: catalogue.brands,
      categories: catalogue.categories,
      productsBySku: new Map(catalogue.products.map((p) => [p.sku, p])),
      brandsById: new Map(catalogue.brands.map((b) => [b.id, b])),
    }),
    [catalogue],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

function useCatalogueContext(): CatalogueContextValue {
  const value = useContext(CatalogueContext);
  if (!value) {
    throw new Error(
      "useCatalogue() was called outside CatalogueProvider. The storefront layout provides it; " +
        "a client component that needs the catalogue must render inside that layout.",
    );
  }
  return value;
}

export function useCatalogue(): CatalogueContextValue {
  return useCatalogueContext();
}

export function useBrand(id: string): Brand | undefined {
  return useCatalogueContext().brandsById.get(id);
}

export function useCategories(): readonly Category[] {
  return useCatalogueContext().categories;
}

export function useProductBySku(sku: string): Product | undefined {
  return useCatalogueContext().productsBySku.get(sku);
}
