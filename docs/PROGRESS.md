# Jojo Usafi Progress

## Current stage

Storefront prototype on the **real catalogue**, in **English and Kiswahili**, with real
product photography. Frontend only — no backend, no cloud services connected.

## Completed

### Environment and foundation
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Design system aligned to the EcoPlus reference (Inter + Space Grotesk, brand green scale,
  rounded-3xl cards, pill navigation, blurred sticky header)
- Git, GitHub, Vercel CLI, Playwright, UI UX Pro Max, Claude project rules

### Storefront visual prototype — 2026-09-07
The original approved prototype: homepage, catalogue, product detail, cart drawer and cart
page, checkout and track-order shells, contact, 404, and the Playwright QA script.

### Recovery Build A — 2026-09-08
Rebuilt on a replacement laptop. Builds 01–04 were committed only on the previous machine
and were not recoverable from Git, so Builds 01–03 were rebuilt against the real catalogue.

**Catalogue foundation**
- `scripts/build-catalogue.mjs` builds the shelf from the restored Product Master CSV and
  the approved white-background photography — deterministically, with no timestamps
- 201 master rows processed, 96 approved images, **95 exact SKU matches**
- 95 publishable products; 106 withheld for having no approved photograph
- `EP01-A01` (TZS 128) flagged `PRICE_IMPLAUSIBLE` and withheld — **not corrected**
- `EP23-A02` Spirix reported as an approved image with no master row — **not invented**
- All 201 rows preserved in the generated catalogue; only publishable rows reach the UI
- `docs/CATALOGUE_REPORT.md` regenerated on every build; `catalogue:check` guards drift
- The prototype's synthetic `EP-0001` SKUs are gone; SKU is now the real identity key

**Build 01 — interaction and QA**
- The hero down control is a real `<button>`: tab-reachable, Enter/Space operable,
  reduced-motion aware, and it moves focus to the shelf it scrolls to
- WhatsApp support button rebuilt on the real brand glyph, with a documented floating-layer
  contract so it and the mobile cart dock can never overlap
- Z-index contract written into `globals.css` — every fixed surface sits on a named layer
- QA gate extended to overflow, console errors, broken images, wrong SKU↔photo pairing,
  44px touch targets and floating-layer collisions

**Build 02 — English and Kiswahili**
- English at `/`, Kiswahili at `/sw/`, each with its own root layout and correct `<html lang>`
- 211 translated keys, first-visit chooser, remembered preference, EN/SW switcher
- Switching keeps the page, the query string and the cart
- Locale-aware canonical and hreflang (`en`, `sw-TZ`, `x-default`) on every page
- `npm run i18n:check` enforces key, placeholder and array parity

**Build 03 — real photography**
- Approved photographs throughout: homepage, best sellers, category rails, Shop All,
  product detail, size chooser, cart drawer, cart page and related products
- Square `object-contain` presentation with fixed dimensions — no distortion, no cropping,
  no layout shift
- The fake bottle/jerrycan SVG illustrations are deleted

**Verified**
`typecheck` · `lint` · `i18n:check` · `catalogue:check` · `build` (205 pages) ·
`qa:screenshots` — 70 screenshots at 390 / 430 / 768 / 1024 / 1440 in both languages, all
behavioural checks passing.

## Deliberately not done

Supabase (not started — no resources, no connection), the order backend, payments,
customer accounts, the admin dashboard, the analytics pipeline, Google Sheet
synchronisation and any Vercel deployment.

**Build 04 (admin prototype) was explicitly deferred to Recovery Build B.**

## Next

- **Recovery Build B** — the mobile-first admin prototype: Home attention dashboard,
  Orders list/detail with one obvious NEXT ACTION, simplified Products editor, Customers,
  Delivery Zones, Website/Content; mock data only, locked SKU, no delete controls, payment
  completion gate, no default on the returned-items question, and Owner / Manager / Order
  Staff permission-aware structure
- Confirm the open business rules in `PROTOTYPE_NOTES.md` §3 (delivery fee, free-delivery
  threshold, served areas, retail prices, cut-off time)
- Confirm the `EP01-A01` price and add a master row for `EP23-A02`
- Provide the real Jojo Usafi WhatsApp number, phone, email and logo
- Then: Supabase schema, RLS, migrations, the order backend, and the validated two-way
  Google Sheet ↔ Supabase synchronisation

Claude must update this file after meaningful milestones.
