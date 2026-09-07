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
