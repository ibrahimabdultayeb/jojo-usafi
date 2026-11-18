"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { AddToCartControl } from "@/components/product/AddToCartControl";
import { Icon } from "@/components/ui/Icon";
import { productName } from "@/lib/catalogue/format";
import type { Product } from "@/lib/catalogue/types";
import { formatPrice } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n";
import { useShowroomMotion } from "@/components/layout/ShowroomMotion";
import { ShowroomLabel, showroomAsset } from "./Showroom";
import { showroomCopy } from "./showroom-copy";

const curatedProducts = [
  ["EP01-A02", "Multix", "multix-5l"],
  ["EP05-A03", "Ozone", "ozone-15l"],
  ["EP09-A07", "Softi", "softi-500ml"],
  ["EP02-B06", "Chap Chap", "chap-chap-750ml"],
  ["EP04-A06", "Quack", "quack-750ml"],
  ["EP06-A03", "Tashu", "tashu-15l"],
] as const;

export function FeaturedShelf({ products, locale }: { products: Product[]; locale: Locale }) {
  const copy = showroomCopy(locale);
  const rail = useRef<HTMLUListElement>(null);
  const { reduced } = useShowroomMotion();
  const items = curatedProducts.flatMap(([sku, brand, image]) => {
    const product = products.find((candidate) => candidate.sku === sku);
    return product ? [{ product, brand, image }] : [];
  });
  if (!items.length) return null;

  function scrollRail(direction: number) {
    if (!rail.current) return;
    rail.current.scrollBy({ left: direction * rail.current.clientWidth * 0.48, behavior: reduced ? "instant" : "smooth" });
  }

  return (
    <section className="showroom-shelf" id="featured-products">
      <div className="showroom-wrap">
        <header className="showroom-section-heading">
          <div><ShowroomLabel>{copy.featured}</ShowroomLabel><h2>{copy.featuredTitle}</h2></div>
          <div className="showroom-shelf-nav">
            <Link href={localePath(locale, "/shop")} className="showroom-text-link">
              {copy.browseAll}<Icon name="arrowUpRight" />
            </Link>
            <div className="showroom-shelf-buttons">
              <button type="button" aria-label={copy.previous} onClick={() => scrollRail(-1)}><Icon name="arrowLeft" /></button>
              <button type="button" aria-label={copy.more} onClick={() => scrollRail(1)}><Icon name="arrowRight" /></button>
            </div>
          </div>
        </header>
        <ul className="showroom-shelf-rail" ref={rail}>
          {items.map(({ product, brand, image }) => (
            <li className="showroom-shelf-card" key={product.sku}>
              <Link className="showroom-shelf-product" href={localePath(locale, `/product/${product.slug}`)}>
                <div className="showroom-shelf-image">
                  <Image src={showroomAsset(image)} width={124} height={212} alt="" />
                </div>
                <span>{brand} <small>· {product.packSize}</small></span>
                <h3>{productName(product)}</h3>
              </Link>
              <div className="showroom-shelf-price">
                <strong>{formatPrice(product.price)}</strong>
                <AddToCartControl product={product} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
