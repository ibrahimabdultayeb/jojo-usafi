/**
 * Build 10's settings and the promises made around the Owner seat.
 *
 * Two subjects, one file, because they share the one awkward property: the row
 * under test is REAL. There is exactly one `shop_settings` row for the shop, so
 * these tests cannot invent a fixture copy the way every other suite does.
 *
 * THE RULE THAT FOLLOWS FROM THAT: the whole row is read before anything is
 * written and written back afterwards, column for column, in `afterAll` — and
 * the restore is asserted, not assumed. A test that leaves the shop's homepage
 * saying something a test wrote would be worse than no test at all.
 *
 * Nothing here touches the real Owner. The last-Owner guarantee is exercised in
 * `02-auth.test.ts` inside a transaction that always rolls back; what is proved
 * here is the layer above it — who is even permitted to try.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, errorOf, serviceClient, signIn, PG } from "./support";
import { EMAIL, ID, NAMES, ensureOwnerProfile } from "./fixtures";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

const db = serviceClient();
const anon = anonClient();

let owner: SupabaseClient<Database>;
let manager: SupabaseClient<Database>;
let staff: SupabaseClient<Database>;

/** Every column this file may write, captured before it writes any of them. */
const WRITTEN_COLUMNS = [
  "announcement_en",
  "announcement_sw",
  "show_announcement",
  "hero_heading_en",
  "hero_heading_sw",
  "hero_sub_en",
  "hero_sub_sw",
  "hero_cta_label_en",
  "hero_cta_label_sw",
  "hero_cta_href",
  "promo_banner_en",
  "promo_banner_sw",
  "promo_banner_visible",
  "show_categories",
  "show_best_sellers",
  "show_featured",
  "show_category_grids",
  "show_trust",
  "show_delivery_banner",
  "show_brands",
  "show_how_it_works",
  "whatsapp_e164",
  "phone_e164",
  "contact_email",
  "address_line",
  "reservation_warning_minutes",
  "reservation_expiry_minutes",
] as const;

type SettingsRow = Tables<"shop_settings">;
type WrittenColumn = (typeof WRITTEN_COLUMNS)[number];

let before: Pick<SettingsRow, WrittenColumn>;

async function readSettings(): Promise<Pick<SettingsRow, WrittenColumn>> {
  const { data, error } = await db
    .from("shop_settings")
    .select(WRITTEN_COLUMNS.join(", "))
    .eq("id", true)
    .single();

  if (error || !data) throw new Error(`Could not read shop_settings: ${error?.message}`);
  return data as unknown as Pick<SettingsRow, WrittenColumn>;
}

beforeAll(async () => {
  before = await readSettings();
  await ensureOwnerProfile();
  owner = await signIn(EMAIL.owner);
  manager = await signIn(EMAIL.manager);
  staff = await signIn(EMAIL.staff);
});

afterAll(async () => {
  // Put the shop's own settings back exactly as they were found, and prove it.
  // `before` is a whole-row snapshot, so this restores columns these tests
  // changed and columns they only read alike.
  await db.from("shop_settings").update(before).eq("id", true);
  const after = await readSettings();
  expect(after, "shop_settings was not restored to its pre-test values").toEqual(before);
});

/* ------------------------------------------------------------- who may write */

describe("the shop's own settings belong to the Owner", () => {
  it("lets a shopper READ them, because the storefront is built from them", async () => {
    const { data, error } = await anon
      .from("shop_settings")
      .select("announcement_en, show_announcement, hero_heading_en, show_best_sellers")
      .eq("id", true)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("refuses a shopper who tries to write them", async () => {
    const error = errorOf(
      await anon.from("shop_settings").update({ announcement_en: "hacked" }).eq("id", true),
    );
    expect(error.code).toBe(PG.insufficientPrivilege);
  });

  it("lets the Owner change the homepage words", async () => {
    const words = `ZZ${NAMES.token} free delivery this week`;

    const saved = await owner
      .from("shop_settings")
      .update({ announcement_en: words, hero_heading_en: `ZZ${NAMES.token} Everything clean` })
      .eq("id", true)
      .select("announcement_en, hero_heading_en");

    expect(saved.error).toBeNull();
    expect(saved.data).toHaveLength(1);
    expect(saved.data?.[0].announcement_en).toBe(words);
  });

  it("does not let a Manager change them", async () => {
    // The grant permits the verb; the policy decides the row. A Manager passes
    // the first lock and is stopped by the second, which PostgREST reports as
    // an update that matched nothing rather than as an error.
    const attempt = await manager
      .from("shop_settings")
      .update({ announcement_en: "a manager wrote this" })
      .eq("id", true)
      .select("announcement_en");

    expect(attempt.error).toBeNull();
    expect(attempt.data, "a Manager must not be able to edit shop settings").toEqual([]);
  });

  it("does not let Order staff change them", async () => {
    const attempt = await staff
      .from("shop_settings")
      .update({ show_best_sellers: false })
      .eq("id", true)
      .select("show_best_sellers");

    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);
  });
});

/* ------------------------------------------------- what the row will accept */

describe("the settings row refuses a value that would break the website", () => {
  it("refuses a phone number without its country code", async () => {
    const error = errorOf(
      await db.from("shop_settings").update({ phone_e164: "0712345678" }).eq("id", true),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("accepts a real E.164 number", async () => {
    const saved = await db
      .from("shop_settings")
      .update({ phone_e164: "+255700000001" })
      .eq("id", true)
      .select("phone_e164")
      .single();

    expect(saved.error).toBeNull();
    expect(saved.data?.phone_e164).toBe("+255700000001");
  });

  it("refuses a hero button that points off this website", async () => {
    const error = errorOf(
      await db.from("shop_settings").update({ hero_cta_href: "https://example.invalid" }).eq("id", true),
    );
    expect(error.code).toBe(PG.checkViolation);
  });

  it("accepts a path on this website", async () => {
    const saved = await db
      .from("shop_settings")
      .update({ hero_cta_href: "/shop?category=cleaning" })
      .eq("id", true)
      .select("hero_cta_href")
      .single();

    expect(saved.error).toBeNull();
    expect(saved.data?.hero_cta_href).toBe("/shop?category=cleaning");
  });

  it("keeps the announcement strip on until somebody switches it off", async () => {
    // Migration 0022's default. Blank text means the built-in wording, so the
    // strip needs a switch of its own — this is it.
    const off = await db
      .from("shop_settings")
      .update({ show_announcement: false })
      .eq("id", true)
      .select("show_announcement")
      .single();

    expect(off.data?.show_announcement).toBe(false);

    const on = await db
      .from("shop_settings")
      .update({ show_announcement: true })
      .eq("id", true)
      .select("show_announcement")
      .single();

    expect(on.data?.show_announcement).toBe(true);
  });

  it("treats a cleared field as null rather than as an empty string", async () => {
    // The server action trims and nulls; this proves the column carries the
    // distinction, which is what `getSiteContent` reads as "no instruction".
    const saved = await db
      .from("shop_settings")
      .update({ promo_banner_en: null, promo_banner_sw: null })
      .eq("id", true)
      .select("promo_banner_en, promo_banner_sw")
      .single();

    expect(saved.data?.promo_banner_en).toBeNull();
    expect(saved.data?.promo_banner_sw).toBeNull();
  });
});

/* --------------------------------------------------------------- the seat */

describe("nobody promotes themselves", () => {
  it("does not let Order staff make themselves an Owner", async () => {
    const attempt = await staff
      .from("admin_profiles")
      .update({ role: "owner" })
      .eq("id", ID.profileStaff)
      .select("id, role");

    expect(attempt.error).toBeNull();
    expect(attempt.data, "Order staff must not be able to promote themselves").toEqual([]);

    const { data } = await db
      .from("admin_profiles")
      .select("role")
      .eq("id", ID.profileStaff)
      .single();
    expect(data?.role).toBe("order_staff");
  });

  it("does not let a Manager make themselves an Owner", async () => {
    const attempt = await manager
      .from("admin_profiles")
      .update({ role: "owner" })
      .eq("id", ID.profileManager)
      .select("id, role");

    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);
  });

  it("does not let Order staff switch a colleague off", async () => {
    const attempt = await staff
      .from("admin_profiles")
      .update({ active: false })
      .eq("id", ID.profileManager)
      .select("id");

    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);

    const { data } = await db
      .from("admin_profiles")
      .select("active")
      .eq("id", ID.profileManager)
      .single();
    expect(data?.active).toBe(true);
  });
});

describe("a staff member who has been switched off", () => {
  /**
   * Deactivation has to bite at the database, not only in the dashboard's
   * rendering. The profile row itself stays readable to its owner on purpose:
   * the dashboard must be able to say "your account has been switched off"
   * rather than show an empty screen and leave somebody guessing.
   */
  it("can still read the row that says so, and can do nothing else", async () => {
    await db.from("admin_profiles").update({ active: false }).eq("id", ID.profileStaff);

    try {
      const self = await staff
        .from("admin_profiles")
        .select("id, active")
        .eq("id", ID.profileStaff)
        .maybeSingle();

      expect(self.error).toBeNull();
      expect(self.data?.active, "a deactivated person must still see their own row").toBe(false);

      // And the work stops. Orders are the one thing Order staff may change.
      const advance = await staff
        .from("orders")
        .update({ state: "confirmed" })
        .eq("id", ID.order)
        .select("id");

      expect(advance.error).toBeNull();
      expect(advance.data, "a deactivated person must not be able to move an order").toEqual([]);

      // Nor may they read the shop's customers any more.
      const customers = await staff.from("customers").select("id").limit(5);
      expect(customers.error).toBeNull();
      expect(customers.data).toEqual([]);
    } finally {
      await db.from("admin_profiles").update({ active: true }).eq("id", ID.profileStaff);
    }
  });
});
