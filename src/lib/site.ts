/**
 * Storefront-wide settings and business contact details.
 *
 * Anything in here that is a business decision rather than a design decision is
 * marked PLACEHOLDER and listed in PROTOTYPE_NOTES.md. Nothing here invents a
 * price, a delivery fee or a free-delivery threshold.
 *
 * Customer-facing wording lives in `src/lib/i18n/dictionaries`, not here, so it
 * exists in both English and Kiswahili.
 */

export const site = {
  name: "Jojo Usafi",
  currency: "TSh",

  /**
   * Absolute base for canonical and hreflang URLs. No production domain has
   * been chosen yet, so it is read from the environment and falls back to the
   * dev server rather than inventing one.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  /** PLACEHOLDER — replace with the real Jojo Usafi business number. */
  whatsappNumber: "255700000000",
  /** PLACEHOLDER — replace with the real Jojo Usafi phone number. */
  phone: "+255 700 000 000",
  /** PLACEHOLDER — replace with the real Jojo Usafi address. */
  email: "hello@jojousafi.co.tz",
  addressLine: "Dar es Salaam, Tanzania",
  hours: "Mon – Sat · 8:00 – 18:00",

  /** Jojo Usafi serves Dar es Salaam only. Never imply nationwide delivery. */
  serviceArea: "selected Dar es Salaam areas",
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
