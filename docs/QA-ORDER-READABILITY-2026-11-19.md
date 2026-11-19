# Orders readability — 19 November 2026

## Change

- Six columns group order/date, customer/phone, delivery zone, total/items/payment, status and next step.
- Main order text is 16px; dates, full phone numbers, status labels and actions are 14px. Names and values wrap instead of being shortened.
- Order actions use visible buttons at least 48px high, retain the existing detail links, and preserve lattice navigation feedback without shifting the button.
- At narrower container widths, cards expose the same information, including phone and payment details previously absent from the compact view.
- Long dropdown options wrap, and the existing selection highlight follows their measured height.
- The full-height empty state and stable scrollbar gutter remain in place.

## Verification

The browser preview uses the real components and styles with synthetic orders; it is outside the repository and is not deployed. No live orders, stock, credentials or permissions were changed.

- 1363px viewport, collapsed sidebar: table; 16px customer text, 14px phone/status text; action buttons 158.5px wide and 48px high (68px for the longest two-line action). No cell or page horizontal overflow.
- Expanded sidebar: two-column card layout, including a long business name and an unusually long unbroken customer name. No clipped content.
- 340px narrow viewport: single-column cards, full-width 259 × 48px actions, full phone/payment details, no horizontal overflow. Width was exercised through browser zoom, not hardware device emulation.
- 2726px ultrawide viewport: table remains centred; no clipped cells or page overflow.
- Completed status filter returned its one fixture; View order opened the matching JU-24307 detail page.
- Narrow delivery-zone dropdown wrapped Mikocheni – Regent Estate, scrolled to it and filtered to its one fixture.
- Clearing filters restored all eight fixtures. An empty search filled the remaining page to the existing 48px bottom margin.
- Typecheck, full ESLint, all 233 existing unit tests, offline schema check and translation parity passed.
- Next.js production build passed and generated all 220 pages.

The existing database/auth/commerce mutation gates are outside this presentation change. Signed-in production operations were not exercised. Deployment target: release/storefront-staging only.
