import Link from "next/link";
import { AddToCartControl } from "@/components/product/AddToCartControl";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { getBrand, productName } from "@/lib/catalogue/queries";
import type { Product } from "@/lib/catalogue/types";
import { formatAmount } from "@/lib/format";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";

const badgeStyles: Record<string, string> = {
  bestseller: "bg-slate-900 text-white",
  value: "bg-brand-600 text-white",
  new: "bg-amber-400 text-amber-950",
  bulk: "bg-white text-slate-700 ring-1 ring-slate-200",
};

interface ProductCardProps {
  product: Product;
  locale: Locale;
  /** Eager-load the first row of images so the shelf paints without a flash. */
  priority?: boolean;
}

export function ProductCard({ product, locale, priority = false }: ProductCardProps) {
  const t = getDictionary(locale);
  const brand = getBrand(product.brandId);
  const badge = product.badges[0];
  const href = localePath(locale, `/product/${product.slug}`);
  const name = productName(product);
  const alt = fill(t.product.photoAlt, {
    name: [brand?.name, name].filter(Boolean).join(" "),
    size: product.packSize,
  });

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(0_0_0/0.08)] transition-shadow duration-300 hover:shadow-2xl">
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-1 sm:inset-x-4 sm:top-4">
        {badge ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-widest uppercase ${
              badgeStyles[badge.kind] ?? badgeStyles.bulk
            }`}
          >
            {badge.label}
          </span>
        ) : (
          <span />
        )}
        {!product.inStock && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black tracking-widest text-slate-500 uppercase ring-1 ring-slate-200">
            {t.product.soldOut}
          </span>
        )}
      </div>

      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block w-full shrink-0 overflow-hidden bg-white"
      >
        <ProductPhoto
          product={product}
          alt={alt}
          size="card"
          priority={priority}
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col border-t border-slate-100 p-4 md:p-5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="shrink-0 text-[11px] font-black tracking-widest text-brand-700 uppercase">
            {brand?.name}
          </span>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {product.packSize}
          </span>
        </div>

        <h3 className="mb-2 line-clamp-2 font-display text-base leading-tight font-bold text-slate-900 lg:text-lg">
          <Link href={href} className="transition-colors hover:text-brand-700">
            <span className="absolute inset-0 z-0" aria-hidden />
            {name}
          </Link>
        </h3>

        {/* The master carries a description for 1 of 201 products. Where there is
            none the card simply closes up — nothing is invented to fill it. */}
        {product.description && (
          <p className="mb-4 line-clamp-2 text-xs leading-relaxed font-medium text-slate-500">
            {product.description}
          </p>
        )}

        <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="min-w-0 leading-none whitespace-nowrap">
            <span className="text-[11px] font-bold text-slate-400">{site.currency} </span>
            <span className="text-lg font-black text-slate-900">{formatAmount(product.price)}</span>
          </p>
          <AddToCartControl product={product} />
        </div>
      </div>
    </article>
  );
}
