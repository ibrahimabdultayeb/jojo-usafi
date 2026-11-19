"use client";

import { createContext, useContext, type ReactNode } from "react";
import { site } from "@/lib/site";
import type { Contact } from "@/lib/contact";
import { contactWhatsAppHref } from "@/lib/contact-links";

/**
 * The shop's contact details, handed to the browser once.
 *
 * Four client components need a WhatsApp link — the floating support button,
 * the mobile menu, Track Order and the order confirmation — and a client
 * component cannot `await` a database read. The server resolves the details
 * once in the layout and passes them down here, exactly as it does with the
 * catalogue.
 *
 * The default is the placeholder set in `src/lib/site.ts`, so components can detect missing details. Support links stay hidden
 * until the shop supplies a real contact number.
 */

const FALLBACK: Contact = {
  whatsappNumber: site.whatsappNumber,
  phone: site.phone,
  email: site.email,
  addressLine: site.addressLine,
  placeholder: { whatsapp: true, phone: true, email: true, address: true },
};

const ContactContext = createContext<Contact>(FALLBACK);

export function ContactProvider({ contact, children }: { contact: Contact; children: ReactNode }) {
  return <ContactContext.Provider value={contact}>{children}</ContactContext.Provider>;
}

export function useContact(): Contact {
  return useContext(ContactContext);
}

/** The common case: a WhatsApp link to whatever number the shop is using. */
export function useWhatsAppLink(message: string): string | null {
  return contactWhatsAppHref(useContact(), message);
}
