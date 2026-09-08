import type { DeliveryZone } from "../types";

/**
 * MOCK DELIVERY ZONES — NOT PRODUCTION CONFIGURATION.
 *
 * The real list of areas Jojo Usafi serves, and what each one costs, is an open
 * business decision for Ibrahim. These exist so the zone editor can be seen and
 * judged; they must not be treated as agreed commercial terms. Every screen that
 * shows them says so.
 */

/** The fee a newly added zone starts on, until it is set deliberately. */
export const DEFAULT_ZONE_FEE = 4000;

export const mockZones: DeliveryZone[] = [
  { id: "zone_upanga", name: "Upanga", fee: 4000, freeDelivery: false, active: true, sortPriority: 1 },
  { id: "zone_masaki", name: "Masaki", fee: 5000, freeDelivery: false, active: true, sortPriority: 2 },
  { id: "zone_mikocheni", name: "Mikocheni", fee: 4000, freeDelivery: true, active: true, sortPriority: 3 },
  { id: "zone_kariakoo", name: "Kariakoo", fee: 3500, freeDelivery: false, active: true, sortPriority: 4 },
  { id: "zone_mbezi", name: "Mbezi Beach", fee: 6000, freeDelivery: false, active: true, sortPriority: 5 },
  { id: "zone_tegeta", name: "Tegeta", fee: 6500, freeDelivery: false, active: false, sortPriority: 6 },
];

export function zoneFee(zone: DeliveryZone): number {
  return zone.freeDelivery ? 0 : zone.fee;
}
