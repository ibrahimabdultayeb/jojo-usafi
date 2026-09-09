/**
 * Fake development fixtures, scoped to one test run.
 *
 * Everything here is invented and obviously so. Nothing in this file is a real
 * price, a real customer, a real order or a real delivery zone — the whole
 * point of `supabase/seed.sql` refusing to seed business data is that unreal
 * figures must never appear on the admin dashboard's revenue tiles.
 *
 * Every identifier carries THIS RUN'S token (see `run-context.ts`), so teardown
 * can delete exactly the rows this run created and nothing else. It never
 * matches on a role, an action, a business state or a shared email domain.
 *
 * The shelf built here is deliberately awkward, because the interesting cases
 * are the ones RLS gets wrong:
 *
 *   ...-P1  active, visible, photographed   → public, and on the shelf
 *   ...-P2  active but switched off         → not public
 *   ...-P3  active and visible, NO photo    → readable, but NOT on the shelf
 *
 * P3 is the one that proves the row policy and the view are different rules:
 * `products_public_read` does not require a photograph — it cannot, or the
 * policy on product_media could never let the first photograph become visible —
 * while `product_shelf` does.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/supabase/types";
import { serviceClient, testPassword } from "./support";
import { namesFor, readManifest } from "./run-context";

type Service = SupabaseClient<Database>;

/** This run's identity. Read once, at import, from the manifest globalSetup wrote. */
export const NAMES = namesFor(readManifest().token);

export const ID = {
  supplier: NAMES.uuid(1),
  brand: NAMES.uuid(2),
  brandInactive: NAMES.uuid(3),
  category: NAMES.uuid(4),
  mediaP1: NAMES.uuid(5),
  mediaP2: NAMES.uuid(6),
  mediaLoose: NAMES.uuid(7),
  family: NAMES.uuid(8),
  familyDraft: NAMES.uuid(9),
  productPublic: NAMES.uuid(10),
  productHidden: NAMES.uuid(11),
  productNoPhoto: NAMES.uuid(12),
  zone: NAMES.uuid(13),
  customer: NAMES.uuid(14),
  order: NAMES.uuid(15),
  orderItem: NAMES.uuid(16),
  orderEvent: NAMES.uuid(17),
  optionValue: NAMES.uuid(18),
  profileManager: NAMES.uuid(19),
  profileStaff: NAMES.uuid(20),
} as const;

export const SKU = {
  public: NAMES.sku("P1"),
  hidden: NAMES.sku("P2"),
  noPhoto: NAMES.sku("P3"),
  /** Used by constraint tests that expect the insert to be refused. */
  temp: NAMES.sku("TMP"),
  renamed: NAMES.sku("P3B"),
} as const;

export const EMAIL = {
  owner: NAMES.email("owner"),
  manager: NAMES.email("manager"),
  staff: NAMES.email("staff"),
  /** Signed in, but not staff and not a customer: a stranger with a token. */
  nobody: NAMES.email("nobody"),
} as const;

export const TEST_PHONE = NAMES.phone;
export const ANALYTICS_SESSION = NAMES.session;

/** The image path prefix this run owns inside the Storage buckets. */
export const STORAGE_PREFIX = NAMES.storagePrefix;

/* ------------------------------------------------------------------ helpers */

/** Throw with the database's own words rather than a bare `false`. */
function ok(label: string, error: { message: string; details?: string | null } | null): void {
  if (error) {
    throw new Error(`fixture "${label}" failed: ${error.message}${error.details ? ` — ${error.details}` : ""}`);
  }
}

/* ------------------------------------------------------------------- build */

export async function createFixtures(): Promise<void> {
  const db: Service = serviceClient();

  ok(
    "supplier",
    (
      await db.from("suppliers").insert({
        id: ID.supplier,
        code: NAMES.code("SUP"),
        name: `ZZ${NAMES.token} Supplier`,
        active: true,
      })
    ).error,
  );

  ok(
    "brands",
    (
      await db.from("brands").insert([
        {
          id: ID.brand,
          code: NAMES.code("BR"),
          slug: NAMES.slug("brand"),
          name: `ZZ${NAMES.token} Brand`,
          supplier_id: ID.supplier,
          active: true,
        },
        {
          id: ID.brandInactive,
          code: NAMES.code("BR2"),
          slug: NAMES.slug("brand-inactive"),
          name: `ZZ${NAMES.token} Brand Inactive`,
          supplier_id: null,
          active: false,
        },
      ])
    ).error,
  );

  ok(
    "category",
    (
      await db.from("categories").insert({
        id: ID.category,
        code: NAMES.code("CAT"),
        slug: NAMES.slug("category"),
        name: `ZZ${NAMES.token} Category`,
        active: true,
      })
    ).error,
  );

  ok(
    "media",
    (
      await db.from("media_assets").insert([
        {
          id: ID.mediaP1,
          storage_bucket: "product-media",
          storage_path: `${STORAGE_PREFIX}/p1-primary-1.webp`,
          alt_text: "fixture product one",
        },
        {
          id: ID.mediaP2,
          storage_bucket: "product-media",
          storage_path: `${STORAGE_PREFIX}/p2-primary-1.webp`,
          alt_text: "fixture product two",
        },
        {
          // Attached to nothing. A shopper must never be able to read it.
          id: ID.mediaLoose,
          storage_bucket: "product-media",
          storage_path: `${STORAGE_PREFIX}/unattached.webp`,
          alt_text: "fixture unattached",
        },
      ])
    ).error,
  );

  ok(
    "families",
    (
      await db.from("product_families").insert([
        {
          id: ID.family,
          code: NAMES.code("FAM"),
          slug: NAMES.slug("family"),
          brand_id: ID.brand,
          category_id: ID.category,
          name: `ZZ${NAMES.token} Family`,
          lifecycle: "active",
        },
        {
          id: ID.familyDraft,
          code: NAMES.code("FAM2"),
          slug: NAMES.slug("family-draft"),
          brand_id: ID.brand,
          category_id: ID.category,
          name: `ZZ${NAMES.token} Family Draft`,
          lifecycle: "draft",
        },
      ])
    ).error,
  );

  // Every object in a bulk insert must carry the SAME keys. PostgREST unions
  // the keys across the array and sends an explicit NULL for any a row is
  // missing, which defeats the column's DEFAULT — `low_stock_threshold` is
  // `not null default 0`, so a row that simply omitted it failed the not-null
  // constraint rather than defaulting. Spelling every column out avoids it.
  type ProductInsert = TablesInsert<"products">;
  const product = (
    over: Pick<ProductInsert, "id" | "sku" | "slug" | "display_name" | "price_tzs"> &
      Partial<ProductInsert>,
  ): ProductInsert => ({
    family_id: ID.family,
    brand_id: ID.brand,
    category_id: ID.category,
    pack_size_label: null,
    lifecycle: "active",
    storefront_visible: false,
    low_stock_threshold: 0,
    ...over,
  });

  ok(
    "products",
    (
      await db.from("products").insert([
        product({
          id: ID.productPublic,
          sku: SKU.public,
          slug: NAMES.slug("p1"),
          display_name: `ZZ${NAMES.token} Product One`,
          pack_size_label: "5LT",
          price_tzs: 10_000,
          storefront_visible: true,
          low_stock_threshold: 2,
        }),
        product({
          id: ID.productHidden,
          sku: SKU.hidden,
          slug: NAMES.slug("p2"),
          display_name: `ZZ${NAMES.token} Product Two`,
          price_tzs: 20_000,
          storefront_visible: false,
        }),
        product({
          id: ID.productNoPhoto,
          sku: SKU.noPhoto,
          slug: NAMES.slug("p3"),
          display_name: `ZZ${NAMES.token} Product Three`,
          price_tzs: 30_000,
          storefront_visible: true,
        }),
      ])
    ).error,
  );

  ok(
    "product_media",
    (
      await db.from("product_media").insert([
        { product_id: ID.productPublic, media_id: ID.mediaP1, role: "primary" },
        { product_id: ID.productHidden, media_id: ID.mediaP2, role: "primary" },
      ])
    ).error,
  );

  ok(
    "product_content",
    (
      await db.from("product_content").insert([
        { product_id: ID.productPublic, locale: "en", name: `ZZ${NAMES.token} Product One` },
        { product_id: ID.productHidden, locale: "en", name: `ZZ${NAMES.token} Product Two` },
      ])
    ).error,
  );

  // The variant model, on the axes the migrations seeded rather than new ones.
  const { data: sizeAxis, error: axisError } = await db
    .from("product_option_axes")
    .select("id")
    .eq("code", "size")
    .single();
  ok("size axis lookup", axisError);
  const sizeAxisId = sizeAxis!.id;

  ok(
    "option value",
    (
      await db.from("product_option_values").insert({
        id: ID.optionValue,
        axis_id: sizeAxisId,
        code: NAMES.slug("5lt"),
        label: `ZZ${NAMES.token} 5LT`,
        numeric_rank: 5000,
      })
    ).error,
  );
  ok(
    "family axis",
    (await db.from("product_family_axes").insert({ family_id: ID.family, axis_id: sizeAxisId })).error,
  );
  ok(
    "option assignment",
    (
      await db.from("product_option_assignments").insert({
        product_id: ID.productPublic,
        axis_id: sizeAxisId,
        value_id: ID.optionValue,
      })
    ).error,
  );

  // Stock. P1's running total is matched by its ledger; P2's deliberately is
  // not, so `inventory_ledger_check` has both a true and a false row to find.
  ok(
    "inventory",
    (
      await db.from("inventory").insert([
        { product_id: ID.productPublic, location_code: "main", on_hand: 10, reserved: 3 },
        { product_id: ID.productHidden, location_code: "main", on_hand: 5, reserved: 0 },
      ])
    ).error,
  );

  ok(
    "delivery zone",
    (
      await db.from("delivery_zones").insert({
        id: ID.zone,
        slug: NAMES.slug("zone"),
        name: `ZZ${NAMES.token} Zone`,
        fee_tzs: 4000,
        active: true,
      })
    ).error,
  );

  ok(
    "customer",
    (
      await db.from("customers").insert({
        id: ID.customer,
        phone_e164: TEST_PHONE,
        phone_display: "fixture",
        full_name: `ZZ${NAMES.token} Customer`,
      })
    ).error,
  );

  ok(
    "order",
    (
      await db.from("orders").insert({
        id: ID.order,
        customer_id: ID.customer,
        customer_name: `ZZ${NAMES.token} Customer`,
        customer_phone_e164: TEST_PHONE,
        delivery_zone_id: ID.zone,
        delivery_zone_name: `ZZ${NAMES.token} Zone`,
        delivery_address: "fixture address",
        delivery_fee_tzs: 4000,
        subtotal_tzs: 20_000,
        discount_tzs: 0,
        total_tzs: 24_000,
        payment_preference: "cash_on_delivery",
        state: "new",
      })
    ).error,
  );

  ok(
    "order item",
    (
      await db.from("order_items").insert({
        id: ID.orderItem,
        order_id: ID.order,
        product_id: ID.productPublic,
        sku: SKU.public,
        product_name: `ZZ${NAMES.token} Product One`,
        pack_size_label: "5LT",
        quantity: 2,
        unit_price_tzs: 10_000,
        line_total_tzs: 20_000,
      })
    ).error,
  );

  ok(
    "order event",
    (
      await db.from("order_events").insert({
        id: ID.orderEvent,
        order_id: ID.order,
        kind: "order_created",
        to_state: "new",
        actor_type: "system",
        summary: "fixture order created",
      })
    ).error,
  );

  // The ledger that makes P1's running total add up: 10 received, 3 reserved
  // against the order above.
  ok(
    "inventory movements",
    (
      await db.from("inventory_movements").insert([
        {
          product_id: ID.productPublic,
          location_code: "main",
          kind: "receipt",
          on_hand_delta: 10,
          reserved_delta: 0,
          reference: "fixture receipt",
        },
        {
          product_id: ID.productPublic,
          location_code: "main",
          kind: "reservation",
          on_hand_delta: 0,
          reserved_delta: 3,
          order_id: ID.order,
        },
      ])
    ).error,
  );

  await createLogins(db);
}

/* ------------------------------------------------------------------ logins */

async function createLogins(db: Service): Promise<void> {
  const password = testPassword();

  for (const email of Object.values(EMAIL)) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`could not create login ${email}: ${error.message}`);
    if (!data.user) throw new Error(`no user returned for ${email}`);
  }

  const ids = await loginIds(db);

  // The Owner profile is NOT created here. `ensureOwnerProfile()` adds it when a
  // test needs to act as an Owner — as a SECOND Owner alongside Jojo Usafi's
  // real one, which no test may touch.
  ok(
    "staff profiles",
    (
      await db.from("admin_profiles").insert([
        {
          id: ID.profileManager,
          auth_user_id: ids[EMAIL.manager],
          full_name: `ZZ${NAMES.token} Manager`,
          email: EMAIL.manager,
          role: "manager",
          active: true,
        },
        {
          id: ID.profileStaff,
          auth_user_id: ids[EMAIL.staff],
          full_name: `ZZ${NAMES.token} Order Staff`,
          email: EMAIL.staff,
          role: "order_staff",
          active: true,
        },
      ])
    ).error,
  );
}

/** Auth user ids for this run's fixture logins, keyed by email. */
export async function loginIds(db: Service = serviceClient()): Promise<Record<string, string>> {
  const wanted = new Set<string>(Object.values(EMAIL));
  const found: Record<string, string> = {};

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`could not list logins: ${error.message}`);
    for (const user of data.users) {
      if (user.email && wanted.has(user.email)) found[user.email] = user.id;
    }
    if (data.users.length < 200) break;
  }

  return found;
}

/**
 * Give THIS RUN's owner login an active Owner profile.
 *
 * A second Owner is legitimate — the last-Owner trigger protects the last one,
 * not the only one — and it is the only way a test can act as an Owner without
 * borrowing Jojo Usafi's real one. This never inspects, alters or depends on
 * that real row.
 */
export async function ensureOwnerProfile(): Promise<void> {
  const db = serviceClient();

  const { data: existing } = await db
    .from("admin_profiles")
    .select("id, role, active")
    .eq("email", EMAIL.owner)
    .maybeSingle();

  if (existing) {
    if (existing.role !== "owner" || !existing.active) {
      ok(
        "owner profile restore",
        (
          await db
            .from("admin_profiles")
            .update({ role: "owner", active: true })
            .eq("id", existing.id)
        ).error,
      );
    }
    return;
  }

  const ids = await loginIds(db);
  ok(
    "owner profile",
    (
      await db.from("admin_profiles").insert({
        auth_user_id: ids[EMAIL.owner],
        full_name: `ZZ${NAMES.token} Owner`,
        email: EMAIL.owner,
        role: "owner",
        active: true,
      })
    ).error,
  );
}
