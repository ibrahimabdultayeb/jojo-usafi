import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, resolveContent, type RawContent } from "./site-content";

/**
 * The rule that decides what the homepage says.
 *
 * Worth its own tests because it is the one place a settings screen can quietly
 * break a shop: get the fallback backwards and clearing a box empties the
 * homepage instead of restoring the copy it was designed with.
 */

const ROW: RawContent = {
  announcement_en: null,
  announcement_sw: null,
  show_announcement: true,
  hero_heading_en: null,
  hero_heading_sw: null,
  hero_sub_en: null,
  hero_sub_sw: null,
  hero_cta_label_en: null,
  hero_cta_label_sw: null,
  hero_cta_href: null,
  promo_banner_en: null,
  promo_banner_sw: null,
  promo_banner_visible: false,
  show_categories: true,
  show_best_sellers: true,
  show_featured: true,
  show_category_grids: true,
  show_trust: true,
  show_delivery_banner: true,
  show_brands: true,
  show_how_it_works: true,
  category_order: null,
};

const row = (over: Partial<RawContent> = {}): RawContent => ({ ...ROW, ...over });

describe("a blank field means the website's own wording", () => {
  it("asks for no override when nothing has been typed", () => {
    const content = resolveContent(row(), "en");
    expect(content.announcement).toBeNull();
    expect(content.heroHeading).toBeNull();
    expect(content.heroSub).toBeNull();
    expect(content.heroCtaLabel).toBeNull();
  });

  it("treats an empty string and spaces exactly like null", () => {
    const content = resolveContent(row({ hero_heading_en: "   ", announcement_en: "" }), "en");
    expect(content.heroHeading).toBeNull();
    expect(content.announcement).toBeNull();
  });

  it("falls back to the designed copy when there is no settings row at all", () => {
    expect(resolveContent(null, "en")).toEqual(DEFAULT_CONTENT);
    expect(resolveContent(null, "sw")).toEqual(DEFAULT_CONTENT);
  });

  it("never lets a blank field switch a section off", () => {
    // The distinction the whole design rests on: emptying a box changes the
    // words, and only a switch changes whether a section exists.
    const content = resolveContent(row({ announcement_en: "", promo_banner_en: "" }), "en");
    expect(content.showAnnouncement).toBe(true);
    expect(content.sections.bestSellers).toBe(true);
  });
});

describe("two languages, and no invented translation", () => {
  it("uses the Kiswahili wording on the Kiswahili site", () => {
    const content = resolveContent(
      row({ hero_heading_en: "Everything clean", hero_heading_sw: "Kila kitu safi" }),
      "sw",
    );
    expect(content.heroHeading).toBe("Kila kitu safi");
  });

  it("shows the English when the Kiswahili box was left empty", () => {
    const content = resolveContent(
      row({ hero_heading_en: "Everything clean", hero_heading_sw: "  " }),
      "sw",
    );
    expect(content.heroHeading).toBe("Everything clean");
  });

  it("does not show a Kiswahili override on the English site", () => {
    // The opposite fallback would put Kiswahili on the English homepage the
    // moment somebody translated one field, which is not a translation — it is
    // a mistake with two languages in it.
    const content = resolveContent(row({ hero_heading_sw: "Kila kitu safi" }), "en");
    expect(content.heroHeading).toBeNull();
  });
});

describe("the switches", () => {
  it("carries every section flag through unchanged", () => {
    const content = resolveContent(
      row({ show_categories: false, show_trust: false, show_how_it_works: false }),
      "en",
    );
    expect(content.sections.categories).toBe(false);
    expect(content.sections.trust).toBe(false);
    expect(content.sections.howItWorks).toBe(false);
    expect(content.sections.brands).toBe(true);
  });

  it("keeps the promotion band's words and its switch separate", () => {
    const written = resolveContent(row({ promo_banner_en: "Free delivery", promo_banner_visible: false }), "en");
    expect(written.promo).toBe("Free delivery");
    expect(written.showPromo).toBe(false);

    const shown = resolveContent(row({ promo_banner_visible: true }), "en");
    expect(shown.showPromo).toBe(true);
    expect(shown.promo, "a band switched on with nothing written stays wordless").toBeNull();
  });

  it("passes the hero link through only when it is a path on this website", () => {
    // The shape itself is a database constraint; what is proved here is that a
    // blank one does not become a link to nowhere.
    expect(resolveContent(row({ hero_cta_href: "/shop" }), "en").heroCtaHref).toBe("/shop");
    expect(resolveContent(row({ hero_cta_href: "" }), "en").heroCtaHref).toBeNull();
  });
});
