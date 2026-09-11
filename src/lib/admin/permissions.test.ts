import { describe, expect, it } from "vitest";
import { can, ROLE_LABELS, type Capability, type Role } from "./permissions";

/**
 * The capability matrix, pinned.
 *
 * This is the table both halves of the dashboard read: the screens ask it which
 * controls to draw, and `authorize()` asks it whether a server action may run.
 * Because it is one table, a button that exists and an action that is allowed
 * cannot drift apart — so the table itself is what has to be defended.
 *
 * These are not tests of security. The boundary is Row Level Security in the
 * database, and `tests/db/09-admin-operations.test.ts` proves that a real
 * signed-in Order staff token is refused by PostgreSQL even when every check in
 * this repository is bypassed. What this file defends is that the matrix says
 * what the shop decided it should say, so a careless edit is caught here rather
 * than by an operator discovering a control they should not have.
 */

const ROLES: Role[] = ["owner", "manager", "order_staff"];

describe("who may do what", () => {
  it("lets every role work on orders — that is what Order staff are for", () => {
    for (const role of ROLES) {
      expect(can(role, "orders.view"), role).toBe(true);
      expect(can(role, "orders.advance"), role).toBe(true);
      expect(can(role, "orders.cancel"), role).toBe(true);
      expect(can(role, "orders.recordPayment"), role).toBe(true);
    }
  });

  it("keeps pricing, stock and visibility away from Order staff", () => {
    for (const capability of [
      "products.editPricing",
      "products.editStock",
      "products.editVisibility",
    ] as Capability[]) {
      expect(can("owner", capability), capability).toBe(true);
      expect(can("manager", capability), capability).toBe(true);
      expect(can("order_staff", capability), capability).toBe(false);
    }
  });

  it("lets a Manager run the shop but never manage staff or settings", () => {
    expect(can("manager", "delivery.manage")).toBe(true);
    expect(can("manager", "catalogue.sync")).toBe(true);
    // NOT website.manage: `shop_settings` admits only an Owner, proved in
    // tests/db/14-website-and-safety.test.ts. The matrix says what the database
    // will actually allow, or the dashboard draws controls that silently fail.
    expect(can("manager", "website.manage")).toBe(false);
    expect(can("manager", "analytics.view")).toBe(true);

    // The two an Owner keeps. Staff management is how a Manager would promote
    // themselves, so it is the single most important false in this file.
    expect(can("manager", "staff.manage")).toBe(false);
    expect(can("manager", "settings.manage")).toBe(false);
  });

  it("gives Order staff no way to reach the More menu's settings", () => {
    for (const capability of [
      "products.editPricing",
      "delivery.manage",
      "catalogue.sync",
      "website.manage",
      "analytics.view",
      "staff.manage",
      "settings.manage",
      "customers.edit",
    ] as Capability[]) {
      expect(can("order_staff", capability), capability).toBe(false);
    }
  });

  it("gives the Owner everything", () => {
    const everything: Capability[] = [
      "orders.view", "orders.advance", "orders.cancel", "orders.recordPayment",
      "customers.view", "customers.edit",
      "products.view", "products.editPricing", "products.editStock", "products.editVisibility",
      "delivery.manage", "catalogue.sync", "website.manage", "analytics.view", "staff.manage", "settings.manage",
    ];
    for (const capability of everything) {
      expect(can("owner", capability), capability).toBe(true);
    }
  });

  it("names every role in words an operator would use", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_LABELS[role]).not.toContain("_");
    }
  });
});
