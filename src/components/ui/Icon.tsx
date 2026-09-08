import type { SVGProps } from "react";

/**
 * A small local icon set in the lucide line style (24px grid, 2px stroke,
 * round caps). Kept inline so the storefront ships no icon dependency and no
 * icon font request.
 */

const paths = {
  search: ["M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0", "m21 21-4.3-4.3"],
  cart: [
    "M8 21m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
    "M19 21m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
    "M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H6",
  ],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["m6 6 12 12", "m18 6-12 12"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12", "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"],
  arrowRight: ["M5 12h14", "m13 5 7 7-7 7"],
  arrowLeft: ["M19 12H5", "m11 19-7-7 7-7"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronRight: ["m9 6 6 6-6 6"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  truck: ["M3 6h11v9H3z", "M14 9h4l3 3v3h-7z", "M7.5 18m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0", "M17.5 18m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"],
  star: ["m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z"],
  whatsapp: [
    "M20 12a8 8 0 0 1-11.9 7L4 20l1.1-3.9A8 8 0 1 1 20 12Z",
    "M9.2 9c.3-.7.6-.7.9-.7h.6c.2 0 .5 0 .7.5l.7 1.7c.1.3 0 .5-.1.7l-.4.5c-.1.2-.2.3 0 .6a6 6 0 0 0 2.6 2.2c.3.1.5.1.6 0l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4a1.9 1.9 0 0 1-1.3 1.6c-.4.1-1 .2-3-.7a10 10 0 0 1-4-3.6c-.6-1-.8-1.8-.8-2.4a2.4 2.4 0 0 1 .3-1.1Z",
  ],
  mapPin: ["M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 1 1 16 0Z", "M12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
  phone: ["M15.5 21A13.5 13.5 0 0 1 3 8.5 2.5 2.5 0 0 1 5.5 6h1.8a1 1 0 0 1 1 .8l.7 3a1 1 0 0 1-.5 1.1l-1.3.7a11 11 0 0 0 4.7 4.7l.7-1.3a1 1 0 0 1 1.1-.5l3 .7a1 1 0 0 1 .8 1v1.8A2.5 2.5 0 0 1 15.5 21Z"],
  mail: ["M3 6h18v12H3z", "m3 7 9 6 9-6"],
  clock: ["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M12 7v5l3 2"],
  package: ["M21 8 12 3 3 8v8l9 5 9-5z", "m3 8 9 5 9-5", "M12 13v8"],
  check: ["m5 13 4 4L19 7"],
  sparkle: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m6 6 2.5 2.5", "m15.5 15.5 2.5 2.5", "m18 6-2.5 2.5", "m8.5 15.5-2.5 2.5"],
  chevronsDown: ["m7 6 5 5 5-5", "m7 13 5 5 5-5"],
  leaf: ["M4 20c0-8 6-14 16-14 0 10-6 15-13 15", "M4 20c3-4 6-6 10-8"],
  wallet: ["M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 7a2 2 0 0 1 2-2h11", "M16 13h2"],
  message: ["M21 12a8 8 0 0 1-11.9 7L4 20l1.1-3.9A8 8 0 1 1 21 12Z"],
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  /** Fill the shape as well as stroke it — used for the rating star. */
  filled?: boolean;
}

export function Icon({ name, filled = false, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * The WhatsApp mark, drawn as a solid glyph rather than approximated with the
 * line-icon stroke set. Used wherever the button is the WhatsApp support entry
 * point and has to read as the real thing at 24px on a phone.
 */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01ZM12.05 20.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}
