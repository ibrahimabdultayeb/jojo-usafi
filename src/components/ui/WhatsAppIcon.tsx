/**
 * THE WhatsApp mark for Jojo Usafi.
 *
 * One component, used everywhere WhatsApp is offered: the storefront floating
 * support button, the mobile menu's support link, the footer, the contact and
 * track-order pages, and the admin's "WhatsApp customer" actions.
 *
 * It is a real path, not a line-icon approximation and not a font glyph. The
 * shared line-icon set in `Icon.tsx` is drawn on a 24px grid with a 2px stroke
 * and no fill, which is right for a cart or a search icon and wrong for a brand
 * mark — stroking the WhatsApp handset outline that way traced its silhouette
 * as a scribble instead of filling it, which is what made the admin's buttons
 * look broken. The mark is therefore defined once, here, as a filled shape, and
 * `Icon.tsx` deliberately does not carry a `whatsapp` entry for anyone to reach
 * for by mistake.
 *
 * The artwork is drawn edge to edge inside its 24×24 box and is optically
 * centred on the round bubble, so it sits correctly in a flex row next to a
 * label and in the middle of a circular button.
 *
 * SIZING
 *   inline action buttons   h-5 w-5  (20px)
 *   icon-only controls      the icon stays 20–28px inside a >= 44px target
 *
 * ACCESSIBILITY
 *   The mark is `aria-hidden` by default: next to a visible label it would only
 *   repeat it. An icon-only control must name itself — give the button or link
 *   an `aria-label`, or pass a `title` here for a control that has neither.
 */

interface WhatsAppIconProps {
  className?: string;
  /**
   * Names the icon itself. Only for a control that carries no visible label and
   * no `aria-label` of its own — otherwise the name is read twice.
   */
  title?: string;
}

export function WhatsAppIcon({ className = "h-5 w-5", title }: WhatsAppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01ZM12.05 20.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

