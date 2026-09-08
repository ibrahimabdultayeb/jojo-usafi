"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useLocale } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n";
import { stripLocale } from "@/lib/i18n/config";

/**
 * Sticky mobile cart bar. It only appears once there is something in the cart,
 * so it never steals space from the catalogue while browsing, and it hides on
 * the cart and checkout pages where it would duplicate the on-page action.
 *
 * Floating layer: `z-50` — it owns the bottom edge, and the WhatsApp support
 * button lifts above it while it is showing.
 */
export function MobileDock() {
  const { count, subtotal, openCart, hydrated } = useCart();
  const { t } = useLocale();
  const pathname = usePathname();

  const here = stripLocale(pathname);
  const hiddenHere = here === "/cart" || here.startsWith("/checkout");
  if (!hydrated || count === 0 || hiddenHere) return null;

  const items = fill(count === 1 ? t.cart.itemsOne : t.cart.itemsMany, { count });

  return (
    <div data-qa="mobile-dock" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(15_23_42/0.08)] backdrop-blur-lg lg:hidden">
      <div className="shell py-3">
        <button
          type="button"
          onClick={openCart}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-slate-900 px-5 text-white transition-colors hover:bg-brand-600"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon name="cart" className="h-5 w-5 shrink-0" />
            <span className="truncate font-display text-base font-bold">
              {fill(t.cart.viewCartWithCount, { items })}
            </span>
          </span>
          <span className="text-base font-black whitespace-nowrap">{formatPrice(subtotal)}</span>
        </button>
      </div>
    </div>
  );
}
