"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

/**
 * Sticky mobile cart bar. It only appears once there is something in the cart,
 * so it never steals space from the catalogue while browsing, and it hides on
 * the cart and checkout pages where it would duplicate the on-page action.
 */
export function MobileDock() {
  const { count, subtotal, openCart, hydrated } = useCart();
  const pathname = usePathname();

  const hiddenHere = pathname === "/cart" || pathname.startsWith("/checkout");
  if (!hydrated || count === 0 || hiddenHere) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(15_23_42/0.08)] backdrop-blur-lg lg:hidden">
      <div className="shell py-3">
        <button
          type="button"
          onClick={openCart}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-slate-900 px-5 text-white transition-colors hover:bg-brand-600"
        >
          <span className="flex items-center gap-2.5">
            <Icon name="cart" className="h-5 w-5" />
            <span className="font-display text-base font-bold">
              View cart · {count} {count === 1 ? "item" : "items"}
            </span>
          </span>
          <span className="text-base font-black whitespace-nowrap">{formatPrice(subtotal)}</span>
        </button>
      </div>
    </div>
  );
}
