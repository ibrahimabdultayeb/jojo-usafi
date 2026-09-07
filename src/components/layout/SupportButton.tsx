"use client";

import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { site, whatsappLink } from "@/lib/site";

/**
 * WhatsApp is a SUPPORT channel, not the checkout. This button asks a question;
 * it never places an order.
 */
export function SupportButton() {
  const { count, hydrated } = useCart();
  const liftedByDock = hydrated && count > 0;

  return (
    <a
      href={whatsappLink(`Hi ${site.name}, I need help.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Jojo Usafi support on WhatsApp"
      className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-2xl sm:right-6 ${
        liftedByDock ? "bottom-24 lg:bottom-6" : "bottom-5 sm:bottom-6"
      }`}
    >
      <Icon name="whatsapp" className="h-7 w-7" />
    </a>
  );
}
