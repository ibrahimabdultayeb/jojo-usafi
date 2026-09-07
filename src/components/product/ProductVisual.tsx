import { getBrand } from "@/lib/catalogue/queries";
import type { PackType, Product } from "@/lib/catalogue/types";
import { toneSet } from "@/lib/tones";

/**
 * PLACEHOLDER PRODUCT ARTWORK.
 *
 * Real catalogue photography will come from Firebase Storage. Until then each
 * product is drawn as its actual container shape in its brand tone, so the grid
 * reads as a real shelf rather than a wall of grey boxes.
 */

interface Silhouette {
  /** Body outline path on a 200x200 canvas. */
  body: string;
  /** Cap / handle detail drawn above the body. */
  cap: string;
  /** Label band: x, y, width, height, corner radius. */
  label: [number, number, number, number, number];
}

const silhouettes: Record<PackType, Silhouette> = {
  bottle: {
    body: "M74 62h52a10 10 0 0 1 10 10v92a10 10 0 0 1-10 10H74a10 10 0 0 1-10-10V72a10 10 0 0 1 10-10Z",
    cap: "M88 34h24a6 6 0 0 1 6 6v22H82V40a6 6 0 0 1 6-6Z",
    label: [72, 92, 56, 52, 6],
  },
  jerrycan: {
    body: "M62 60h76a12 12 0 0 1 12 12v90a12 12 0 0 1-12 12H62a12 12 0 0 1-12-12V72a12 12 0 0 1 12-12Z",
    cap: "M92 32h26a6 6 0 0 1 6 6v22H86V38a6 6 0 0 1 6-6Zm34 8h14a10 10 0 0 1 10 10v6h-14v-6a4 4 0 0 0-4-4h-6Z",
    label: [62, 92, 76, 58, 8],
  },
  drum: {
    body: "M56 52h88a10 10 0 0 1 10 10v104a10 10 0 0 1-10 10H56a10 10 0 0 1-10-10V62a10 10 0 0 1 10-10Z",
    cap: "M84 28h32a6 6 0 0 1 6 6v18H78V34a6 6 0 0 1 6-6Z",
    label: [54, 84, 92, 66, 8],
  },
  tub: {
    body: "M58 74h84l-8 88a10 10 0 0 1-10 9H76a10 10 0 0 1-10-9Z",
    cap: "M54 52h92a8 8 0 0 1 8 8v6a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8v-6a8 8 0 0 1 8-8Z",
    label: [64, 96, 72, 50, 6],
  },
  carton: {
    body: "M54 66h92v104a8 8 0 0 1-8 8H62a8 8 0 0 1-8-8Z",
    cap: "M54 66 78 40h44l24 26Z",
    label: [64, 92, 72, 54, 6],
  },
  sachet: {
    body: "M68 62h64a6 6 0 0 1 6 6v100a6 6 0 0 1-6 6H68a6 6 0 0 1-6-6V68a6 6 0 0 1 6-6Z",
    cap: "M62 46h76v16H62Z",
    label: [70, 92, 60, 50, 6],
  },
};

interface ProductVisualProps {
  product: Product;
  /** Larger drawing with a lighter backdrop, used on the product page. */
  size?: "card" | "detail";
  className?: string;
}

export function ProductVisual({ product, size = "card", className }: ProductVisualProps) {
  const tone = toneSet(product.tone);
  const brand = getBrand(product.brandId);
  const shape = silhouettes[product.packType] ?? silhouettes.bottle;
  const [lx, ly, lw, lh, lr] = shape.label;
  const gradientId = `pv-${product.sku}-${size}`;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${brand?.name ?? ""} ${product.family} ${product.variant}, ${product.packSize}`}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.mid} />
          <stop offset="100%" stopColor={tone.deep} />
        </linearGradient>
      </defs>

      <rect width="200" height="200" fill={size === "detail" ? "#ffffff" : tone.soft} opacity={size === "detail" ? 1 : 0.55} />
      <circle cx="100" cy="104" r="74" fill={tone.soft} opacity="0.75" />

      <g>
        <path d={shape.cap} fill={tone.deep} />
        <path d={shape.body} fill={`url(#${gradientId})`} />
        <rect x={lx} y={ly} width={lw} height={lh} rx={lr} fill="#ffffff" opacity="0.94" />
        <text
          x={lx + lw / 2}
          y={ly + lh / 2 - 4}
          textAnchor="middle"
          fontSize="19"
          fontWeight="800"
          fill={tone.deep}
          fontFamily="var(--font-display), system-ui, sans-serif"
        >
          {brand?.mark ?? "J"}
        </text>
        <text
          x={lx + lw / 2}
          y={ly + lh / 2 + 15}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#64748b"
          fontFamily="var(--font-inter), system-ui, sans-serif"
        >
          {product.packSize}
        </text>
      </g>
    </svg>
  );
}
