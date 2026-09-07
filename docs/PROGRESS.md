# Jojo Usafi Progress

## Current Stage

Storefront visual prototype (frontend only). No backend, no cloud services connected.

## Completed

### Environment and foundation
- Claude Code installed
- Claude Max authenticated
- Git installed
- GitHub CLI installed
- Node/npm installed
- Vercel CLI installed
- Firebase CLI installed
- UI UX Pro Max installed
- GitHub repository created
- Claude project rules created
- Autonomous Claude rules verified in practice

### Storefront visual prototype — 2026-09-07
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 scaffolded
- Design system aligned to the EcoPlus reference (Inter + Space Grotesk, brand green scale,
  rounded-3xl cards, pill navigation, blurred sticky header)
- Catalogue layer: types, prototype data (8 brands, 5 categories, 45 products) and a single
  query module that Firestore will later replace
- Placeholder SVG product artwork per pack type (bottle / jerrycan / drum / tub)
- Homepage: announcement bar, header, hero, category rail, best sellers, five category
  grids, trust pillars, delivery-area banner, brands section, how-ordering-works, footer,
  WhatsApp support button
- Catalogue page with category filter, sort and search
- Product detail page with a working size chooser, pre-rendered for all 45 products
- Cart drawer, full cart page and a sticky mobile cart bar, persisted in `localStorage`
- Visual shells for checkout and track order (no backend, clearly labelled in the UI)
- Contact page and styled 404
- Playwright visual QA script covering 390 / 430 / 768 / 1024 / 1440 with horizontal-overflow
  and console-error checks; screenshots in `preview/screenshots/`
- `npm run build`, `npm run lint`, `npm run typecheck` all pass
- `README.md` and `PROTOTYPE_NOTES.md` written

## Deliberately not done in this phase

Firebase, Firestore, Firebase Auth, Firebase Storage, Google Sheets synchronisation, the
order backend, payments, customer accounts, the admin dashboard, the analytics pipeline and
any Vercel deployment. See `PROTOTYPE_NOTES.md` §7.

## Next

- Confirm the business rules listed in `PROTOTYPE_NOTES.md` §3 (delivery fee, free-delivery
  threshold, served areas, retail prices, cut-off time)
- Provide the real Jojo Usafi WhatsApp number, phone, email and logo
- Authenticate Firebase and create/link the Firebase project
- Model and create the Firestore collections from `docs/DATA_MODEL.md`
- Replace `src/lib/catalogue/mock-data.ts` behind `src/lib/catalogue/queries.ts` with
  Firestore reads
- Build the Google Sheets synchronisation layer and sync/audit logging
- Build the order backend so orders are written before any WhatsApp handoff
- Build the admin dashboard
- Authenticate Vercel and create/link the Vercel project

Claude must update this file after meaningful milestones.
