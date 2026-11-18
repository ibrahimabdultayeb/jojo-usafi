# Admin design update — 18 November 2026

Applied the supplied `jojo-usafi-admin.zip` design to the existing authenticated application: navy grouped navigation, responsive overview, orders queue, order detail, and action dialogs. Existing product, customer and management screens share the updated shell. Inventory, media and activity destinations read the existing catalogue and ledgers; their edit links use the existing product editor.

The login background uses the original inner Jojo Usafi lettering and swooshes, with the badge outline and white field masked out. No logo lettering was regenerated.

All data remains behind the existing session/RLS boundary. No sample orders, users, financial records or stock movements were inserted. No auth policies, passwords, or database operations were changed. The browser component harness is outside the repository and is not deployed.

## Corrections accompanying the design

- Summary counts query the entire order queue, rather than the most recent 20 orders.
- Collected-today totals use `paid_at` and the Tanzania day boundary, including orders placed earlier.
- Order totals display recorded discounts and totals.
- Order reads page through API limits instead of silently stopping at 200.
- Save dialogs show the lattice loader, block duplicate submissions, retain errors and restore focus. Overlays render at the document root so entrance animations cannot shift them.
- Cancellation saves the explanatory text when the reason is Other.
- Admin navigation has a route loading state.

## Validation

- TypeScript and ESLint passed.
- All 233 unit tests passed, including regression checks for Tanzania midnight/year rollover, recorded discounts, counts above 20, pagination above 500, payment-date filtering, and unavailable payment reads.
- Optimized Next.js build completed. A storefront prerender request encountered a transient executor proxy denial; the build completed and the hosted build is the deployment gate.
- Browser checks against actual UI components with isolated local fixtures: 1363px desktop, 340px narrow and 2726px ultrawide; no document horizontal overflow. Checked order search, status and zone filters, cancel-reason validation, required digital payment reference, saving loader/disabled controls, error recovery, Escape/focus restoration, viewport-sized dialogs, and logo watermark rendering.
- These component checks do not replace signed-in end-to-end testing of the deployed admin with a real staff session. Real order mutations were intentionally not performed during visual QA.
