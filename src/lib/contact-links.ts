import type { Contact } from "./contact";

export function whatsappHref(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** A missing business contact must never become a link to a sample number. */
export function contactWhatsAppHref(contact: Pick<Contact, "whatsappNumber" | "placeholder">, message: string): string | null {
  if (contact.placeholder.whatsapp || contact.whatsappNumber === "255700000000" || !/^\d{10,15}$/.test(contact.whatsappNumber)) return null;
  return whatsappHref(contact.whatsappNumber, message);
}
