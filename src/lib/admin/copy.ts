import type { Locale } from "@/lib/i18n/config";

/**
 * Admin vocabulary — the words that repeat across every admin screen.
 *
 * The admin is English-first in V1. This module is the localisation seam: the
 * shape below defines the type, so adding Kiswahili later means adding one
 * object here and nothing else changes. Longer screen prose is still inline in
 * the screens; it moves here when admin localisation is actually scheduled.
 *
 * Plain language only. No database words, no state names, no IDs.
 */

export const adminEn = {
  nav: {
    home: "Home",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    more: "More",
    deliveryZones: "Delivery Zones",
    website: "Website",
    reports: "Reports",
    staff: "Staff",
    settings: "Settings",
  },

  actions: {
    open: "Open",
    openOrder: "Open Order",
    save: "Save",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    back: "Back",
    edit: "Edit",
    done: "Done",
    add: "Add",
    search: "Search",
    whatsapp: "WhatsApp Customer",
    call: "Call Customer",
    viewAll: "View all",
  },

  labels: {
    today: "Today",
    todaysSales: "Today's Sales",
    todaysOrders: "Today's Orders",
    averageOrderValue: "Average Order Value",
    needsAttention: "Needs your attention",
    recentOrders: "Recent Orders",
    items: "items",
    item: "item",
    sku: "Item code",
    price: "Price",
    stock: "Available stock",
    status: "Status",
    onWebsite: "On the website",
    notOnWebsite: "Not on the website",
    nothingHere: "Nothing here",
  },

  sync: {
    saved: "Saved",
    syncing: "Syncing…",
    pending: "Sync pending",
    issue: "Sync issue",
  },

  mock: {
    /** Shown wherever invented data is on screen. Never hide this. */
    banner: "Sample data — not real orders or customers",
    products: "Products and prices are real. Orders, customers and zones are samples.",
  },
} as const;

export type AdminCopy = typeof adminEn;

const dictionaries: Partial<Record<Locale, AdminCopy>> = { en: adminEn };

/** English until an admin Kiswahili dictionary exists. */
export function getAdminCopy(locale: Locale = "en"): AdminCopy {
  return dictionaries[locale] ?? adminEn;
}
