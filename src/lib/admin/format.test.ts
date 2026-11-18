import { afterEach, describe, expect, it, vi } from "vitest";
import { shopDayStart, whenWords, whenExactly } from "./format";
import { orderTotals, type AdminOrder } from "./model";
afterEach(()=>vi.useRealTimers());
describe("the shop's local day",()=>{
 it("starts a new day at 21:00 UTC, including year rollover",()=>{
  expect(shopDayStart(new Date("2026-12-31T20:59:59Z"))).toBe("2026-12-30T21:00:00.000Z");
  expect(shopDayStart(new Date("2026-12-31T21:00:00Z"))).toBe("2026-12-31T21:00:00.000Z");
 });
 it("uses Tanzania dates even when the server runs in UTC",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-18T21:10:00Z"));
  expect(whenWords("2026-11-18T21:01:00Z")).toBe("Today");
  expect(whenWords("2026-11-18T20:59:00Z")).toBe("Yesterday");
  expect(whenExactly("2026-11-18T21:01:00Z")).toContain("19 Nov 2026");
 });
});
it("displays the recorded order total including its discount",()=>{
 const order={lines:[{quantity:2,unitPrice:20000}],delivery:{fee:4000,freeDelivery:false},totals:{subtotal:40000,discount:5000,total:39000}} as AdminOrder;
 expect(orderTotals(order)).toEqual({subtotal:40000,discount:5000,delivery:4000,total:39000,items:2});
});
