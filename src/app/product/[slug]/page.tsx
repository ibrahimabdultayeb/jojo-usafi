import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/product/AddToCartControl";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  fullProductName,
  getBrand,
  getCategories,
  getFamilySizes,
  getProduct,
  getProducts,
  getRelatedProducts,
  getSupplierName,
  productName,
} from "@/lib/catalogue/queries";
import { formatAmount } from "@/lib/format";
import { site } from "@/lib/site";
import { toneSet } from "@/lib/tones";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product not found" };
  return { title: fullProductName(product), description: product.description };
}

const promises = [
  { icon: "truck" as const, text: `Delivered across ${site.serviceArea}` },
  { icon: "wallet" as const, text: "Lipa ukipokea — pay when it arrives" },
  { icon: "shield" as const, text: "Genuine stock, sealed from the manufacturer" },
];

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const brand = getBrand(product.brandId);
  const category = getCategories().find((c) => c.id === product.categoryId);
  const sizes = getFamilySizes(product.familyId);
  const related = getRelatedProducts(product, 4);
  const tone = toneSet(product.tone);

  return (
    <>
      <div className="shell py-6 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-400">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <Icon name="chevronRight" className="h-3 w-3" />
          <Link href="/shop" className="hover:text-slate-700">
            Shop
          </Link>
          {category && (
            <>
              <Icon name="chevronRight" className="h-3 w-3" />
              <Link href={`/shop?category=${category.slug}`} className="hover:text-slate-700">
                {category.name}
              </Link>
            </>
          )}
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div
              className="overflow-hidden rounded-[2rem] border border-slate-100"
              style={{ backgroundColor: tone.soft }}
            >
              <ProductVisual product={product} size="detail" className="h-full w-full" />
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {sizes.slice(0, 3).map((size) => (
                <li key={size.sku}>
                  <Link
                    href={`/product/${size.slug}`}
                    aria-current={size.sku === product.sku ? "true" : undefined}
                    className={`block overflow-hidden rounded-2xl border-2 bg-white transition-colors ${
                      size.sku === product.sku ? "border-brand-500" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <ProductVisual product={size} className="h-full w-full" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/shop?brand=${brand?.slug ?? ""}`}
                className="text-xs font-black tracking-widest text-brand-700 uppercase hover:text-brand-800"
              >
                {brand?.name}
              </Link>
              {product.badges.map((badge) => (
                <span
                  key={badge.label}
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black tracking-widest text-white uppercase"
                >
                  {badge.label}
                </span>
              ))}
            </div>

            <h1 className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight text-slate-900 md:text-5xl">
              {productName(product)}
            </h1>

            <p className="mt-4 text-base leading-relaxed font-medium text-slate-500 md:text-lg">
              {product.description}
            </p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-400">{site.currency}</span>
              <span className="font-display text-4xl font-black text-slate-900 md:text-5xl">
                {formatAmount(product.price)}
              </span>
              <span className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                {product.packSize}
              </span>
            </div>

            {sizes.length > 1 && (
              <fieldset className="mt-7">
                <legend className="mb-3 text-xs font-black tracking-widest text-slate-400 uppercase">
                  Choose a size
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {sizes.map((size) => {
                    const active = size.sku === product.sku;
                    return (
                      <Link
                        key={size.sku}
                        href={`/product/${size.slug}`}
                        aria-current={active ? "true" : undefined}
                        className={`flex min-h-14 min-w-[6rem] flex-col justify-center rounded-2xl border-2 px-4 py-2 transition-all ${
                          active
                            ? "border-brand-600 bg-brand-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        } ${size.inStock ? "" : "opacity-50"}`}
                      >
                        <span className="font-display text-sm font-bold text-slate-900">
                          {size.packSize}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {site.currency} {formatAmount(size.price)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-7">
              <AddToCartButton product={product} />
            </div>

            <ul className="mt-7 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              {promises.map((promise) => (
                <li key={promise.text} className="flex items-start gap-3 text-sm font-semibold text-slate-600">
                  <Icon name={promise.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  {promise.text}
                </li>
              ))}
            </ul>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-6 text-sm">
              <div>
                <dt className="text-xs font-bold text-slate-400">Item code</dt>
                <dd className="font-bold text-slate-900">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">Pack size</dt>
                <dd className="font-bold text-slate-900">{product.packSize}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">Category</dt>
                <dd className="font-bold text-slate-900">{category?.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">Supplied by</dt>
                <dd className="font-bold text-slate-900">{getSupplierName(product.supplierId)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="shell pt-4 pb-14 md:pb-20">
          <SectionHeading
            title="Goes well with"
            action={category ? { label: "View all", href: `/shop?category=${category.slug}` } : undefined}
          />
          <ProductGrid products={related} />
        </section>
      )}
    </>
  );
}
