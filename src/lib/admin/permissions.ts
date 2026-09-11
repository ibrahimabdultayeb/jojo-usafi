/**
 * Admin roles, prepared but not enforced.
 *
 * Supabase Auth adds real enforcement later. Until then this exists so
 * the screens are *built* around the idea that not every operator sees every
 * control — hiding a button later is a one-line change here, not a redesign.
 *
 * The UI hiding a control is never the security boundary. The real boundary
 * will be Supabase Row Level Security plus a check in every server action; this
 * file only decides what is worth rendering.
 */

export type Role = "owner" | "manager" | "order_staff";

export type Capability =
  | "orders.view"
  | "orders.advance"
  | "orders.cancel"
  | "orders.recordPayment"
  | "customers.view"
  | "customers.edit"
  | "products.view"
  | "products.editPricing"
  | "products.editStock"
  | "products.editVisibility"
  | "delivery.manage"
  | "catalogue.sync"
  | "website.manage"
  | "analytics.view"
  | "staff.manage"
  | "settings.manage";

const MATRIX: Record<Role, Capability[]> = {
  owner: [
    "orders.view", "orders.advance", "orders.cancel", "orders.recordPayment",
    "customers.view", "customers.edit",
    "products.view", "products.editPricing", "products.editStock", "products.editVisibility",
    "delivery.manage", "catalogue.sync", "website.manage", "analytics.view", "staff.manage", "settings.manage",
  ],
  manager: [
    "orders.view", "orders.advance", "orders.cancel", "orders.recordPayment",
    "customers.view", "customers.edit",
    "products.view", "products.editPricing", "products.editStock", "products.editVisibility",
    // NOT "website.manage": `shop_settings` admits only an Owner, by policy.
    // A Manager who was offered that screen would type into it, be told "Saved",
    // and change nothing — the matrix has to say what the database will allow.
    "delivery.manage", "catalogue.sync", "analytics.view",
  ],
  order_staff: [
    "orders.view", "orders.advance", "orders.cancel", "orders.recordPayment",
    "customers.view",
  ],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  order_staff: "Order staff",
};

/**
 * The signed-in operator, mocked for the prototype. Build 06 replaces this with
 * the real session.
 */
export const currentUser = {
  name: "Ibrahim",
  role: "owner" as Role,
  initials: "IA",
};
