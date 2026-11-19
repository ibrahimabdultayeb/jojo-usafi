# Smooth controls and visual inventory — 19 November 2026

## Implementation

- Adapted React Bits Glide Select, Rubber Segment and Animated List to the existing Next.js application. Source attribution is in THIRD_PARTY_NOTICES.md; Motion is pinned in the lockfile.
- Shared dropdowns preserve controlled values, form names and required validation. They support keyboard navigation, typeahead, disabled options, viewport clamping, long scrollable menus, outside dismissal and animated entry/exit. Portals inherit the active light or admin palette.
- Top filters on Products, Orders, Inventory, Media and Shop use the elastic selection indicator. Narrow screens scroll the filter strip without creating page overflow. Server-driven shop filters retain their query parameters and show a lattice loader during navigation.
- Lists reveal with a short, capped stagger while preserving native links, table rows and document scrolling. This includes order amendments, customer history, reports, checkout, tracking and mobile navigation. Server-rendered content stays visible without JavaScript. Motion respects the system reduced-motion preference and the existing storefront motion toggle.
- Inventory uses approved product photos, size/SKU/brand identity, stock status, separate on-hand/reserved/available figures, and the existing product editor links. Missing photos are explicitly marked rather than substituted. Search, brand and stock filters and stock sorting use existing catalogue data.
- Stable root scrollbar space prevents horizontal jumps between short and long pages. The centred, card-free route loader remains unchanged.
- Admin navigation, server form submissions, toggles, photo actions, sync checks and conflict resolution show lattice loading feedback. Request failures in affected editors now restore a usable error state. Admin sheets retain their content for exit animation.

## Browser checks

The local component harness uses the actual application components with synthetic products/orders and stubbed mutation responses. It is outside the repository and is not deployed.

- At 1363 CSS pixels, product heading/search left coordinates were exactly 345.6875px with both 56 rows (5029px document height) and one row (936px document height). The scrollbar gutter stayed stable.
- Inventory had no horizontal page overflow at desktop, 2726px ultrawide and 340px narrow viewports. The grid changed from multiple columns to one column. Product images remained inside their 112 × 130px wells after fixing intrinsic grid image sizing.
- Inventory stock filters and keyboard arrow selection returned the expected eight low-stock and eight out-of-stock fixture rows. Sorting by reservations put Ozone first: 36 on hand, 3 reserved, 33 available. Brand typeahead selected Multix and returned 16 matching fixtures.
- A required dropdown blocked an empty form, focused its trigger and opened the options. End/Enter selected option 32 in a long menu, scrolling it into view. FormData retained the selected value. A short storefront sort menu and long narrow-screen brand menu fit their viewports.
- Pending form and action buttons displayed the lattice loader, aria-busy and disabled state. A simulated failed request displayed a retry message and re-enabled its button. The real OrderActions component also displayed loaders while its stubbed request was pending.
- Dropdown selection inside a Sheet worked. Escape closed the dropdown first; a further Escape closed the sheet after its exit transition.
- Light storefront controls and dark admin controls were visually inspected. Animated list entries were observed during their fade/slide and fully visible afterward.

## Automated checks and limits

- 233 existing unit tests passed (16 files).
- Typecheck, ESLint, offline schema validation and English/Swahili key parity passed.
- Next.js production build completed and generated 220 pages. Local Supabase cache revalidation logged fetch failures in this restricted environment; no database mutation was attempted.
- Catalogue import comparison could not run because the untracked original imports/white-bg-products folder is absent from this checkout. Committed catalogue data and photo assets are unchanged.
- The older database/commerce/password/cache gates were not run for this presentation change: they reset QA credentials or mutate fixtures. No live orders, stock, staff roles, credentials or settings were changed. Signed-in staging admin mutation flows still need validation with an existing staff session.
- Only release/storefront-staging is the deployment target; production remains unchanged.
- Live storefront checks confirmed category navigation from 95 products to Vehicle Care's one product, pending lattice feedback, and price sorting while retaining the category query.
- The anonymous HTTP deployment gate reaches Vercel's protection sign-in instead of the app, so its header and indexing results are invalid for this deployment. It was stopped rather than reported as an app failure. Browser checks use the existing permitted deployment session.
