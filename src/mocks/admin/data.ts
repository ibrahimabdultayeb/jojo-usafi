/**
 * WHAT IS LEFT OF THE ADMIN PROTOTYPE.
 *
 * This file used to hold invented orders, invented customers, invented delivery
 * zones and an invented sales figure, so the dashboard could be judged on how it
 * *works* before there was a database behind it. Every one of those screens now
 * reads the real DEV project — orders, customers, products, stock, delivery
 * areas and the home page's counts — so the invented rows are gone rather than
 * kept "just in case". A dashboard that can fall back to plausible fiction is a
 * dashboard that can quietly show fiction.
 *
 * The shared vocabulary that lived here with them — stage labels, the next
 * action per stage, the cancellation reasons, the `AdminOrder` shape — was never
 * mock at all, and moved to `src/lib/admin/model.ts`.
 *
 * WHAT REMAINS is the Website screen's draft content. That screen is still a
 * prototype: `shop_settings` and the homepage-section flags exist in the schema
 * but nothing writes them yet, and the screen says so on its face. When it is
 * wired, this file goes.
 */

export interface ContentSection {
  id: string;
  label: string;
  visible: boolean;
  description: string;
}

export const homepageSections: ContentSection[] = [
  { id: "categories", label: "Shop by category", visible: true, description: "The row of category tiles under the banner" },
  { id: "best-sellers", label: "Best sellers", visible: true, description: "Products marked Best seller" },
  { id: "category-grids", label: "Category product grids", visible: true, description: "One product row per category" },
  { id: "trust", label: "Why shop with us", visible: true, description: "The three promises band" },
  { id: "delivery", label: "Delivery area banner", visible: true, description: "The green banner about where you deliver" },
  { id: "brands", label: "Brands we stock", visible: true, description: "The brand tiles" },
  { id: "how", label: "How ordering works", visible: true, description: "The three-step dark band" },
];

export const contentDraft = {
  announcementEn: "Delivery across selected Dar es Salaam areas",
  announcementSw: "Tunafikisha katika maeneo teule ya Dar es Salaam",
  heroHeadlineEn: "A cleaner home. Without the trip.",
  heroHeadlineSw: "Nyumba safi. Bila kutoka nje.",
  heroSubEn: "Household essentials brought to your door across Dar es Salaam.",
  heroSubSw: "Bidhaa za nyumbani zinafikishwa mlangoni kwako Dar es Salaam.",
  bannerEn: "Free delivery in Mikocheni this week",
  bannerSw: "Usafirishaji bure Mikocheni wiki hii",
  bannerVisible: false,
};
