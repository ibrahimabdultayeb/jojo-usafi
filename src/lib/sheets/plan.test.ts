import { describe, expect, it } from "vitest";
import { planSync, type DbProduct, type PlanInput } from "./plan";
import { toSnapshot } from "./rows";
import { COLUMNS, REPORT_COLUMNS, type CatalogueFields } from "./columns";
import { fingerprint, type SyncStateRecord } from "@/lib/domain/sync";

/**
 * The synchroniser's safety rules, proved without a spreadsheet.
 *
 * `planSync` is a pure function, so every scenario in the Build 09 brief can be
 * written as a literal: a sheet, a database, and what the two last agreed on.
 * That is deliberate — the rules that matter most here are the ones about NOT
 * doing something (not moving stock, not deleting a product, not picking a side
 * in a conflict), and a rule about not doing something is only believable if it
 * can be triggered on demand.
 */

const HEADERS = [...COLUMNS.map((c) => c.header), ...REPORT_COLUMNS.map((c) => c.header)];

/** A Product Master row, with only the interesting cells spelled out. */
function sheetRow(overrides: Record<string, string | number> = {}): (string | number)[] {
  const base: Record<string, string | number> = {
    SKU: "EP01-A02",
    "FAMILY CODE": "EP01",
    ITF: "",
    EAN: "",
    SUPPLIER: "EcoPlus Brands",
    "BRAND GROUP": "",
    "PRODUCT BRAND": "Multix",
    "PRODUCT VARIANT": "Multipurpose Detergent Lemon Fresh",
    SIZE: "5LT",
    "SELLING UOM": "EA",
    "SYSTEM NAME": "",
    "SHORT NAME": "",
    DESCRIPTION: "",
    CATEGORY: "Housekeeping",
    SUBCATEGORY: "",
    TAGS: "",
    "WEBSITE STATUS": "Show",
    "PRICE TZS": 34000,
    "OFFER PRICE TZS": "",
    "STOCK QTY": 450,
    "LOW STOCK THRESHOLD": 10,
    "ALLOW BACKORDER": "",
    "AVAILABILITY MESSAGE": "",
    "DELIVERY CLASS": "",
    "IMAGE URL": "",
    "IMAGE ASSET KEY": "",
    "CARD SIZE": "",
    "BEST SELLER": "Yes",
    FEATURED: "No",
    "NEW ARRIVAL": "",
    "PRODUCT PRIORITY": 0,
    "PRODUCT STATUS": "Active",
    "SEO SLUG": "multix-multipurpose-detergent-lemon-fresh-5lt",
    "SEO TITLE": "",
    "META DESCRIPTION": "",
    "WEIGHT KG": "",
    DIMENSIONS: "",
    "TAX CLASS": "",
    NOTES: "",
    ...overrides,
  };
  return HEADERS.map((header) => base[header] ?? "");
}

const DB_FIELDS: CatalogueFields = {
  displayName: "Multipurpose Detergent Lemon Fresh",
  variantLabel: null,
  packSizeLabel: "5LT",
  categoryName: "Housekeeping",
  brandName: "Multix",
  ean: null,
  itf14: null,
  priceTzs: 34000,
  offerPriceTzs: null,
  storefrontVisible: true,
  featured: false,
  bestSeller: true,
  lifecycle: "active",
  lowStockThreshold: 10,
  sortPriority: 0,
  slug: "multix-multipurpose-detergent-lemon-fresh-5lt",
  description: null,
};

function dbProduct(overrides: Partial<CatalogueFields> = {}, sku = "EP01-A02"): DbProduct {
  return {
    id: `id-${sku}`,
    sku,
    fields: { ...DB_FIELDS, ...overrides },
    report: {
      availableStock: 448,
      hasImage: true,
      onWebsite: true,
      blockedReason: "",
    },
  };
}

/**
 * `sync_state` saying "the two agreed, and here is what each side looked like".
 * Without it every field difference reads as a first meeting rather than as a
 * change, which is exactly the distinction the conflict rule depends on.
 */
function agreedState(sheet: Record<string, unknown>, db: Record<string, unknown>): SyncStateRecord {
  return {
    entityTable: "products",
    entityKey: "EP01-A02",
    version: 1,
    sheetFingerprint: fingerprint(sheet),
    dbFingerprint: fingerprint(db),
    lastSource: "system",
  };
}

function makeInput(over: Partial<PlanInput> & { rows: (string | number)[][] }): PlanInput {
  return {
    snapshot: toSnapshot([HEADERS, ...over.rows]),
    products: over.products ?? [dbProduct()],
    state: over.state ?? new Map(),
    base: over.base ?? new Map(),
    blockedByConflict: over.blockedByConflict,
  };
}

/* ------------------------------------------------------------------- A/B */

describe("A — the sheet changes a price and nothing else", () => {
  it("updates the price in the database, and only the price", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 36000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.ok).toBe(true);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.toDatabase).toHaveLength(1);
    expect(plan.toDatabase[0].changes).toEqual({ priceTzs: 36000 });
    expect(plan.toDatabase[0].sku).toBe("EP01-A02");
  });
});

describe("B — the dashboard changes a price and the sheet does not", () => {
  it("writes the new price back to the sheet", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow()],
        products: [dbProduct({ priceTzs: 41000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.toSheet).toHaveLength(1);
    expect(plan.toSheet[0].fields).toContain("priceTzs");
    expect(plan.toSheet[0].cells["PRICE TZS"]).toBe(41000);
  });
});

/* --------------------------------------------------------------------- C */

describe("C — both sides changed the same price", () => {
  it("raises a conflict and applies neither value", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 10000 })],
        products: [dbProduct({ priceTzs: 12000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]), // both were 34,000
      }),
    );

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].conflicts.map((c) => c.field)).toEqual(["priceTzs"]);
    expect(plan.conflicts[0].conflicts[0].sheetValue).toBe(10000);
    expect(plan.conflicts[0].conflicts[0].dbValue).toBe(12000);

    // Neither side silently wins.
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.toSheet).toHaveLength(0);
  });

  it("holds the row on later runs instead of re-deciding it", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 10000 })],
        products: [dbProduct({ priceTzs: 12000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
        blockedByConflict: new Set(["EP01-A02"]),
      }),
    );

    expect(plan.heldForConflict).toBe(1);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.toSheet).toHaveLength(0);
  });
});

/* --------------------------------------------------------------------- D */

describe("D — the sheet changed the name, the dashboard changed the price", () => {
  it("merges both, because they are different fields", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRODUCT VARIANT": "Multipurpose Detergent Lemon Burst" })],
        products: [dbProduct({ priceTzs: 41000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.toDatabase[0].changes).toEqual({
      displayName: "Multipurpose Detergent Lemon Burst",
    });
    expect(plan.toSheet[0].cells["PRICE TZS"]).toBe(41000);
    expect(plan.toSheet[0].fields).toEqual(["priceTzs"]);
  });
});

/* --------------------------------------------------------------------- E */

describe("E — stock is not the sheet's to change", () => {
  it("moves nothing when STOCK QTY goes from 450 to 100000", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "STOCK QTY": 100000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    // Not a change, not a conflict, not an issue. The cell is simply not an
    // instruction, and the plan carries no way to express one.
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.issues).toHaveLength(0);

    const everyChange = plan.toDatabase.flatMap((c) => Object.keys(c.changes));
    for (const forbidden of ["onHand", "on_hand", "reserved", "available", "stock", "stockQty"]) {
      expect(everyChange, `stock must never be writable from the sheet`).not.toContain(forbidden);
    }
  });

  it("reports the real available figure back into the sheet instead", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "STOCK QTY": 100000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.toSheet).toHaveLength(1);
    expect(plan.toSheet[0].cells["SYSTEM AVAILABLE STOCK"]).toBe(448);
    // And it does not "correct" the operator's own column.
    expect(plan.toSheet[0].cells["STOCK QTY"]).toBeUndefined();
  });

  it("never names an inventory field in any planned change", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "STOCK QTY": 7, "PRICE TZS": 36000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );
    expect(Object.keys(plan.toDatabase[0].changes)).toEqual(["priceTzs"]);
  });
});

/* --------------------------------------------------------------------- F */

describe("F — a product disappears from the sheet", () => {
  it("reports it and never deletes or archives it", () => {
    const plan = planSync(
      makeInput({
        rows: [], // the sheet no longer mentions EP01-A02
        products: [dbProduct()],
      }),
    );

    expect(plan.missingFromSheet).toEqual([{ sku: "EP01-A02", productId: "id-EP01-A02" }]);
    expect(plan.toDatabase).toHaveLength(0);

    // There is no delete or archive instruction anywhere in a plan.
    expect(JSON.stringify(plan)).not.toMatch(/"(delete|archive)"/i);
  });
});

/* ------------------------------------------------------------------- G/H/I */

describe("G — the same SKU on two rows", () => {
  it("applies neither and reports both rows", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 36000 }), sheetRow({ "PRICE TZS": 38000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.toDatabase).toHaveLength(0);
    const duplicate = plan.issues.find((issue) => issue.problem.includes("2 rows"));
    expect(duplicate).toBeDefined();
    expect(duplicate!.problem).toContain("EP01-A02");
  });
});

describe("H — a price that is not a price", () => {
  it("reports it and changes nothing", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": "thirty four thousand" })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );

    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.issues[0].field).toBe("priceTzs");
    expect(plan.issues[0].problem).toContain("not a price");
  });

  it("reads a price a person actually typed", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": "TSh 36,000" })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );
    expect(plan.toDatabase[0].changes).toEqual({ priceTzs: 36000 });
  });

  it("refuses an offer price that is not below the price", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "OFFER PRICE TZS": 40000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.issues[0].field).toBe("offerPriceTzs");
  });
});

describe("I — a row with no SKU", () => {
  it("is blocked and reported, and no SKU is invented", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ SKU: "", "PRODUCT VARIANT": "Something new" })],
        products: [],
      }),
    );

    expect(plan.newProducts).toHaveLength(0);
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.issues[0].problem).toContain("no SKU");
    expect(plan.issues[0].sku).toBeNull();
  });
});

/* --------------------------------------------------------------------- J */

describe("J — running the same sync twice", () => {
  it("plans nothing the second time", () => {
    const first = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 36000 })],
        base: new Map([["EP01-A02", DB_FIELDS]]),
      }),
    );
    expect(first.toDatabase).toHaveLength(1);

    // What the applier would leave behind: the database now holds 36,000, the
    // sheet already says 36,000, and the state records both fingerprints.
    const applied = dbProduct({ priceTzs: 36000 });
    const agreed: CatalogueFields = { ...DB_FIELDS, priceTzs: 36000 };

    const second = planSync(
      makeInput({
        rows: [
          sheetRow({
            "PRICE TZS": 36000,
            "SYSTEM AVAILABLE STOCK": 448,
            "SYSTEM IMAGE": "Photo on file",
            "SYSTEM ON WEBSITE": "On the website",
            "SYSTEM BLOCKED REASON": "",
            "SYSTEM LAST SYNCED": new Date().toISOString().slice(0, 16).replace("T", " "),
          }),
        ],
        products: [applied],
        base: new Map([["EP01-A02", agreed]]),
      }),
    );

    expect(second.toDatabase).toHaveLength(0);
    expect(second.toSheet).toHaveLength(0);
    expect(second.conflicts).toHaveLength(0);
    expect(second.unchanged).toBe(1);
  });

  it("recognises its own write coming back as an echo", () => {
    /*
      The reachable version of this. The dashboard raised the price to 36,000,
      the last run pushed that into the sheet and recorded the agreement — so
      the sheet, the database and the base all now say 36,000, and every
      fingerprint is the fingerprint of that.

      The next run reads the sheet and sees its own handwriting. That is an
      echo, and it must produce no work in either direction.

      (An earlier version of this test set the fingerprints to 36,000 while
      leaving the base and the database at 34,000 — a state the applier cannot
      produce, because it writes the value and the base in the same breath.
      Asserting against an impossible state proves nothing.)
    */
    const agreed: CatalogueFields = { ...DB_FIELDS, priceTzs: 36000 };
    const comparable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(agreed)) {
      if (key !== "variantLabel") comparable[key] = value;
    }

    const plan = planSync(
      makeInput({
        rows: [sheetRow({ "PRICE TZS": 36000 })],
        products: [dbProduct({ priceTzs: 36000 })],
        base: new Map([["EP01-A02", agreed]]),
        state: new Map([["EP01-A02", agreedState(comparable, comparable)]]),
      }),
    );

    expect(plan.echoes).toBe(1);
    expect(plan.toDatabase).toHaveLength(0);
  });

  it("still sends a dashboard change to the sheet when the sheet is an echo", () => {
    /*
      The bug this catches: an echo used to end the row's processing entirely,
      so a price raised in the dashboard never reached a sheet that happened to
      be showing our own last write. An echo means the SHEET has nothing to
      say — not that the product should be skipped.
    */
    const agreed: CatalogueFields = { ...DB_FIELDS };
    const comparable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(agreed)) {
      if (key !== "variantLabel") comparable[key] = value;
    }

    const plan = planSync(
      makeInput({
        rows: [sheetRow()],
        products: [dbProduct({ priceTzs: 41000 })],
        base: new Map([["EP01-A02", agreed]]),
        state: new Map([["EP01-A02", agreedState(comparable, comparable)]]),
      }),
    );

    expect(plan.echoes).toBe(1);
    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.toSheet).toHaveLength(1);
    expect(plan.toSheet[0].cells["PRICE TZS"]).toBe(41000);
  });
});

/* --------------------------------------------------------- new and blocked */

describe("a SKU the shop has never seen", () => {
  it("is offered as a new product rather than applied to nothing", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ SKU: "EP99-Z01", "SEO SLUG": "brand-new-thing" })],
        products: [],
      }),
    );

    expect(plan.newProducts).toHaveLength(1);
    expect(plan.newProducts[0].sku).toBe("EP99-Z01");
    expect(plan.toDatabase).toHaveLength(0);
  });

  it("does not invent a product for the orphan image EP23-A02", () => {
    // The image exists in Storage; the master has no row. The sheet is the only
    // thing that may create a product, and it does not mention this SKU.
    const plan = planSync(makeInput({ rows: [sheetRow()], products: [dbProduct()] }));
    expect(plan.newProducts.map((p) => p.sku)).not.toContain("EP23-A02");
  });
});

describe("EP01-A01, the suspicious price", () => {
  it("is carried across as the unresolved value it is, never multiplied", () => {
    const plan = planSync(
      makeInput({
        rows: [sheetRow({ SKU: "EP01-A01", "PRICE TZS": 128, "SEO SLUG": "ep01-a01" })],
        products: [dbProduct({ priceTzs: 128, slug: "ep01-a01" }, "EP01-A01")],
        base: new Map([["EP01-A01", { ...DB_FIELDS, priceTzs: 128, slug: "ep01-a01" }]]),
      }),
    );

    expect(plan.toDatabase).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(JSON.stringify(plan)).not.toContain("128000");
  });
});

/* ------------------------------------------------------------------ headers */

describe("the header row is checked before any row is read", () => {
  it("stops on a column nobody has classified", () => {
    const plan = planSync(makeInput({ rows: [sheetRow()] }));
    expect(plan.ok).toBe(true);

    const withStray = planSync({
      snapshot: toSnapshot([[...HEADERS, "SECRET MARGIN"], [...sheetRow(), "0.4"]]),
      products: [dbProduct()],
      state: new Map(),
      base: new Map(),
    });

    expect(withStray.ok).toBe(false);
    expect(withStray.stopped).toContain("SECRET MARGIN");
    expect(withStray.toDatabase).toHaveLength(0);
    expect(withStray.toSheet).toHaveLength(0);
  });

  it("stops when a column it depends on has been renamed away", () => {
    const renamed = HEADERS.map((h) => (h === "PRICE TZS" ? "RETAIL PRICE" : h));
    const plan = planSync({
      snapshot: toSnapshot([renamed, sheetRow()]),
      products: [dbProduct()],
      state: new Map(),
      base: new Map(),
    });

    expect(plan.ok).toBe(false);
    expect(plan.stopped).toContain("PRICE TZS");
  });

  it("does not care what order the columns are in", () => {
    const shuffled = [...HEADERS].reverse();
    const row = sheetRow({ "PRICE TZS": 36000 });
    const shuffledRow = shuffled.map((header) => row[HEADERS.indexOf(header)]);

    const plan = planSync({
      snapshot: toSnapshot([shuffled, shuffledRow]),
      products: [dbProduct()],
      state: new Map(),
      base: new Map([["EP01-A02", DB_FIELDS]]),
    });

    expect(plan.ok).toBe(true);
    expect(plan.toDatabase[0].changes).toEqual({ priceTzs: 36000 });
  });
});
