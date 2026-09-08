import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/catalogue/types";
import type { Locale } from "@/lib/i18n";

interface ProductGridProps {
  products: Product[];
  locale: Locale;
  /** How many cards to load eagerly — the ones likely above the fold. */
  priorityCount?: number;
}

export function ProductGrid({ products, locale, priorityCount = 0 }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
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
