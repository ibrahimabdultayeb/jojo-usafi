import type { Brand, Category, PackType, Product, ProductBadge, Supplier, Tone } from "./types";

/**
 * PROTOTYPE DATA ONLY.
 *
 * This file stands in for Cloud Firestore while the storefront is being designed.
 * The shape mirrors the intended Firestore documents so that swapping this module
 * for real queries is a data-source change, not a UI change.
 *
 * Product names, pack sizes and TSh prices are taken from the current EcoPlus
 * catalogue so the prototype reads realistically.
 */

export const suppliers: Supplier[] = [
  { id: "sup_ecoplus", name: "EcoPlus Manufacturing", country: "Tanzania" },
];

export const brands: Brand[] = [
  { id: "brd_bubbles", slug: "bubbles", name: "Bubbles", tagline: "Shower & body care", mark: "B", tone: "aqua" },
  { id: "brd_softi", slug: "softi", name: "Softi", tagline: "Gentle hand care", mark: "S", tone: "berry" },
  { id: "brd_multix", slug: "multix", name: "Multix", tagline: "Multipurpose cleaning", mark: "M", tone: "lime" },
  { id: "brd_chapchap", slug: "chap-chap", name: "Chap Chap", tagline: "Fast dishwashing", mark: "C", tone: "amber" },
  { id: "brd_quack", slug: "quack", name: "Quack", tagline: "Toilet & washroom", mark: "Q", tone: "sky" },
  { id: "brd_vexa", slug: "vexa", name: "Vexa", tagline: "Scouring & surfaces", mark: "V", tone: "violet" },
  { id: "brd_ozone", slug: "ozone", name: "Ozone", tagline: "Laundry care", mark: "O", tone: "green" },
  { id: "brd_simba", slug: "simba", name: "Simba", tagline: "Vehicle care", mark: "S", tone: "slate" },
];

export const categories: Category[] = [
  {
    id: "cat_personal-care",
    slug: "personal-care",
    name: "Personal Care",
    blurb: "Shower gels, handwash and everyday body care.",
    tone: "aqua",
    icon: "M12 3c2.6 2.8 4.5 5.4 4.5 8a4.5 4.5 0 1 1-9 0c0-2.6 1.9-5.2 4.5-8Z",
  },
  {
    id: "cat_housekeeping",
    slug: "housekeeping",
    name: "Housekeeping",
    blurb: "Multipurpose detergents and dishwashing.",
    tone: "lime",
    icon: "M5 21h14M7 21V9l5-6 5 6v12M10 13h4",
  },
  {
    id: "cat_washroom",
    slug: "washroom-surface-care",
    name: "Washroom & Surface Care",
    blurb: "Toilet cleaners, scouring powders and surface care.",
    tone: "sky",
    icon: "M6 4h12v5a6 6 0 0 1-12 0V4ZM9 20h6M12 15v5",
  },
  {
    id: "cat_laundry",
    slug: "laundry-care",
    name: "Laundry Care",
    blurb: "Liquid detergents for machine and hand wash.",
    tone: "green",
    icon: "M4 4h16v16H4zM12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  },
  {
    id: "cat_vehicle",
    slug: "vehicle-care",
    name: "Vehicle Care",
    blurb: "Shampoos and finishes for cars and bikes.",
    tone: "slate",
    icon: "M4 16h16M6 16l1.6-5.2A2 2 0 0 1 9.5 9.4h5a2 2 0 0 1 1.9 1.4L18 16M7.5 19h1M15.5 19h1",
  },
];

const BADGE: Record<string, ProductBadge> = {
  best: { label: "Best Seller", kind: "bestseller" },
  value: { label: "Best Value", kind: "value" },
  bulk: { label: "Bulk Size", kind: "bulk" },
  fresh: { label: "New", kind: "new" },
};

function packTypeFor(packSize: string): PackType {
  if (/^\d+\s*(G|KG)$/i.test(packSize)) return "tub";
  if (/^20\s*LT$/i.test(packSize)) return "drum";
  if (/^(5|10)\s*LT$/i.test(packSize)) return "jerrycan";
  return "bottle";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** [packSize, price, badgeKeys] */
type SizeRow = [string, number, string[]?];

interface FamilySeed {
  brandId: string;
  categoryId: string;
  family: string;
  variant: string;
  description: string;
  tone: Tone;
  featured?: boolean;
  outOfStock?: string[];
  sizes: SizeRow[];
}

const families: FamilySeed[] = [
  {
    brandId: "brd_bubbles",
    categoryId: "cat_personal-care",
    family: "Shower Gel",
    variant: "Limette & Aloevera",
    tone: "lime",
    featured: true,
    description:
      "A hydrating shower gel with a bright limette and aloe vera fragrance. Rich lather, deep clean, and a soft nourished finish for everyday washing.",
    sizes: [
      ["800ML", 8000, ["best"]],
      ["5LT", 32200, ["value"]],
    ],
  },
  {
    brandId: "brd_bubbles",
    categoryId: "cat_personal-care",
    family: "Shower Gel",
    variant: "Aqua Splash",
    tone: "aqua",
    featured: true,
    description:
      "A crisp, fresh-water fragrance that wakes you up in the morning. Gentle enough for daily use and formulated to wash away germs.",
    sizes: [
      ["800ML", 8200],
      ["5LT", 46800, ["value"]],
    ],
  },
  {
    brandId: "brd_bubbles",
    categoryId: "cat_personal-care",
    family: "Shower Gel",
    variant: "Bubblegum",
    tone: "berry",
    featured: true,
    description:
      "A sweet, playful bubblegum shower gel that the whole family enjoys. Moisturising, long-lasting fragrance with no greasy feeling.",
    sizes: [
      ["800ML", 8800, ["best"]],
      ["5LT", 46400],
      ["20LT", 126800, ["bulk"]],
    ],
  },
  {
    brandId: "brd_bubbles",
    categoryId: "cat_personal-care",
    family: "Shower Gel",
    variant: "Romantic",
    tone: "violet",
    description:
      "A warm floral shower gel to close a long day. Soothing, softly perfumed and kind to skin.",
    sizes: [
      ["800ML", 10400],
      ["5LT", 30000, ["value"]],
    ],
  },
  {
    brandId: "brd_softi",
    categoryId: "cat_personal-care",
    family: "Handwash",
    variant: "Aloe Vera",
    tone: "green",
    featured: true,
    description:
      "Everyday antibacterial handwash with aloe vera. Cleans thoroughly without drying out hands, even with frequent washing.",
    sizes: [
      ["500ML", 6800, ["best"]],
      ["5LT", 28400, ["value"]],
    ],
  },
  {
    brandId: "brd_softi",
    categoryId: "cat_personal-care",
    family: "Handwash",
    variant: "Rose",
    tone: "berry",
    description: "A softly perfumed rose handwash for bathrooms and guest washrooms.",
    sizes: [["500ML", 7200, ["fresh"]]],
  },
  {
    brandId: "brd_multix",
    categoryId: "cat_housekeeping",
    family: "Multipurpose Detergent",
    variant: "Lemon Fresh",
    tone: "amber",
    featured: true,
    description:
      "One detergent for floors, walls, tiles and worktops. Cuts through grease and leaves a clean lemon finish that lasts.",
    sizes: [
      ["750ML", 11400, ["best"]],
      ["5LT", 34000, ["value"]],
      ["20LT", 128000, ["bulk"]],
    ],
  },
  {
    brandId: "brd_multix",
    categoryId: "cat_housekeeping",
    family: "Multipurpose Detergent",
    variant: "Lime Fresh",
    tone: "lime",
    featured: true,
    description:
      "The same multipurpose strength with a sharper lime fragrance. Safe on sealed floors, tiles and painted surfaces.",
    sizes: [
      ["750ML", 12000],
      ["5LT", 41600, ["best"]],
      ["20LT", 101200, ["bulk"]],
    ],
  },
  {
    brandId: "brd_multix",
    categoryId: "cat_housekeeping",
    family: "Multipurpose Detergent",
    variant: "Orange Fresh",
    tone: "amber",
    description: "A warm citrus multipurpose cleaner for kitchens and living areas.",
    sizes: [
      ["5LT", 42000],
      ["20LT", 124000, ["bulk"]],
    ],
  },
  {
    brandId: "brd_chapchap",
    categoryId: "cat_housekeeping",
    family: "Dishwashing Liquid",
    variant: "Lemon",
    tone: "amber",
    featured: true,
    description:
      "Concentrated dishwashing liquid that lifts oil on the first wash. A little goes a long way, so one bottle lasts.",
    sizes: [
      ["750ML", 7400, ["best"]],
      ["5LT", 29800, ["value"]],
      ["20LT", 96000, ["bulk"]],
    ],
  },
  {
    brandId: "brd_chapchap",
    categoryId: "cat_housekeeping",
    family: "Dishwashing Liquid",
    variant: "Green Apple",
    tone: "lime",
    description: "The same fast-cutting formula with a fresh green apple fragrance.",
    sizes: [["750ML", 7800, ["fresh"]]],
  },
  {
    brandId: "brd_quack",
    categoryId: "cat_washroom",
    family: "Toilet Cleaner",
    variant: "Pine Blast",
    tone: "green",
    featured: true,
    description:
      "Thick toilet cleaner that clings to the bowl, removes stains and limescale, and leaves a clean pine finish.",
    sizes: [
      ["1LT", 9600, ["best"]],
      ["5LT", 30000, ["value"]],
    ],
  },
  {
    brandId: "brd_vexa",
    categoryId: "cat_washroom",
    family: "Scouring Powder",
    variant: "Lemon",
    tone: "amber",
    featured: true,
    description:
      "Scouring powder for sinks, pots, tiles and stubborn burnt-on marks. Strong on stains, gentle on the surface underneath.",
    sizes: [
      ["250G", 4200, ["best"]],
      ["500G", 9200],
      ["1KG", 16800, ["value"]],
    ],
  },
  {
    brandId: "brd_vexa",
    categoryId: "cat_washroom",
    family: "Scouring Powder",
    variant: "Lavender",
    tone: "violet",
    description: "The same scouring strength with a calmer lavender fragrance for bathrooms.",
    sizes: [
      ["250G", 5800],
      ["500G", 10200],
      ["1KG", 21200],
    ],
  },
  {
    brandId: "brd_vexa",
    categoryId: "cat_washroom",
    family: "Scouring Powder",
    variant: "Orange",
    tone: "amber",
    outOfStock: ["1KG"],
    description: "A citrus scouring powder for kitchens and food-preparation areas.",
    sizes: [["1KG", 19800]],
  },
  {
    brandId: "brd_ozone",
    categoryId: "cat_laundry",
    family: "Liquid Laundry Detergent",
    variant: "White Breeze",
    tone: "sky",
    featured: true,
    description:
      "Liquid laundry detergent for hand and machine wash. Dissolves fully, rinses clean and keeps whites bright wash after wash.",
    sizes: [
      ["750ML", 8000, ["best"]],
      ["1500ML", 17200],
      ["5LT", 48200, ["value"]],
      ["20LT", 138400, ["bulk"]],
    ],
  },
  {
    brandId: "brd_ozone",
    categoryId: "cat_laundry",
    family: "Liquid Laundry Detergent",
    variant: "Ocean Breeze",
    tone: "aqua",
    featured: true,
    description: "A fresh marine fragrance that stays in the fabric long after drying.",
    sizes: [
      ["750ML", 8200],
      ["1500ML", 22000],
      ["5LT", 38400, ["value"]],
    ],
  },
  {
    brandId: "brd_ozone",
    categoryId: "cat_laundry",
    family: "Liquid Laundry Detergent",
    variant: "Pink Breeze",
    tone: "berry",
    description: "A softly perfumed laundry liquid, ideal for bedding and children's clothes.",
    sizes: [
      ["750ML", 8600],
      ["20LT", 102400, ["bulk"]],
    ],
  },
  {
    brandId: "brd_simba",
    categoryId: "cat_vehicle",
    family: "Car Wash Shampoo",
    variant: "Original",
    tone: "slate",
    featured: true,
    description:
      "High-foam car shampoo that lifts road dust and grime without stripping wax. Rinses off without streaking.",
    sizes: [
      ["1LT", 22200, ["best"]],
      ["5LT", 39200, ["value"]],
      ["20LT", 98800, ["bulk"]],
    ],
  },
];

function buildProducts(): Product[] {
  const out: Product[] = [];
  let n = 0;

  for (const seed of families) {
    const brand = brands.find((b) => b.id === seed.brandId);
    if (!brand) continue;

    const familyId = `fam_${brand.slug}-${slugify(`${seed.family} ${seed.variant}`)}`;

    for (const [packSize, price, badgeKeys] of seed.sizes) {
      n += 1;
      const sku = `EP-${String(n).padStart(4, "0")}`;
      out.push({
        id: `prd_${sku.toLowerCase()}`,
        sku,
        slug: `${brand.slug}-${slugify(`${seed.family} ${seed.variant} ${packSize}`)}`,
        brandId: brand.id,
        supplierId: "sup_ecoplus",
        categoryId: seed.categoryId,
        familyId,
        family: seed.family,
        variant: seed.variant,
        packSize,
        packType: packTypeFor(packSize),
        price,
        description: seed.description,
        badges: (badgeKeys ?? []).map((k) => BADGE[k]).filter(Boolean),
        inStock: !(seed.outOfStock ?? []).includes(packSize),
        featured: Boolean(seed.featured) && (badgeKeys ?? []).includes("best"),
        tone: seed.tone,
      });
    }
  }

  return out;
}

export const products: Product[] = buildProducts();
