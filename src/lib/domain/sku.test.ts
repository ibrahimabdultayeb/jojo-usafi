import { describe, expect, it } from "vitest";
import { findDuplicateSkus, isSku, normalizeSku, parseSku, SKU_PATTERN } from "./sku";

describe("SKU", () => {
  it("accepts the shape the EcoPlus catalogue actually uses", () => {
    expect(isSku("EP01-A02")).toBe(true);
    expect(isSku("EP09-A07")).toBe(true);
  });

  it("accepts codes no EcoPlus product uses, because the store is multi-brand", () => {
    for (const sku of ["ACME.100", "X1", "BRAND_NEW-2026", "9000"]) {
      expect(isSku(sku)).toBe(true);
    }
  });

  it("rejects anything that would make two products look like one", () => {
    for (const sku of ["", "E", "ep01-a02", "EP01 A02", "EP01/A02", "-EP01", "EP01\tA02"]) {
      expect(isSku(sku)).toBe(false);
    }
  });

  it("rejects a SKU longer than the column allows", () => {
    expect(isSku("A".repeat(48))).toBe(true);
    expect(isSku("A".repeat(49))).toBe(false);
  });

  it("normalises case and surrounding space without changing identity", () => {
    expect(normalizeSku("  ep01-a02 ")).toBe("EP01-A02");
    const parsed = parseSku(" ep01-a02 ");
    expect(parsed.ok && parsed.value).toBe("EP01-A02");
  });

  it("does not silently repair an internal space", () => {
    const parsed = parseSku("EP01 A02");
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.code).toBe("invalid_sku");
  });

  it("explains itself in words an operator can act on", () => {
    const parsed = parseSku("ep 01");
    expect(parsed.ok === false && parsed.reason).toMatch(/capital letters/i);
  });

  it("finds duplicates however they were typed", () => {
    expect(findDuplicateSkus(["EP01-A02", "ep01-a02", "EP02-B01"])).toEqual(["EP01-A02"]);
    expect(findDuplicateSkus(["EP01-A02", "EP02-B01"])).toEqual([]);
  });

  it("keeps the pattern the database also enforces", () => {
    // If this changes, supabase/migrations must change with it — and
    // scripts/schema-check.mjs fails the build if they disagree.
    expect(SKU_PATTERN.source).toBe("^[A-Z0-9][A-Z0-9._-]{1,47}$");
  });
});
