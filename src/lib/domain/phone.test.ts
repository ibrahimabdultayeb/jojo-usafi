import { describe, expect, it } from "vitest";
import {
  formatPhoneE164,
  isTanzanianPhoneE164,
  parseTanzanianPhone,
  tanzanianPhoneSchema,
} from "./phone";

const EXPECTED = "+255712884210";

describe("Tanzanian phone numbers", () => {
  it("lands the same customer on the same row however they typed it", () => {
    const shapes = [
      "0712884210",
      "0712 884 210",
      "0712-884-210",
      "712884210",
      "255712884210",
      "+255712884210",
      "+255 712 884 210",
      "00255712884210",
      "+255 (0)712 884 210",
      "  0712884210  ",
      "(0712) 884.210",
    ];
    for (const shape of shapes) {
      const parsed = parseTanzanianPhone(shape);
      expect(parsed.ok, `${shape} should parse`).toBe(true);
      expect(parsed.ok && parsed.value.e164, shape).toBe(EXPECTED);
    }
  });

  it("produces every form the application needs from one input", () => {
    const parsed = parseTanzanianPhone("0712884210");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.e164).toBe("+255712884210");
    expect(parsed.value.national).toBe("712884210");
    expect(parsed.value.display).toBe("+255 712 884 210");
    // wa.me takes no plus and no spaces.
    expect(parsed.value.whatsapp).toBe("255712884210");
  });

  it("accepts both mobile prefixes in use", () => {
    expect(parseTanzanianPhone("0682771903").ok).toBe(true);
    expect(parseTanzanianPhone("0754220118").ok).toBe(true);
  });

  it("refuses a number that cannot receive a WhatsApp message", () => {
    for (const bad of [
      "0222123456", // Dar landline
      "071288421", // one digit short
      "07128842100", // one digit long
      "0812884210", // no such mobile prefix
      "+254712884210", // Kenya
      "",
      "   ",
      "not a phone",
      "0712-88a-210",
    ]) {
      expect(parseTanzanianPhone(bad).ok, `${bad} should be refused`).toBe(false);
    }
  });

  it("refuses a non-string rather than coercing it", () => {
    expect(parseTanzanianPhone(712884210).ok).toBe(false);
    expect(parseTanzanianPhone(null).ok).toBe(false);
    expect(parseTanzanianPhone(undefined).ok).toBe(false);
  });

  it("says what to do instead of what went wrong", () => {
    const parsed = parseTanzanianPhone("0812884210");
    expect(parsed.ok === false && parsed.reason).toMatch(/0712 884 210/);
  });

  it("recognises only the stored form as already normalised", () => {
    expect(isTanzanianPhoneE164(EXPECTED)).toBe(true);
    expect(isTanzanianPhoneE164("0712884210")).toBe(false);
    expect(isTanzanianPhoneE164("255712884210")).toBe(false);
  });

  it("is idempotent — normalising a normalised number changes nothing", () => {
    const once = parseTanzanianPhone("0712884210");
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = parseTanzanianPhone(once.value.e164);
    expect(twice.ok && twice.value.e164).toBe(once.value.e164);
  });

  it("reads a stored number back for a human", () => {
    expect(formatPhoneE164(EXPECTED)).toBe("+255 712 884 210");
  });

  it("gives a form its stored value directly", () => {
    expect(tanzanianPhoneSchema.parse("0712 884 210")).toBe(EXPECTED);
    expect(tanzanianPhoneSchema.safeParse("0812884210").success).toBe(false);
  });
});
