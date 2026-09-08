/**
 * Permission shape, ready for real roles later.
 *
 * There is NO authentication in this build and these checks protect nothing —
 * anyone who can reach `/admin` can do anything. What this gives us is a single
 * place every screen already asks, so when Supabase Auth and Row Level Security
 * arrive the answer changes here and the UI follows, instead of every screen
 * needing to grow its own check.
 *
 * The real boundary will be Row Level Security in the database. This is only the
 * matching front-end affordance: hide or disable what a role cannot do, so staff
 * are never shown a button that will fail.
 */

export type Role = "owner" | "manager" | "order_staff";

export const roles: Role[] = ["owner", "manager", "order_staff"];

export const roleLabel: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  order_staff: "Order Staff",
};

export const roleDescription: Record<Role, string> = {
  owner: "Can see and change everything, including money and staff.",
  manager: "Runs the shop day to day. Cannot manage staff or settings.",
  order_staff: "Handles orders and customers only.",
};

/** Everything a member of staff might be allowed to do. */
export type Capability =
  | "orders.view"
  | "orders.advance"
  | "orders.cancel"
  | "orders.markDeliveryFailed"
  | "products.view"
  | "products.editEveryday"
  | "products.editDetails"
  | "products.adjustStock"
  | "products.changeLifecycle"
  | "customers.view"
  | "zones.view"
  | "zones.edit"
  | "website.view"
  | "website.edit"
  | "reports.view"
  | "staff.manage"
  | "settings.manage";

const CAPABILITIES: Record<Role, Capability[]> = {
  owner: [
    "orders.view",
    "orders.advance",
    "orders.cancel",
    "orders.markDeliveryFailed",
    "products.view",
    "products.editEveryday",
    "products.editDetails",
    "products.adjustStock",
    "products.changeLifecycle",
    "customers.view",
    "zones.view",
    "zones.edit",
    "website.view",
    "website.edit",
    "reports.view",
    "staff.manage",
    "settings.manage",
  ],
  manager: [
    "orders.view",
    "orders.advance",
    "orders.cancel",
    "orders.markDeliveryFailed",
    "products.view",
    "products.editEveryday",
    "products.editDetails",
    "products.adjustStock",
    "products.changeLifecycle",
    "customers.view",
    "zones.view",
    "zones.edit",
    "website.view",
    "website.edit",
    "reports.view",
  ],
  order_staff: [
    "orders.view",
    "orders.advance",
    "orders.cancel",
    "orders.markDeliveryFailed",
    "products.view",
    "customers.view",
    "zones.view",
  ],
};

/** The one question every admin screen asks before offering an action. */
export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

/** Plain-language reason to show when something is visible but not allowed. */
export function whyNot(role: Role): string {
  return `${roleLabel[role]} cannot do this. Ask the owner.`;
}
