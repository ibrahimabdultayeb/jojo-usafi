import Link from "next/link";
import { Suspense } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ShopControls } from "@/components/shop/ShopControls";
import { Icon } from "@/components/ui/Icon";
import {
  getBrands,
  getCategories,
  getProducts,
  searchProducts,
  sortProducts,
  type SortKey,
} from "@/lib/catalogue/queries";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";

export type ShopSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface ShopViewProps {
  locale: Locale;
  searchParams: ShopSearchParams;
}

export async function ShopView({ locale, searchParams }: ShopViewProps) {
  const t = getDictionary(locale);
  const params = await searchParams;
  const categorySlug = first(params.category);
  const brandSlug = first(params.brand);
  const query = first(params.q) ?? "";
  const sort = (first(params.sort) ?? "featured") as SortKey;

  const [categories, brands, allProducts] = await Promise.all([
    getCategories(),
    getBrands(),
    getProducts(),
  ]);
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;
  const brand = brandSlug ? brands.find((b) => b.slug === brandSlug) : undefined;

  let list = allProducts;
  if (category) list = list.filter((p) => p.categoryId === category.id);
  if (brand) list = list.filter((p) => p.brandId === brand.id);
  list = sortProducts(searchProducts(list, query, new Map(brands.map((b) => [b.id, b]))), sort);

  const heading = category?.name ?? brand?.name ?? t.shop.allProducts;
  const blurb =
    category?.blurb ??
    (brand ? fill(t.shop.brandBlurb, { brand: brand.name }) : t.shop.allBlurb);
  const shop = localePath(locale, "/shop");

  return (
    <div className="shell py-8 md:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-400"
      >
        <Link href={localePath(locale, "/")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
          {t.shop.breadcrumbHome}
        </Link>
        <Icon name="chevronRight" className="h-3 w-3" />
        <Link href={shop} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
          {t.shop.breadcrumbShop}
        </Link>
        {(category || brand) && (
          <>
            <Icon name="chevronRight" className="h-3 w-3" />
            <span className="text-slate-700">{heading}</span>
          </>
        )}
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
          {heading}
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 md:text-base">{blurb}</p>
      </header>

      <Suspense fallback={<div className="mb-8 h-24 border-y border-slate-100" />}>
        <ShopControls categories={categories} activeCategory={categorySlug} activeSort={sort} />
      </Suspense>

      <p className="mb-5 text-xs font-bold text-slate-400">
        {fill(list.length === 1 ? t.shop.countOne : t.shop.countMany, { count: list.length })}
        {query && (
          <>
            {" "}
            {t.shop.matching} <span className="text-slate-700">&ldquo;{query}&rdquo;</span>
          </>
        )}
      </p>

      {list.length > 0 ? (
        <ProductGrid products={list} locale={locale} priorityCount={4} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="search" className="h-7 w-7" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-slate-900">{t.shop.emptyTitle}</p>
            <p className="mt-1 max-w-sm text-sm font-medium text-slate-500">{t.shop.emptyBody}</p>
          </div>
          <Link
            href={shop}
            className="flex min-h-12 items-center rounded-full bg-slate-900 px-6 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
          >
            {t.shop.emptyCta}
          </Link>
        </div>
      )}
    </div>
  );
}
