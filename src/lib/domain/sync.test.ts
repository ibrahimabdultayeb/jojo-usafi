import { describe, expect, it } from "vitest";
import {
  MAX_SYNC_RETRIES,
  decideSync,
  detectConflicts,
  fingerprint,
  idempotencyKey,
  isEcho,
  isStaleWrite,
  nextRetryDelayMs,
  parseSyncEvent,
  type SyncStateRecord,
} from "./sync";

const PRODUCT = { sku: "EP01-A02", price_tzs: 34000, storefront_visible: true };

const state = (overrides: Partial<SyncStateRecord> = {}): SyncStateRecord => ({
  entityTable: "products",
  entityKey: "EP01-A02",
  version: 1,
  dbFingerprint: null,
  sheetFingerprint: null,
  lastSource: null,
  ...overrides,
});

describe("fingerprints", () => {
  it("are stable across runs", () => {
    expect(fingerprint(PRODUCT)).toBe(fingerprint({ ...PRODUCT }));
  });

  it("do not depend on key order", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it("change when a value changes", () => {
    expect(fingerprint(PRODUCT)).not.toBe(fingerprint({ ...PRODUCT, price_tzs: 34001 }));
  });

  it("do not confuse a number with the same digits as a string", () => {
    expect(fingerprint({ price_tzs: 4000 })).not.toBe(fingerprint({ price_tzs: "4000" }));
  });

  it("treat a missing value and an explicit null the same way", () => {
    expect(fingerprint({ a: 1, b: null })).toBe(fingerprint({ a: 1, b: undefined }));
    expect(fingerprint({ a: 1, b: null })).toBe(fingerprint({ a: 1 }));
  });

  it("still care where a null sits inside a list", () => {
    expect(fingerprint({ a: [1, null] })).not.toBe(fingerprint({ a: [null, 1] }));
  });

  it("ignore the spare whitespace a spreadsheet cell carries", () => {
    expect(fingerprint({ name: "Softi Handwash" })).toBe(fingerprint({ name: " Softi Handwash " }));
  });

  it("are 16 hex characters, whatever went in", () => {
    expect(fingerprint(PRODUCT)).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint({})).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint({ nested: { deep: [1, "two", null] } })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("idempotency", () => {
  it("gives the same instruction the same key, so a retry is recognised", () => {
    const parts = {
      direction: "sheet_to_db" as const,
      entityTable: "products",
      entityKey: "EP01-A02",
      operation: "update" as const,
      fingerprint: fingerprint(PRODUCT),
    };
    expect(idempotencyKey(parts)).toBe(idempotencyKey({ ...parts }));
  });

  it("gives a different change a different key", () => {
    const base = {
      direction: "sheet_to_db" as const,
      entityTable: "products",
      entityKey: "EP01-A02",
      operation: "update" as const,
    };
    expect(idempotencyKey({ ...base, fingerprint: fingerprint(PRODUCT) })).not.toBe(
      idempotencyKey({ ...base, fingerprint: fingerprint({ ...PRODUCT, price_tzs: 1 }) }),
    );
  });
});

describe("echo prevention", () => {
  it("recognises our own write coming back from the sheet", () => {
    const written = fingerprint(PRODUCT);
    expect(
      isEcho({ direction: "sheet_to_db", fingerprint: written }, state({ sheetFingerprint: written })),
    ).toBe(true);
  });

  it("does not mistake a genuine sheet edit for an echo", () => {
    expect(
      isEcho(
        { direction: "sheet_to_db", fingerprint: fingerprint({ ...PRODUCT, price_tzs: 35000 }) },
        state({ sheetFingerprint: fingerprint(PRODUCT) }),
      ),
    ).toBe(false);
  });

  it("checks the side the change is coming from, not the other one", () => {
    const written = fingerprint(PRODUCT);
    expect(
      isEcho({ direction: "db_to_sheet", fingerprint: written }, state({ sheetFingerprint: written })),
    ).toBe(false);
  });

  it("treats a first-ever change as new, not as an echo", () => {
    expect(isEcho({ direction: "sheet_to_db", fingerprint: fingerprint(PRODUCT) }, null)).toBe(false);
  });
});

describe("stale writes", () => {
  it("catches a change computed against a version we have moved past", () => {
    expect(
      isStaleWrite(
        { direction: "sheet_to_db", baseFingerprint: fingerprint(PRODUCT) },
        state({ dbFingerprint: fingerprint({ ...PRODUCT, price_tzs: 35000 }) }),
      ),
    ).toBe(true);
  });

  it("accepts a change computed against the current version", () => {
    const current = fingerprint(PRODUCT);
    expect(
      isStaleWrite({ direction: "sheet_to_db", baseFingerprint: current }, state({ dbFingerprint: current })),
    ).toBe(false);
  });

  it("does not call an unversioned change stale", () => {
    expect(
      isStaleWrite({ direction: "sheet_to_db", baseFingerprint: null }, state({ dbFingerprint: "abc" })),
    ).toBe(false);
  });
});

describe("conflicts", () => {
  it("reports a field both sides changed differently", () => {
    const conflicts = detectConflicts(
      { price_tzs: 35000, sku: "EP01-A02" },
      { price_tzs: 36000, sku: "EP01-A02" },
      { price_tzs: 34000, sku: "EP01-A02" },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ field: "price_tzs", sheetValue: 35000, dbValue: 36000 });
  });

  it("is not a conflict when only one side changed", () => {
    expect(
      detectConflicts({ price_tzs: 35000 }, { price_tzs: 34000 }, { price_tzs: 34000 }),
    ).toHaveLength(0);
  });

  it("is not a conflict when both sides made the same change", () => {
    expect(
      detectConflicts({ price_tzs: 35000 }, { price_tzs: 35000 }, { price_tzs: 34000 }),
    ).toHaveLength(0);
  });

  it("cannot detect a conflict without a version both sides agreed on", () => {
    expect(detectConflicts({ price_tzs: 35000 }, { price_tzs: 36000 }, null)).toHaveLength(0);
  });
});

describe("the whole decision", () => {
  it("skips an echo before doing anything else", () => {
    const written = fingerprint(PRODUCT);
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming: PRODUCT,
      current: { ...PRODUCT, price_tzs: 99 },
      base: PRODUCT,
      state: state({ sheetFingerprint: written }),
    });
    expect(decision.action).toBe("skip_echo");
  });

  it("refuses a stale write before comparing values", () => {
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming: { ...PRODUCT, price_tzs: 35000 },
      current: { ...PRODUCT, price_tzs: 36000 },
      base: PRODUCT,
      state: state({ dbFingerprint: fingerprint({ ...PRODUCT, price_tzs: 36000 }) }),
    });
    expect(decision.action).toBe("stale");
  });

  it("raises a conflict rather than picking a winner", () => {
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming: { ...PRODUCT, price_tzs: 35000 },
      current: { ...PRODUCT, price_tzs: 36000 },
      base: PRODUCT,
      state: null,
    });
    expect(decision.action).toBe("conflict");
    expect(decision.action === "conflict" && decision.conflicts[0]?.field).toBe("price_tzs");
  });

  it("applies only the fields that actually changed", () => {
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming: { ...PRODUCT, price_tzs: 35000 },
      current: PRODUCT,
      base: PRODUCT,
      state: null,
    });
    expect(decision.action).toBe("apply");
    expect(decision.action === "apply" && decision.changes).toEqual({ price_tzs: 35000 });
  });

  it("applies nothing when nothing changed", () => {
    const decision = decideSync({
      direction: "sheet_to_db",
      incoming: PRODUCT,
      current: PRODUCT,
      base: PRODUCT,
      state: null,
    });
    expect(decision.action === "apply" && decision.changes).toEqual({});
  });
});

describe("retries", () => {
  it("backs off further each time", () => {
    const first = nextRetryDelayMs(0);
    const second = nextRetryDelayMs(1);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first!);
  });

  it("gives up rather than retrying forever", () => {
    expect(nextRetryDelayMs(MAX_SYNC_RETRIES)).toBeNull();
    expect(nextRetryDelayMs(MAX_SYNC_RETRIES + 1)).toBeNull();
  });

  it("never waits longer than fifteen minutes", () => {
    for (let i = 0; i < MAX_SYNC_RETRIES; i += 1) {
      expect(nextRetryDelayMs(i)!).toBeLessThanOrEqual(15 * 60_000);
    }
  });
});

describe("sync records", () => {
  const record = {
    source: "sheet",
    direction: "sheet_to_db",
    operation: "update",
    entityTable: "products",
    entityKey: "EP01-A02",
    fingerprint: fingerprint(PRODUCT),
    idempotencyKey: "sheet_to_db:products:EP01-A02:update:abc",
    sheetTab: "Products",
    sheetRow: 12,
  };

  it("accepts a well-formed record", () => {
    expect(parseSyncEvent(record).ok).toBe(true);
  });

  it("refuses a fingerprint that is not one", () => {
    expect(parseSyncEvent({ ...record, fingerprint: "nope" }).ok).toBe(false);
  });

  it("refuses a row with no key to identify it", () => {
    expect(parseSyncEvent({ ...record, entityKey: "" }).ok).toBe(false);
  });

  it("refuses a table name that is not one", () => {
    expect(parseSyncEvent({ ...record, entityTable: "Products; drop table" }).ok).toBe(false);
  });

  it("refuses a failure that does not say what went wrong", () => {
    const result = parseSyncEvent({ ...record, status: "failed" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/what went wrong/i);
    expect(parseSyncEvent({ ...record, status: "failed", errorMessage: "Sheet unreachable" }).ok).toBe(true);
  });

  it("refuses more retries than the worker will ever make", () => {
    expect(parseSyncEvent({ ...record, retryCount: MAX_SYNC_RETRIES + 1 }).ok).toBe(false);
  });
});
