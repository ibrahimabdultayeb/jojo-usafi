import type { Metadata } from "next";
import { ProductView } from "@/views/ProductView";
import { fullProductName, getProduct, getProducts } from "@/lib/catalogue/queries";
import { localeAlternates } from "@/lib/i18n";

const locale = "en" as const;

type Params = Promise<{ slug: string }>;

/** Only publishable products are prerendered — the shelf is the source of truth. */
export function generateStaticParams() {
  return getProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: fullProductName(product),
    // The master carries a description for 1 of 201 rows; none is invented here.
    description: product.description || undefined,
    alternates: localeAlternates(locale, `/product/${product.slug}`),
  };
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  return <ProductView locale={locale} slug={slug} />;
}
