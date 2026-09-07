/**
 * Storefront-wide copy and settings.
 *
 * Anything in here that is a business decision rather than a design decision is
 * marked PLACEHOLDER and listed in PROTOTYPE_NOTES.md. Nothing here invents a
 * price, a delivery fee or a free-delivery threshold.
 */

export const site = {
  name: "Jojo Usafi",
  tagline: "Household essentials, delivered in Dar",
  description:
    "Cleaning and personal care essentials delivered across selected Dar es Salaam areas. Order online, pay when it arrives.",
  currency: "TSh",

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

export const announcements: string[] = [
  "Delivery across selected Dar es Salaam areas",
  "Lipa ukipokea — pay when your order arrives",
  "Order online in about a minute",
];

export function whatsappLink(message: string): string {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const nav = [
  { label: "Home", href: "/" },
  { label: "Shop All", href: "/shop" },
  { label: "Track Order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
] as const;
