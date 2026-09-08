import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_FEE_TZS,
  deliveryFeeForZone,
  isOrderable,
  newDeliveryZoneDefaults,
  parseDeliveryZone,
  setFreeDelivery,
  type DeliveryZoneInput,
} from "./delivery";

const zone = (overrides: Partial<DeliveryZoneInput> = {}): DeliveryZoneInput => ({
  name: "Upanga",
  slug: "upanga",
  feeTzs: 4000,
  freeDelivery: false,
  active: true,
  sortPriority: 0,
  ...overrides,
});

describe("delivery zones", () => {
  it("starts a new area on the approved default fee", () => {
    expect(DEFAULT_DELIVERY_FEE_TZS).toBe(4000);
    expect(newDeliveryZoneDefaults().feeTzs).toBe(4000);
    expect(newDeliveryZoneDefaults().active).toBe(true);
  });

  it("accepts an ordinary charged area", () => {
    expect(parseDeliveryZone(zone()).ok).toBe(true);
  });

  it("accepts a free area with no fee", () => {
    expect(parseDeliveryZone(zone({ feeTzs: 0, freeDelivery: true })).ok).toBe(true);
  });

  it("refuses an area that is both free and charged", () => {
    const result = parseDeliveryZone(zone({ feeTzs: 4000, freeDelivery: true }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/free delivery/i);
  });

  it("refuses a negative or fractional fee", () => {
    expect(parseDeliveryZone(zone({ feeTzs: -1 })).ok).toBe(false);
    expect(parseDeliveryZone(zone({ feeTzs: 4000.5 })).ok).toBe(false);
  });

  it("refuses an unnamed area", () => {
    expect(parseDeliveryZone(zone({ name: "" })).ok).toBe(false);
    expect(parseDeliveryZone(zone({ name: "A" })).ok).toBe(false);
  });

  it("refuses a slug that would not work as a web address", () => {
    expect(parseDeliveryZone(zone({ slug: "Upanga" })).ok).toBe(false);
    expect(parseDeliveryZone(zone({ slug: "upanga area" })).ok).toBe(false);
    expect(parseDeliveryZone(zone({ slug: "mikocheni-b" })).ok).toBe(true);
  });

  it("charges nothing for a free area", () => {
    expect(deliveryFeeForZone(zone({ feeTzs: 0, freeDelivery: true }))).toBe(0);
    expect(deliveryFeeForZone(zone({ feeTzs: 5000 }))).toBe(5000);
  });

  it("zeroes the fee in the same edit that marks an area free", () => {
    const free = setFreeDelivery(zone({ feeTzs: 5000 }), true);
    expect(free).toMatchObject({ freeDelivery: true, feeTzs: 0 });
    expect(parseDeliveryZone(free).ok).toBe(true);
  });

  it("restores a chargeable fee when free delivery is turned off", () => {
    const charged = setFreeDelivery(zone({ feeTzs: 0, freeDelivery: true }), false, 5000);
    expect(charged).toMatchObject({ freeDelivery: false, feeTzs: 5000 });
    expect(parseDeliveryZone(charged).ok).toBe(true);
  });

  it("falls back to the approved default when no fee is given", () => {
    const charged = setFreeDelivery(zone({ feeTzs: 0, freeDelivery: true }), false);
    expect(charged.feeTzs).toBe(DEFAULT_DELIVERY_FEE_TZS);
  });

  it("offers only active areas at checkout", () => {
    expect(isOrderable(zone())).toBe(true);
    expect(isOrderable(zone({ active: false }))).toBe(false);
  });
});
