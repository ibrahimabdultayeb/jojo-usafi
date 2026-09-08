import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/catalogue/types";
import type { Locale } from "@/lib/i18n";

/**
 * The product shelf.
 *
 * COLUMNS — matched to the EcoPlus reference's desktop density:
 *
 *      < 768px   2   phones
 *   >= 768px     3   tablets
 *   >= 1024px    4   laptops
 *   >= 1280px    5   wide desktop
 *
 * Five columns start at `xl` rather than `lg` because the shell is capped at
 * 1400px: at 1280px a five-across card is ~227px wide, which is the same card
 * the four-across laptop layout already ships, while at 1024px it would fall to
 * ~176px and squeeze the name, the pack size and the price row. So the card
 * proportions never get tighter than the approved ones — the row simply gains a
 * fifth card once there is real room for it.
 *
 * VARIANTS — what happens to a fixed-length shelf when the column count changes.
 * `grid` shows everything and is right for Shop All, where a part-full last row
 * is just where the catalogue ends. A homepage rail is different: it is handed
 * enough products to fill the widest row, and at narrower widths the tail is
 * trimmed by CSS to whatever completes the row, because one orphan card sitting
 * under a full row is the thing that reads as broken. See `.shelf-rail` and
 * `.shelf-two-rows` in `globals.css`.
 */

const VARIANTS = {
  /** Everything supplied, however the last row falls. */
  grid: "",
  /** Give it 5. Shows 4 / 3 / 4 / 5 — one complete row at every width. */
  rail: "shelf-rail",
  /** Give it 10. Shows 8 / 9 / 8 / 10 — two complete rows at every width. */
  twoRows: "shelf-two-rows",
} as const;

interface ProductGridProps {
  products: Product[];
  locale: Locale;
  /** How many cards to load eagerly — the ones likely above the fold. */
  priorityCount?: number;
  variant?: keyof typeof VARIANTS;
}

export function ProductGrid({
  products,
  locale,
  priorityCount = 0,
  variant = "grid",
}: ProductGridProps) {
  return (
    <div
      data-qa="product-grid"
      data-qa-variant={variant}
      className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5 ${VARIANTS[variant]}`}
    >
      {products.map((product, i) => (
        <ProductCard
          key={product.sku}
          product={product}
          locale={locale}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}
