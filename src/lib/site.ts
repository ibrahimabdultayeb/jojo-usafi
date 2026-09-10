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

/**
 * The four contact values above are FALLBACKS, not the shop's details.
 *
 * Since Build 10 the real WhatsApp number, phone, email and address live in
 * `shop_settings` and are entered by the Owner on More → Settings. Read them
 * through `src/lib/contact.ts`, which falls back to the values above for as
 * long as any of them is unset, and builds WhatsApp links with `whatsappHref`.
 *
 * The `whatsappLink()` that used to live here was removed rather than kept as a
 * convenience: it read the placeholder unconditionally, so any component that
 * called it would show `255700000000` to a customer for as long as nobody
 * noticed. A missing export is noticed immediately.
 */
