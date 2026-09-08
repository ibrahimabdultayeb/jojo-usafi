import type { WebsiteContent } from "../types";

/**
 * MOCK WEBSITE CONTENT.
 *
 * What the Website screen edits in the prototype. Editing is local to the screen
 * and is never written anywhere — there is no content backend yet.
 *
 * Customer-facing strings carry both languages, because the storefront is
 * bilingual and staff must never be asked to edit one language only. Staff never
 * touch HTML.
 */
export const mockWebsiteContent: WebsiteContent = {
  announcements: [
    {
      en: "Delivery across selected Dar es Salaam areas",
      sw: "Tunafikisha katika maeneo teule ya Dar es Salaam",
    },
    {
      en: "Lipa ukipokea — pay when your order arrives",
      sw: "Lipa ukipokea — lipa agizo lako linapowasili",
    },
    { en: "Order online in about a minute", sw: "Agiza mtandaoni kwa dakika moja" },
  ],
  heroTitle: { en: "A cleaner home.", sw: "Nyumba safi zaidi." },
  heroSubtitle: { en: "Without the trip.", sw: "Bila safari." },
  promoBanner: {
    enabled: false,
    text: { en: "", sw: "" },
  },
  /** Real SKUs from the recovered catalogue. */
  featuredSkus: ["EP01-A02", "EP02-A02", "EP04-A02", "EP06-A02"],
  bestSellerSkus: ["EP01-A02", "EP01-A06", "EP02-A02", "EP02-A06", "EP03-A02", "EP04-A02"],
  categoryOrder: [
    "personal-care",
    "housekeeping",
    "washroom-and-surface-care",
    "laundry-care",
    "vehicle-care",
  ],
  sections: [
    { id: "hero", label: "Hero", visible: true },
    { id: "categories", label: "Shop by category", visible: true },
    { id: "best-sellers", label: "Best sellers", visible: true },
    { id: "category-rows", label: "Category rows", visible: true },
    { id: "trust", label: "The Jojo Usafi standard", visible: true },
    { id: "delivery", label: "Where we deliver", visible: true },
    { id: "brands", label: "Brands we stock", visible: true },
    { id: "how", label: "How ordering works", visible: true },
  ],
};
