import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ShopControls } from "@/components/shop/ShopControls";
import { Icon } from "@/components/ui/Icon";
import {
  getBrands,
  getCategories,
  getCategory,
  getProducts,
  searchProducts,
  sortProducts,
  type SortKey,
} from "@/lib/catalogue/queries";

export const metadata: Metadata = {
  title: "Shop all products",
  description: "Browse every Jojo Usafi household essential, delivered across Dar es Salaam.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const categorySlug = first(params.category);
  const brandSlug = first(params.brand);
  const query = first(params.q) ?? "";
  const sort = (first(params.sort) ?? "featured") as SortKey;

  const categories = getCategories();
  const category = categorySlug ? getCategory(categorySlug) : undefined;
  const brand = brandSlug ? getBrands().find((b) => b.slug === brandSlug) : undefined;

  let list = getProducts();
  if (category) list = list.filter((p) => p.categoryId === category.id);
  if (brand) list = list.filter((p) => p.brandId === brand.id);
  list = sortProducts(searchProducts(list, query), sort);

  const heading = category?.name ?? brand?.name ?? "All products";
  const blurb =
    category?.blurb ??
    (brand ? `Every ${brand.name} pack size we stock.` : "Every household essential we deliver in Dar es Salaam.");

  return (
    <div className="shell py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-400">
        <Link href="/" className="hover:text-slate-700">
          Home
        </Link>
        <Icon name="chevronRight" className="h-3 w-3" />
        <Link href="/shop" className="hover:text-slate-700">
          Shop
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
        {list.length} {list.length === 1 ? "product" : "products"}
        {query && (
          <>
            {" "}
            matching <span className="text-slate-700">“{query}”</span>
          </>
        )}
      </p>

      {list.length > 0 ? (
        <ProductGrid products={list} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="search" className="h-7 w-7" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-slate-900">Nothing here yet</p>
            <p className="mt-1 max-w-sm text-sm font-medium text-slate-500">
              We could not find a product for that. Try another search, or browse the full shelf.
            </p>
          </div>
          <Link
            href="/shop"
            className="flex min-h-12 items-center rounded-full bg-slate-900 px-6 font-display text-sm font-bold text-white transition-colors hover:bg-brand-600"
          >
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}
