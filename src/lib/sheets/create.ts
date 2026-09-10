import "server-only";

import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import type { NewProduct } from "./plan";

/**
 * Creating a product the Sheet knows about and the shop does not.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: a new row may create an INTERNAL
 * product record. It may never create a public one. Everything a shopper can
 * see still has to earn its place through `product_shelf` — active, switched
 * on, and photographed — and a brand-new row has no photograph by definition.
 * So a created product is `draft`, invisible, and carries no stock.
 *
 * NOTHING IS GUESSED. A brand, category or family that does not resolve to an
 * existing row stops that product and is reported. The alternative — creating a
 * "Multix " brand beside the real "Multix" because somebody left a trailing
 * space — is how a catalogue quietly grows two of everything.
 */

export type CreateOutcome =
  | { readonly ok: true; readonly sku: string; readonly productId: string; readonly note: string }
  | { readonly ok: false; readonly sku: string; readonly problem: string };

/**
 * How two names are compared: case folded, punctuation-insensitive, and every
 * run of whitespace treated as one space.
 *
 * Deliberately NOT fuzzy. "Multix" and "Multix Ltd" stay different things; only
 * the ways a person accidentally types the SAME name are absorbed.
 */
export function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[‘’“”]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Lookup {
  readonly brands: Map<string, { id: string; name: string }[]>;
  readonly categories: Map<string, { id: string; name: string }[]>;
  readonly families: Map<string, { id: string; code: string }>;
  readonly suppliers: Map<string, { id: string; name: string }[]>;
  readonly slugs: Set<string>;
}

type Service = ReturnType<typeof getServiceRoleSupabase>;

/** Everything a new row might need to point at, read once. */
export async function loadLookups(db: Service): Promise<Lookup> {
  const [brands, categories, families, suppliers, products] = await Promise.all([
    db.from("brands").select("id, name"),
    db.from("categories").select("id, name"),
    db.from("product_families").select("id, code"),
    db.from("suppliers").select("id, name"),
    db.from("products").select("slug"),
  ]);

  const group = <T extends { name: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const key = normaliseName(row.name);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  };

  return {
    brands: group(brands.data ?? []),
    categories: group(categories.data ?? []),
    suppliers: group(suppliers.data ?? []),
    families: new Map(
      (families.data ?? []).map((row) => [row.code.trim().toUpperCase(), row]),
    ),
    slugs: new Set((products.data ?? []).map((row) => row.slug)),
  };
}

/**
 * Resolve one name against existing rows.
 *
 * Three outcomes, and the third is the important one: exactly one match is a
 * resolution, no match is a reported problem, and MORE than one match is also a
 * reported problem. Two brands that normalise to the same name is a catalogue
 * fault somebody has to look at, not a coin to toss.
 */
function resolveOne<T extends { id: string }>(
  map: Map<string, T[]>,
  raw: string | null,
  what: string,
): { id: string } | { problem: string } {
  const value = (raw ?? "").trim();
  if (value === "") return { problem: `This row has no ${what}.` };

  const matches = map.get(normaliseName(value)) ?? [];
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) {
    return {
      problem: `There is no ${what} called "${value}" in Jojo Usafi. Add it first, or correct the spelling in the sheet.`,
    };
  }
  return {
    problem: `"${value}" matches ${matches.length} ${what} records in Jojo Usafi. That has to be sorted out before this product can be added.`,
  };
}

/** A price the catalogue build would have refused. Mirrors the same threshold. */
const IMPLAUSIBLE_PRICE_TZS = 1000;

function uniqueSlug(wanted: string, taken: Set<string>): string {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${wanted}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${wanted}-${Date.now()}`;
}

/**
 * Create the products the plan reported as new. One at a time, because one
 * unresolvable row must not stop the rest.
 */
export async function createNewProducts(
  db: Service,
  candidates: readonly NewProduct[],
): Promise<CreateOutcome[]> {
  if (candidates.length === 0) return [];

  const lookups = await loadLookups(db);
  const outcomes: CreateOutcome[] = [];

  for (const candidate of candidates) {
    const outcome = await createOne(db, candidate, lookups);
    outcomes.push(outcome);
    if (outcome.ok) lookups.slugs.add(candidate.fields.slug);
  }

  return outcomes;
}

async function createOne(
  db: Service,
  candidate: NewProduct,
  lookups: Lookup,
): Promise<CreateOutcome> {
  const { sku, fields, reference } = candidate;
  const refuse = (problem: string): CreateOutcome => ({ ok: false, sku, problem });

  /* -------------------------------------------------------- the price */

  if (!Number.isInteger(fields.priceTzs) || fields.priceTzs <= 0) {
    return refuse("This product has no usable price, so it cannot be added.");
  }
  if (fields.priceTzs < IMPLAUSIBLE_PRICE_TZS) {
    // The same judgement the catalogue build makes, and for the same reason:
    // EP01-A01 at TSh 128 is not a bargain, it is a typo nobody has confirmed.
    return refuse(
      `TSh ${fields.priceTzs} is too low to be a real retail price. It is reported rather than guessed at.`,
    );
  }
  if (fields.offerPriceTzs !== null && fields.offerPriceTzs >= fields.priceTzs) {
    return refuse("The offer price has to be lower than the price.");
  }

  /* ------------------------------------------------ the relationships */

  const brand = resolveOne(lookups.brands, fields.brandName, "brand");
  if ("problem" in brand) return refuse(brand.problem);

  const category = resolveOne(lookups.categories, fields.categoryName, "category");
  if ("problem" in category) return refuse(category.problem);

  const familyCode = (reference.familyCode ?? "").trim().toUpperCase();
  if (familyCode === "") {
    return refuse("This row has no family code, so there is nothing to group it with.");
  }
  const family = lookups.families.get(familyCode);
  if (!family) {
    return refuse(
      `There is no product family with the code "${familyCode}". Families are created deliberately, not by a sync.`,
    );
  }

  // A supplier is internal and optional: not knowing who supplies something is
  // not a reason to refuse to record it.
  let supplierId: string | null = null;
  if ((reference.supplierName ?? "").trim() !== "") {
    const supplier = resolveOne(lookups.suppliers, reference.supplierName, "supplier");
    if ("problem" in supplier) return refuse(supplier.problem);
    supplierId = supplier.id;
  }

  /* -------------------------------------------------------- the write */

  const slug = uniqueSlug(fields.slug, lookups.slugs);

  const { data, error } = await db
    .from("products")
    .insert({
      sku,
      slug,
      family_id: family.id,
      brand_id: brand.id,
      category_id: category.id,
      supplier_id: supplierId,
      display_name: fields.displayName,
      variant_label: fields.variantLabel,
      pack_size_label: fields.packSizeLabel,
      ean: fields.ean,
      itf14: fields.itf14,
      price_tzs: fields.priceTzs,
      offer_price_tzs: fields.offerPriceTzs,
      low_stock_threshold: fields.lowStockThreshold,
      sort_priority: fields.sortPriority,
      best_seller: fields.bestSeller,
      featured: fields.featured,
      // NOT the sheet's lifecycle, and NOT the sheet's visibility. A product
      // nobody has looked at is a draft, whatever the row says — and it has no
      // photograph, so it could not reach the shelf even if it were active.
      lifecycle: "draft",
      storefront_visible: false,
    })
    .select("id")
    .single();

  if (error) {
    return refuse(
      error.code === "23505"
        ? `${sku} already exists in Jojo Usafi.`
        : `It could not be added: ${error.message}`,
    );
  }

  /* ------------------------------------------------- the empty shelf */

  // An inventory row at zero, so the product has somewhere for stock to arrive.
  // Zero is the only honest opening figure: the sync has no idea what is in the
  // store, and the Sheet's stock column is not authoritative.
  const { error: stockError } = await db
    .from("inventory")
    .insert({ product_id: data.id, location_code: "main", on_hand: 0, reserved: 0 });

  if (stockError && stockError.code !== "23505") {
    return refuse(`It was added, but its stock record failed: ${stockError.message}`);
  }

  if (fields.description) {
    await db.from("product_content").insert({
      product_id: data.id,
      locale: "en",
      name: fields.displayName,
      description: fields.description,
    });
  }

  return {
    ok: true,
    sku,
    productId: data.id,
    note: "Added as a draft. It needs an approved photograph before it can go on the website.",
  };
}
