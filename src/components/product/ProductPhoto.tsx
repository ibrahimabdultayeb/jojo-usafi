import Image from "next/image";
import type { Product } from "@/lib/catalogue/types";

/**
 * APPROVED PRODUCT PHOTOGRAPHY.
 *
 * Every photo was matched to its product on the exact SKU by
 * `scripts/build-catalogue.mjs`. A product with no approved photo is never
 * published, so `product.image` is always present on the storefront — the null
 * branch exists only so a mistake shows as an empty tile rather than a crash.
 *
 * The source photos are square, white-background and pre-sized, so they are
 * drawn with `object-contain` inside a fixed square box: no distortion, no
 * cropping, and no layout shift while they load.
 */

interface ProductPhotoProps {
  product: Product;
  alt: string;
  /** `card` is the grid tile, `detail` the large product-page image. */
  size?: "thumb" | "card" | "detail";
  /** Renders the first screenful of images eagerly instead of lazily. */
  priority?: boolean;
  className?: string;
}

/** Rendered width hints so the browser picks a sensible source. */
const SIZES: Record<NonNullable<ProductPhotoProps["size"]>, string> = {
  thumb: "80px",
  card: "(min-width: 1024px) 320px, (min-width: 640px) 33vw, 50vw",
  detail: "(min-width: 1024px) 560px, 100vw",
};

const PADDING: Record<NonNullable<ProductPhotoProps["size"]>, string> = {
  thumb: "p-1.5",
  card: "p-3 sm:p-4",
  detail: "p-6 md:p-10",
};

export function ProductPhoto({
  product,
  alt,
  size = "card",
  priority = false,
  className = "",
}: ProductPhotoProps) {
  const image = product.image;

  if (!image) {
    return (
      <div
        aria-hidden
        className={`aspect-square w-full bg-slate-100 ${className}`}
      />
    );
  }

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-white ${className}`}>
      <Image
        src={image.src}
        alt={alt}
        width={image.width}
        height={image.height}
        sizes={SIZES[size]}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={`h-full w-full object-contain ${PADDING[size]}`}
      />
    </div>
  );
}
