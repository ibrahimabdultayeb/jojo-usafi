import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/product/AddToCartControl";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  getBrand,
  getCategories,
  getFamilySizes,
  getProduct,
  getRelatedProducts,
  getSupplierName,
  productName,
} from "@/lib/catalogue/queries";
import { formatAmount } from "@/lib/format";
import { fill, getDictionary, localePath, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";

export async function ProductView({ locale, slug }: { locale: Locale; slug: string }) {
  const t = getDictionary(locale);
  const product = getProduct(slug);
  if (!product) notFound();

  const brand = getBrand(product.brandId);
  const category = getCategories().find((c) => c.id === product.categoryId);
  const sizes = getFamilySizes(product.familyId);
  const related = getRelatedProducts(product, 4);
  const shop = localePath(locale, "/shop");
  const name = productName(product);
  const altFor = (p: typeof product) =>
    fill(t.product.photoAlt, {
      name: [brand?.name, productName(p)].filter(Boolean).join(" "),
      size: p.packSize,
    });

  const promises = [
    { icon: "truck" as const, text: fill(t.product.promiseDelivery, { area: site.serviceArea }) },
    { icon: "wallet" as const, text: t.product.promisePay },
    { icon: "shield" as const, text: t.product.promiseGenuine },
  ];

  return (
    <>
      <div className="shell py-6 md:py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-400"
        >
          <Link href={localePath(locale, "/")} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
            {t.shop.breadcrumbHome}
          </Link>
          <Icon name="chevronRight" className="h-3 w-3" />
          <Link href={shop} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
            {t.shop.breadcrumbShop}
          </Link>
          {category && (
            <>
              <Icon name="chevronRight" className="h-3 w-3" />
              <Link href={`${shop}?category=${category.slug}`} className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-slate-700">
                {category.name}
              </Link>
            </>
          )}
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <ProductPhoto product={product} alt={altFor(product)} size="detail" priority />
            </div>

            {sizes.length > 1 && (
              <ul className="mt-4 grid grid-cols-4 gap-2">
                {sizes.slice(0, 4).map((size) => (
                  <li key={size.sku}>
                    <Link
                      href={localePath(locale, `/product/${size.slug}`)}
                      aria-current={size.sku === product.sku ? "true" : undefined}
                      aria-label={`${size.packSize} — ${altFor(size)}`}
                      className={`block overflow-hidden rounded-2xl border-2 bg-white transition-colors ${
                        size.sku === product.sku
                          ? "border-brand-500"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <ProductPhoto product={size} alt="" size="thumb" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`${shop}?brand=${brand?.slug ?? ""}`}
                className="inline-flex min-h-11 items-center text-xs font-black tracking-widest text-brand-700 uppercase hover:text-brand-800"
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
              {name}
            </h1>

            {/* The Product Master holds a description for 1 of 201 rows. Where
                there is none, nothing is written in its place. */}
            {product.description && (
              <p className="mt-4 text-base leading-relaxed font-medium text-slate-500 md:text-lg">
                {product.description}
              </p>
            )}

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
                  {t.product.chooseSize}
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {sizes.map((size) => {
                    const active = size.sku === product.sku;
                    return (
                      <Link
                        key={size.sku}
                        href={localePath(locale, `/product/${size.slug}`)}
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
                <li
                  key={promise.text}
                  className="flex items-start gap-3 text-sm font-semibold text-slate-600"
                >
                  <Icon name={promise.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  {promise.text}
                </li>
              ))}
            </ul>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-6 text-sm">
              <div>
                <dt className="text-xs font-bold text-slate-400">{t.product.itemCode}</dt>
                <dd className="font-bold text-slate-900">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">{t.product.packSize}</dt>
                <dd className="font-bold text-slate-900">{product.packSize}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">{t.product.category}</dt>
                <dd className="font-bold text-slate-900">{category?.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-400">{t.product.suppliedBy}</dt>
                <dd className="font-bold text-slate-900">{getSupplierName(product.supplierId)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="shell pt-4 pb-14 md:pb-20">
          <SectionHeading
            title={t.product.goesWith}
            action={
              category
                ? { label: t.product.viewAll, href: `${shop}?category=${category.slug}` }
                : undefined
            }
          />
          <ProductGrid products={related} locale={locale} />
        </section>
      )}
    </>
  );
}
