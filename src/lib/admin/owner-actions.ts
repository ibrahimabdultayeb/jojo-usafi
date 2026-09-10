"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { authorize } from "./authorize";
import { getServiceRoleSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { site } from "@/lib/site";
import type { Role } from "./permissions";
import type { BusinessSettings, ReservationSettings, WebsiteContent } from "./settings";

/**
 * The things only an Owner does: staff, the shop's own details, and the words
 * on the homepage.
 *
 * Every one goes through `authorize()` first and is refused a second time by
 * Row Level Security, which admits only an Owner to `admin_profiles` and
 * `shop_settings`. The two checks are deliberate: this one produces a sentence,
 * and the database one produces the guarantee.
 */

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
}

const failed = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });

/* ------------------------------------------------------------------ staff */

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  order_staff: "Order staff",
};

/**
 * Invite somebody.
 *
 * Supabase sends the email and owns the credential; nothing here ever sees or
 * sets a password, and none is displayed. The link comes back to
 * `/admin/set-password`, which is the screen that finishes the job.
 *
 * If email is not configured on the project the invitation still creates the
 * staff record, and the report says so — the person can then ask for their own
 * link from the sign-in screen, which reaches exactly the same place. A
 * half-done job described accurately beats a whole one claimed falsely.
 */
export async function inviteStaffAction(
  name: string,
  email: string,
  role: Role,
): Promise<ActionResult> {
  const auth = await authorize("staff.manage");
  if (!auth.ok) return failed(auth.message);

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) return failed("Give the person a name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return failed("That is not an email address.");

  // An Owner is never created by invitation. The first one is claimed through
  // the bootstrap, and any further one is a deliberate promotion of somebody
  // who already works here.
  if (role === "owner") {
    return failed("Invite the person as a Manager or Order staff first, then change their role.");
  }

  const db = getServiceRoleSupabase();

  const { data: existing } = await db
    .from("admin_profiles")
    .select("id, active")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existing) {
    return failed(
      existing.active
        ? "Somebody with that email address already works here."
        : "That email address belongs to a switched-off account. Switch it back on instead.",
    );
  }

  let authUserId: string | null = null;
  let emailed = false;

  const invited = await db.auth.admin.inviteUserByEmail(cleanEmail, {
    data: { invited_as: role, invited_by: auth.staff.name },
    // Where the link in the email comes back to. Without it Supabase uses the
    // project's Site URL, which is whatever was configured last — and on a
    // deployment that is usually still somebody's laptop.
    redirectTo: `${site.url}/admin/set-password`,
  });

  if (invited.data?.user) {
    authUserId = invited.data.user.id;
    emailed = true;
  } else {
    // Most often: this project has no email sender configured. The staff record
    // is still worth creating — the Owner can share the sign-in link and the
    // person can set a password through the ordinary reset flow.
    const created = await db.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: false,
      user_metadata: { invited_as: role, invited_by: auth.staff.name },
    });
    if (created.data?.user) authUserId = created.data.user.id;
  }

  const { error } = await db.from("admin_profiles").insert({
    auth_user_id: authUserId,
    full_name: cleanName,
    email: cleanEmail,
    role,
    active: true,
    invited_at: new Date().toISOString(),
  });

  if (error) return failed(`They could not be added: ${error.message}`);

  revalidatePath("/admin/more/staff");

  // Both halves of this are true, and they are different situations.
  //
  // The email went: the person follows the link and chooses a password. The
  // email did not go — most often because this Supabase project has no email
  // sender configured — and the account still exists, so they can ask for a
  // link themselves from the sign-in screen. Saying which happened is the
  // difference between the Owner waiting and the Owner making a phone call.
  return done(
    emailed
      ? `${cleanName} has been invited as ${ROLE_LABEL[role]}. They will get an email with a link to choose a password.`
      : `${cleanName} has been added as ${ROLE_LABEL[role]}, but no email could be sent. Ask them to open the sign-in page and use "Set or reset your password".`,
  );
}

export async function changeStaffRoleAction(staffId: string, role: Role): Promise<ActionResult> {
  const auth = await authorize("staff.manage");
  if (!auth.ok) return failed(auth.message);

  // Written through the CALLER'S session so the Owner-only policy is the thing
  // that decides, not this function. A Manager who reached here is refused by
  // PostgreSQL, and the row count says so.
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("admin_profiles")
    .update({ role })
    .eq("id", staffId)
    .select("id, full_name");

  if (error) {
    // The last-Owner trigger speaks plainly enough to pass straight through.
    return failed(error.message);
  }
  if (!data || data.length === 0) {
    return failed("That change was not allowed.");
  }

  revalidatePath("/admin/more/staff");
  return done(`${data[0].full_name} is now ${ROLE_LABEL[role]}.`);
}

export async function setStaffActiveAction(staffId: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("staff.manage");
  if (!auth.ok) return failed(auth.message);

  if (staffId === auth.staff.adminId && !active) {
    return failed("You cannot switch off your own account.");
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("admin_profiles")
    .update({ active })
    .eq("id", staffId)
    .select("id, full_name");

  if (error) return failed(error.message);
  if (!data || data.length === 0) return failed("That change was not allowed.");

  revalidatePath("/admin/more/staff");
  return done(
    active
      ? `${data[0].full_name} can use the dashboard again.`
      : `${data[0].full_name} can no longer sign in.`,
  );
}

/* --------------------------------------------------------------- settings */

export async function saveWebsiteAction(content: WebsiteContent): Promise<ActionResult> {
  const auth = await authorize("website.manage");
  if (!auth.ok) return failed(auth.message);

  const clean = (value: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };

  const href = clean(content.heroCtaHref);
  if (href && !href.startsWith("/")) {
    return failed("The button link has to be a page on this website, starting with /.");
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("shop_settings")
    .update({
      announcement_en: clean(content.announcementEn),
      announcement_sw: clean(content.announcementSw),
      show_announcement: content.showAnnouncement,
      hero_heading_en: clean(content.heroHeadingEn),
      hero_heading_sw: clean(content.heroHeadingSw),
      hero_sub_en: clean(content.heroSubEn),
      hero_sub_sw: clean(content.heroSubSw),
      hero_cta_label_en: clean(content.heroCtaLabelEn),
      hero_cta_label_sw: clean(content.heroCtaLabelSw),
      hero_cta_href: href,
      promo_banner_en: clean(content.promoBannerEn),
      promo_banner_sw: clean(content.promoBannerSw),
      promo_banner_visible: content.promoBannerVisible,
      show_categories: content.showCategories,
      show_best_sellers: content.showBestSellers,
      show_featured: content.showFeatured,
      show_category_grids: content.showCategoryGrids,
      show_trust: content.showTrust,
      show_delivery_banner: content.showDeliveryBanner,
      show_brands: content.showBrands,
      show_how_it_works: content.showHowItWorks,
    })
    .eq("id", true);

  if (error) return failed(`It could not be saved: ${error.message}`);

  // The storefront reads these, and a homepage that is a few minutes behind the
  // person who just edited it reads as broken.
  revalidateTag("catalogue");
  revalidatePath("/", "layout");
  revalidatePath("/admin/more/website");

  return done("Saved. The website is updated.");
}

export async function saveBusinessAction(
  business: BusinessSettings,
  reservation: ReservationSettings,
): Promise<ActionResult> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return failed(auth.message);

  const clean = (value: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };

  const phone = clean(business.phoneE164);
  const whatsapp = clean(business.whatsappE164);
  const shape = /^\+[1-9][0-9]{7,14}$/;

  if (phone && !shape.test(phone)) {
    return failed("The phone number needs its country code, like +255712345678.");
  }
  if (whatsapp && !shape.test(whatsapp)) {
    return failed("The WhatsApp number needs its country code, like +255712345678.");
  }

  const { warningMinutes, expiryMinutes } = reservation;
  if (warningMinutes !== null && warningMinutes <= 0) return failed("The warning time has to be more than zero minutes.");
  if (expiryMinutes !== null && expiryMinutes <= 0) return failed("The expiry time has to be more than zero minutes.");
  if (warningMinutes !== null && expiryMinutes !== null && expiryMinutes < warningMinutes) {
    return failed("Stock cannot be released before the warning. Make the expiry the longer of the two.");
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("shop_settings")
    .update({
      whatsapp_e164: whatsapp,
      phone_e164: phone,
      contact_email: clean(business.contactEmail),
      address_line: clean(business.addressLine),
      reservation_warning_minutes: warningMinutes,
      reservation_expiry_minutes: expiryMinutes,
    })
    .eq("id", true);

  if (error) return failed(`It could not be saved: ${error.message}`);

  revalidateTag("catalogue");
  revalidatePath("/", "layout");
  revalidatePath("/admin/more/settings");

  return done("Saved.");
}
