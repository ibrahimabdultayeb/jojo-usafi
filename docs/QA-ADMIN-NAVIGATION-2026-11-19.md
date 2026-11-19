# Admin navigation and colour update — 19 November 2026

## Changes

- Removed the remaining foreground globe from all shared authentication panels. The original Jojo Usafi wordmark watermark stays in place.
- Adapted React Bits Branched Menu to real, route-aware Next.js navigation with the existing role/capability filtering and icon set. Sections fold with animated connecting paths; closed sections are inert and leave the keyboard tab order.
- Widened the desktop sidebar from 240px to 312px. Added an accessible collapse/expand button and an 88px icon rail. The preference survives refresh; storage failures do not block navigation. The full staff name fits on one line, with truncation and a full-name tooltip for unusually long names.
- Added the same branched navigation to the mobile navigation dialog, retaining the bottom shortcuts and existing dialog focus/escape handling.
- Replaced the pale canvas and white cards with scoped navy/slate surfaces, blue controls and distinct dark status badges. Shared forms, dialogs, tables and existing admin screens inherit the palette. Storefront colours are unchanged.
- Gave overview cards responsive container breakpoints, clearer hierarchy and two independent content columns so attention rows do not create empty space below the collection card.

## Checks

- Typecheck and lint passed; all 233 existing tests passed. Next.js production build passed (220 generated pages).
- Browser component checks at 1363px, 2726px and 340px CSS viewport widths: no horizontal page overflow; three/six/two summary columns respectively.
- Expanded sidebar measured 312px; collapsed rail measured 88px and persisted after reload. Ibrahim Abdul Tayeb's name has a single 19.5px line and equal client/scroll width (126px).
- Branch route highlight verified on the Orders list and a nested order detail. Closing Operations reduces its body to 0px; pressing Tab from its heading moves to Management, skipping hidden links.
- Mobile navigation opens, scrolls, selects Orders and closes the dialog. Existing focus trapping and Escape dismissal remain functional.
- Cancel-order dialog, disabled controls and the Other-reason input checked visually against the dark palette. No order mutation was submitted.
- Core text contrast: body 14.13:1, secondary copy 7.58:1, navigation 9.88:1, primary-button label 4.80:1. Warning/preparing/error badge pairs each exceed 8:1.
- Authentication preview has no foreground globe SVG and retains the original wordmark asset.

The component harness and its sample data stay outside the repository and are not deployed. Signed-in live workflow testing requires an existing staff session; this change does not alter authentication, database writes or permissions. Deployment targets only release/storefront-staging.
