import { describe, expect, it } from "vitest";
import { cartQuantityLimit, normalizeCartLines } from "./cart-lines";

describe("persisted cart recovery", () => {
  it("rejects malformed values without losing valid lines", () => {
    expect(normalizeCartLines([null, {}, {sku:"",quantity:1}, {sku:"A",quantity:"2"},
      {sku:"A",quantity:NaN}, {sku:"A",quantity:Infinity}, {sku:"A",quantity:-2},
      {sku:"B",quantity:3}])).toEqual([{sku:"B",quantity:3}]);
    expect(normalizeCartLines({sku:"A",quantity:1})).toEqual([]);
  });
  it("combines duplicates and caps quantities before they reach checkout", () => {
    expect(normalizeCartLines([{sku:"A",quantity:80},{sku:"A",quantity:40},
      {sku:"B",quantity:5000},{sku:"C",quantity:2.8},{sku:"D",quantity:0.2}]))
      .toEqual([{sku:"A",quantity:99},{sku:"B",quantity:99},{sku:"C",quantity:2}]);
  });
  it("keeps a recovered basket stable across subsequent saves", () => {
    const recovered = normalizeCartLines([{sku:"A",quantity:1.5},{sku:"A",quantity:2}]);
    expect(normalizeCartLines(JSON.parse(JSON.stringify(recovered)))).toEqual(recovered);
  });
});

describe("cart quantity limits", () => {
  it("uses available stock and the storefront quantity ceiling", () => {
    expect(cartQuantityLimit({inStock:true,stockQty:5})).toBe(5);
    expect(cartQuantityLimit({inStock:true,stockQty:1000})).toBe(99);
    expect(cartQuantityLimit({inStock:false,stockQty:20})).toBe(0);
    expect(cartQuantityLimit({inStock:true,stockQty:NaN})).toBe(0);
  });
});
