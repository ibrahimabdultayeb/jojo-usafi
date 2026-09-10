import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The shop's own settings: the words on the homepage, and how to reach the shop.
 *
 * Read through the caller's session. `shop_settings` is publicly readable —
 * the storefront needs the announcement and the hero — and writable only by an
 * Owner, which is a policy in the database rather than a check here.
 *
 * EVERY CONTACT FIELD STARTS NULL AND STAYS NULL UNTIL IBRAHIM PROVIDES IT.
 * A phone number that reaches nobody is worse than a visibly missing one: the
 * missing one gets fixed before launch, the plausible one gets discovered by a
 * customer.
 */

export interface WebsiteContent {
  announcementEn: string | null;
  announcementSw: string | null;
  showAnnouncement: boolean;
  heroHeadingEn: string | null;
  heroHeadingSw: string | null;
  heroSubEn: string | null;
  heroSubSw: string | null;
  heroCtaLabelEn: string | null;
  heroCtaLabelSw: string | null;
  heroCtaHref: string | null;
  promoBannerEn: string | null;
  promoBannerSw: string | null;
  promoBannerVisible: boolean;
  showCategories: boolean;
  showBestSellers: boolean;
  showFeatured: boolean;
  showCategoryGrids: boolean;
  showTrust: boolean;
  showDeliveryBanner: boolean;
  showBrands: boolean;
  showHowItWorks: boolean;
  categoryOrder: string[] | null;
}

export interface BusinessSettings {
  whatsappE164: string | null;
  phoneE164: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  logoMediaId: string | null;
}

export interface ReservationSettings {
  warningMinutes: number | null;
  expiryMinutes: number | null;
}

export interface ShopSettings {
  website: WebsiteContent;
  business: BusinessSettings;
  reservation: ReservationSettings;
}

const SELECT = `
  announcement_en, announcement_sw, show_announcement,
  hero_heading_en, hero_heading_sw, hero_sub_en, hero_sub_sw,
  hero_cta_label_en, hero_cta_label_sw, hero_cta_href,
  promo_banner_en, promo_banner_sw, promo_banner_visible,
  show_categories, show_best_sellers, show_featured, show_category_grids,
  show_trust, show_delivery_banner, show_brands, show_how_it_works,
  category_order,
  whatsapp_e164, phone_e164, contact_email, address_line, logo_media_id,
  reservation_warning_minutes, reservation_expiry_minutes
`;

/** Sensible shape when the row cannot be read at all. Never invented content. */
const EMPTY: ShopSettings = {
  website: {
    announcementEn: null, announcementSw: null, showAnnouncement: true,
    heroHeadingEn: null, heroHeadingSw: null,
    heroSubEn: null, heroSubSw: null,
    heroCtaLabelEn: null, heroCtaLabelSw: null, heroCtaHref: null,
    promoBannerEn: null, promoBannerSw: null, promoBannerVisible: false,
    showCategories: true, showBestSellers: true, showFeatured: true,
    showCategoryGrids: true, showTrust: true, showDeliveryBanner: true,
    showBrands: true, showHowItWorks: true,
    categoryOrder: null,
  },
  business: {
    whatsappE164: null, phoneE164: null, contactEmail: null,
    addressLine: null, logoMediaId: null,
  },
  reservation: { warningMinutes: null, expiryMinutes: null },
};

export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("shop_settings").select(SELECT).eq("id", true).maybeSingle();

  if (error || !data) return EMPTY;

  return {
    website: {
      announcementEn: data.announcement_en,
      announcementSw: data.announcement_sw,
      showAnnouncement: data.show_announcement,
      heroHeadingEn: data.hero_heading_en,
      heroHeadingSw: data.hero_heading_sw,
      heroSubEn: data.hero_sub_en,
      heroSubSw: data.hero_sub_sw,
      heroCtaLabelEn: data.hero_cta_label_en,
      heroCtaLabelSw: data.hero_cta_label_sw,
      heroCtaHref: data.hero_cta_href,
      promoBannerEn: data.promo_banner_en,
      promoBannerSw: data.promo_banner_sw,
      promoBannerVisible: data.promo_banner_visible,
      showCategories: data.show_categories,
      showBestSellers: data.show_best_sellers,
      showFeatured: data.show_featured,
      showCategoryGrids: data.show_category_grids,
      showTrust: data.show_trust,
      showDeliveryBanner: data.show_delivery_banner,
      showBrands: data.show_brands,
      showHowItWorks: data.show_how_it_works,
      categoryOrder: data.category_order,
    },
    business: {
      whatsappE164: data.whatsapp_e164,
      phoneE164: data.phone_e164,
      contactEmail: data.contact_email,
      addressLine: data.address_line,
      logoMediaId: data.logo_media_id,
    },
    reservation: {
      warningMinutes: data.reservation_warning_minutes,
      expiryMinutes: data.reservation_expiry_minutes,
    },
  };
}

/**
 * What is still missing before the shop could open.
 *
 * Deliberately computed rather than kept as a checklist somebody has to
 * remember to tick: the answer is whatever the database actually holds.
 */
export function launchGaps(settings: ShopSettings): string[] {
  const gaps: string[] = [];
  if (!settings.business.whatsappE164) gaps.push("WhatsApp number");
  if (!settings.business.phoneE164) gaps.push("Phone number");
  if (!settings.business.contactEmail) gaps.push("Email address");
  if (!settings.business.addressLine) gaps.push("Shop address");
  if (!settings.business.logoMediaId) gaps.push("Logo");
  if (settings.reservation.expiryMinutes === null) gaps.push("How long an unconfirmed order holds stock");
  return gaps;
}
