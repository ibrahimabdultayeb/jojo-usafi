"use client";

import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/i18n/client";
import { site } from "@/lib/site";
import { useWhatsAppLink } from "@/lib/ContactContext";

/**
 * WhatsApp is a SUPPORT channel, not the checkout. This button asks a question;
 * it never places an order.
 *
 * FLOATING LAYER CONTRACT (see globals.css):
 *   the support button and the mobile cart dock share the `z-50` floating layer
 *   and must never overlap. The dock owns the bottom edge whenever it is
 *   visible, so this button lifts clear of it on phones. On `lg` the dock is
 *   hidden, so the button returns to the bottom corner.
 */
export function SupportButton() {
  const { count, hydrated } = useCart();
  const { t } = useLocale();
  const href = useWhatsAppLink(t.support.message);
  const liftedByDock = hydrated && count > 0;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-qa="support-button"
      aria-label={t.support.ariaLabel}
      title={site.name}
      className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/35 ring-1 ring-black/5 transition-[transform,box-shadow,bottom] duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[#25D366]/45 focus-visible:ring-4 focus-visible:ring-[#25D366]/40 active:scale-95 sm:right-6 ${
        liftedByDock
          ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6"
          : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:bottom-6"
      }`}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
