import { describe, expect, it } from "vitest";
import { contactWhatsAppHref } from "./contact-links";
const flags = {whatsapp:false, phone:false, email:false, address:false};
describe("public support links", () => {
  it("never directs a shopper to fallback, missing or malformed numbers", () => {
    for (const number of ["255700000000", "", "undefined", "+255 712 345 678"]) {
      expect(contactWhatsAppHref({whatsappNumber:number,placeholder:flags}, "Help")).toBeNull();
    }
    expect(contactWhatsAppHref({whatsappNumber:"255712345678",placeholder:{...flags,whatsapp:true}},"Help")).toBeNull();
  });
  it("links a configured number and safely encodes the message", () => {
    expect(contactWhatsAppHref({whatsappNumber:"255712345678",placeholder:flags},"Order #123 & help"))
      .toBe("https://wa.me/255712345678?text=Order%20%23123%20%26%20help");
  });
});
