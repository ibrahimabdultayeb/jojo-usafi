import { describe, expect, it } from "vitest";
import {
  customerKey,
  initialsFor,
  parseCustomerAddress,
  parseCustomerIdentity,
} from "./customers";
import { missingLocales, parseLocale, resolveContent } from "./content";

describe("customer identity", () => {
  const identity = { fullName: "Hassan Ali", phone: "0712 884 210", email: null };

  it("needs only a name and a phone number — guest checkout stays guest checkout", () => {
    const parsed = parseCustomerIdentity(identity);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.phone).toBe("+255712884210");
    expect(parsed.ok && parsed.value.email).toBeNull();
  });

  it("accepts an email when one is offered", () => {
    const parsed = parseCustomerIdentity({ ...identity, email: "hassan.ali@example.com" });
    expect(parsed.ok && parsed.value.email).toBe("hassan.ali@example.com");
  });

  it("refuses an email that is not one, rather than storing a typo", () => {
    expect(parseCustomerIdentity({ ...identity, email: "hassan.ali@" }).ok).toBe(false);
  });

  it("refuses a missing name", () => {
    const parsed = parseCustomerIdentity({ ...identity, fullName: " " });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.code).toBe("invalid_name");
  });

  it("reports a bad phone number as a phone problem", () => {
    const parsed = parseCustomerIdentity({ ...identity, phone: "0812884210" });
    expect(parsed.ok === false && parsed.code).toBe("invalid_phone");
  });

  it("keys a returning customer to the same person however they typed their number", () => {
    const first = customerKey("0712884210");
    const second = customerKey("+255 712 884 210");
    expect(first.ok && second.ok && first.value === second.value).toBe(true);
  });

  it("builds sensible initials for a customer card", () => {
    expect(initialsFor("Hassan Ali")).toBe("HA");
    expect(initialsFor("Joseph  Mwakalinga")).toBe("JM");
    expect(initialsFor("Neema")).toBe("N");
    expect(initialsFor("  ")).toBe("?");
  });
});

describe("delivery addresses", () => {
  const address = {
    label: "Home",
    deliveryZoneName: "Upanga",
    addressLine: "Ocean Road, near Aga Khan Hospital",
    landmark: "Opposite the blue gate",
    instructions: null,
    isDefault: true,
  };

  it("accepts an ordinary address", () => {
    expect(parseCustomerAddress(address).ok).toBe(true);
  });

  it("insists on an area and an address line", () => {
    expect(parseCustomerAddress({ ...address, deliveryZoneName: "" }).ok).toBe(false);
    expect(parseCustomerAddress({ ...address, addressLine: "x" }).ok).toBe(false);
  });

  it("treats the landmark as optional, because not every address has one", () => {
    expect(parseCustomerAddress({ ...address, landmark: null }).ok).toBe(true);
  });
});

describe("localized content", () => {
  const rows = [
    { locale: "en" as const, name: "Multipurpose Detergent" },
    { locale: "sw" as const, name: "Sabuni ya Matumizi Mengi" },
  ];

  it("shows the requested language when it exists", () => {
    expect(resolveContent(rows, "sw")?.name).toBe("Sabuni ya Matumizi Mengi");
  });

  it("falls back to English rather than inventing a translation", () => {
    const englishOnly = [rows[0]];
    expect(resolveContent(englishOnly, "sw")?.name).toBe("Multipurpose Detergent");
  });

  it("returns nothing when there is no content at all, instead of a blank name", () => {
    expect(resolveContent([], "en")).toBeNull();
  });

  it("reports which languages are still missing", () => {
    expect(missingLocales([rows[0]])).toEqual(["sw"]);
    expect(missingLocales(rows)).toEqual([]);
  });

  it("accepts only languages the store actually speaks", () => {
    expect(parseLocale("en").ok).toBe(true);
    expect(parseLocale("sw").ok).toBe(true);
    expect(parseLocale("fr").ok).toBe(false);
  });
});
