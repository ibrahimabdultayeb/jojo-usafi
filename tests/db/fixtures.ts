/**
 * Fake development fixtures.
 *
 * Everything here is invented and obviously so. Nothing in this file is a real
 * price, a real customer, a real order or a real delivery zone — the whole
 * point of `supabase/seed.sql` refusing to seed business data is that unreal
 * figures must never appear on the admin dashboard's revenue tiles. These rows
 * exist for the length of one test run and are then removed.
 *
 * Every identifier starts `ZZTEST` / `zztest` / `aa000000-`, so anything left
 * behind by a crashed run is unmistakable and the teardown can find it with a
 * pattern rather than a list.
 *
 * The shelf built here is deliberately awkward, because the interesting cases
 * are the ones RLS gets wrong:
 *
 *   ZZTEST-P1  active, visible, photographed   → public, and on the shelf
 *   ZZTEST-P2  active but switched off         → not public
 *   ZZTEST-P3  active and visible, NO photo    → readable, but NOT on the shelf
 *
 * P3 is the one that proves the row policy and the view are different rules:
 * `products_public_read` does not require a photograph — it cannot, or the
 * policy on product_media could never let the first photograph become visible —
 * while `product_shelf` does.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/supabase/types";
import { serviceClient, testPassword } from "./support";

type Service = SupabaseClient<Database>;

const u = (tail: string) => `aa000000-0000-4000-8000-${tail.padStart(12, "0")}`;

export const ID = {
  supplier: u("1"),
  brand: u("2"),
  brandInactive: u("3"),
  category: u("4"),
  mediaP1: u("5"),
  mediaP2: u("6"),
  mediaLoose: u("7"),
  family: u("8"),
  familyDraft: u("9"),
  productPublic: u("a"),
  productHidden: u("b"),
  productNoPhoto: u("c"),
  zone: u("d"),
  customer: u("e"),
  order: u("f"),
  orderItem: u("10"),
  orderEvent: u("11"),
  optionValue: u("12"),
  profileManager: u("13"),
  profileStaff: u("14"),
} as const;

export const SKU = {
  public: "ZZTEST-P1",
  hidden: "ZZTEST-P2",
  noPhoto: "ZZTEST-P3",
} as const;

export const EMAIL = {
  owner: "zztest-owner@jojo-usafi.test",
  manager: "zztest-manager@jojo-usafi.test",
  staff: "zztest-staff@jojo-usafi.test",
  /** Signed in, but not staff and not a customer: a stranger with a token. */
  nobody: "zztest-nobody@jojo-usafi.test",
} as const;

export const TEST_PHONE = "+255700000001";
export const ANALYTICS_SESSION = "zztest-session";

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
        code: "ZZTEST-SUP",
        name: "ZZTEST Supplier",
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
          code: "ZZTEST-BR",
          slug: "zztest-brand",
          name: "ZZTEST Brand",
          supplier_id: ID.supplier,
          active: true,
        },
        {
          id: ID.brandInactive,
          code: "ZZTEST-BR2",
          slug: "zztest-brand-inactive",
          name: "ZZTEST Brand Inactive",
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
        code: "ZZTEST-CAT",
        slug: "zztest-category",
        name: "ZZTEST Category",
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
          storage_path: "zztest/zztest-p1-primary-1.webp",
          alt_text: "ZZTEST product one",
        },
        {
          id: ID.mediaP2,
          storage_bucket: "product-media",
          storage_path: "zztest/zztest-p2-primary-1.webp",
          alt_text: "ZZTEST product two",
        },
        {
          // Attached to nothing. A shopper must never be able to read it.
          id: ID.mediaLoose,
          storage_bucket: "product-media",
          storage_path: "zztest/zztest-unattached.webp",
          alt_text: "ZZTEST unattached",
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
          code: "ZZTEST-FAM",
          slug: "zztest-family",
          brand_id: ID.brand,
          category_id: ID.category,
          name: "ZZTEST Family",
          lifecycle: "active",
        },
        {
          id: ID.familyDraft,
          code: "ZZTEST-FAM2",
          slug: "zztest-family-draft",
          brand_id: ID.brand,
          category_id: ID.category,
          name: "ZZTEST Family Draft",
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
          slug: "zztest-p1",
          display_name: "ZZTEST Product One",
          pack_size_label: "5LT",
          price_tzs: 10_000,
          storefront_visible: true,
          low_stock_threshold: 2,
        }),
        product({
          id: ID.productHidden,
          sku: SKU.hidden,
          slug: "zztest-p2",
          display_name: "ZZTEST Product Two",
          price_tzs: 20_000,
          storefront_visible: false,
        }),
        product({
          id: ID.productNoPhoto,
          sku: SKU.noPhoto,
          slug: "zztest-p3",
          display_name: "ZZTEST Product Three",
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
        { product_id: ID.productPublic, locale: "en", name: "ZZTEST Product One" },
        { product_id: ID.productHidden, locale: "en", name: "ZZTEST Product Two" },
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
        code: "zztest-5lt",
        label: "ZZTEST 5LT",
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
        slug: "zztest-zone",
        name: "ZZTEST Zone",
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
        phone_display: "0700 000 001",
        full_name: "ZZTEST Customer",
      })
    ).error,
  );

  ok(
    "order",
    (
      await db.from("orders").insert({
        id: ID.order,
        customer_id: ID.customer,
        customer_name: "ZZTEST Customer",
        customer_phone_e164: TEST_PHONE,
        delivery_zone_id: ID.zone,
        delivery_zone_name: "ZZTEST Zone",
        delivery_address: "ZZTEST address",
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
        product_name: "ZZTEST Product One",
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
        summary: "ZZTEST order created",
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
          reference: "ZZTEST receipt",
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

  // The Owner profile is NOT created here. tests/db/02-auth.test.ts proves the
  // first-Owner bootstrap by having the Owner login claim the seat itself,
  // which is the only way to prove the bootstrap actually works.
  ok(
    "staff profiles",
    (
      await db.from("admin_profiles").insert([
        {
          id: ID.profileManager,
          auth_user_id: ids[EMAIL.manager],
          full_name: "ZZTEST Manager",
          email: EMAIL.manager,
          role: "manager",
          active: true,
        },
        {
          id: ID.profileStaff,
          auth_user_id: ids[EMAIL.staff],
          full_name: "ZZTEST Order Staff",
          email: EMAIL.staff,
          role: "order_staff",
          active: true,
        },
      ])
    ).error,
  );
}

/** Auth user ids for the fixture logins, keyed by email. */
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
 * Make sure an active Owner profile exists, whatever order the test files ran
 * in. `02-auth.test.ts` creates it the honest way, by claiming the seat; this
 * exists so that running a later file on its own still has an Owner to sign in
 * as. It is a no-op once the seat is taken.
 */
export async function ensureOwnerProfile(): Promise<void> {
  const db = serviceClient();
  const { data: existing } = await db
    .from("admin_profiles")
    .select("id")
    .eq("role", "owner")
    .eq("active", true)
    .limit(1);

  if (existing && existing.length > 0) return;

  const ids = await loginIds(db);
  ok(
    "owner profile",
    (
      await db.from("admin_profiles").insert({
        auth_user_id: ids[EMAIL.owner],
        full_name: "ZZTEST Owner",
        email: EMAIL.owner,
        role: "owner",
        active: true,
      })
    ).error,
  );
}
