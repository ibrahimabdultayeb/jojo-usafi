# Jojo Usafi

Jojo Usafi is a scalable ecommerce retail store for Dar es Salaam. EcoPlus is the
first brand catalogue it sells — not the whole store.

**This repository currently contains a frontend-only prototype**: a storefront in English
and Kiswahili built on the real Product Master and the approved product photography, plus
a mobile-first admin at `/admin`. There is no backend, no Google Sheet connection, no
order backend and no payments. See [`PROTOTYPE_NOTES.md`](./PROTOTYPE_NOTES.md) for
exactly what is real and what is mocked.

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

### What to look at

| Page | English | Kiswahili |
| --- | --- | --- |
| Homepage | `/` | `/sw` |
| Shop / catalogue | `/shop` | `/sw/shop` |
| A category | `/shop?category=housekeeping` | `/sw/shop?category=housekeeping` |
| Product detail | `/product/multix-multipurpose-detergent-lemon-fresh-5lt` | `/sw/product/…` |
| Cart | `/cart` | `/sw/cart` |
| Checkout shell | `/checkout` | `/sw/checkout` |
| Track order shell | `/track-order` | `/sw/track-order` |
| Contact | `/contact` | `/sw/contact` |

On a first visit you are asked to choose a language; the choice is remembered. The EN/SW
switcher is in the header on desktop and in the menu on phones, and switching keeps the
page you are on, your filters and your cart.

The cart drawer opens from the **CART / KIKAPU** button in the header, and a sticky cart
bar appears at the bottom on phones once you add something.

### Seeing the phone experience

Jojo Usafi is mobile first. In Chrome: `F12` → the device-toolbar icon (`Ctrl+Shift+M`)
→ pick **iPhone 14 Pro (390px)** or set the width to **430px**.

Saved screenshots at every QA width, in both languages, are in
[`preview/screenshots/`](./preview/screenshots).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run catalogue:build` | Rebuild the catalogue and photography from `imports/` |
| `npm run catalogue:check` | Verify the committed catalogue still matches `imports/` |
| `npm run i18n:check` | Verify English and Kiswahili carry the same copy keys |
| `npm run qa:screenshots` | Full QA gate — screenshots and behaviour checks at 390/430/768/1024/1440 in both languages (a server must be running; set `BASE_URL` for anything other than port 3000) |

### If `npm run dev` shows a 500 with "Cannot find module './933.js'"

`next build` and `next dev` share the `.next` folder and their output does not mix. If you
ran a build and then went back to `npm run dev`, delete `.next` and start again:

```bash
rm -rf .next && npm run dev
```

## The admin

A mobile-first admin prototype lives at **http://localhost:3000/admin**. It is
frontend only: products, prices, item codes and photos are real, while orders,
customers, delivery zones and website content are samples, and nothing is saved.

Home · Orders · Products · Customers · More (Delivery Zones, Website, Reports,
Staff, Settings). Orders show one obvious next action rather than a status
dropdown, an order cannot be completed without a recorded payment, and the item
code is locked. Full detail in [`docs/ADMIN_UX.md`](./docs/ADMIN_UX.md), which
also lists the backend constraints this UX implies.

## The catalogue

The shelf is generated, not hand-written. `scripts/build-catalogue.mjs` reads the Product
Master CSV and the approved photography from `imports/` — which is source-only and
git-ignored — and writes the committed product images, catalogue data and validation
report. SKU is the identity key, images are matched on the exact SKU with no fuzzy
matching, and a product with no approved photograph is never shown.

Current state: **201 master rows → 95 publishable products**, 106 withheld for having no
approved photograph. Full detail, including the two items needing Ibrahim's input, is in
[`docs/CATALOGUE_REPORT.md`](./docs/CATALOGUE_REPORT.md) and
[`docs/CATALOGUE.md`](./docs/CATALOGUE.md).

## Project layout

```
src/app/(en)/             English storefront routes
src/app/(sw)/sw/          Kiswahili storefront routes
src/app/(admin)/admin/    admin routes
src/views/                one shared implementation per storefront page
src/components/layout/    header, footer, menu, cart dock, language controls
src/components/home/      homepage sections
src/components/product/   product card, product photo, add-to-cart controls
src/components/cart/      cart drawer
src/components/admin/     admin shell, order and product screens, dialogs
src/lib/catalogue/        catalogue types, generated data and the query layer
src/lib/admin/            admin types, workflow, permissions and mock data
src/lib/i18n/             locale config, dictionaries, client hook
src/lib/                  cart state, formatting, site settings, colour tones
scripts/                  catalogue build, i18n check, QA gate
public/products/          approved product photography, one file per SKU
preview/screenshots/      QA screenshots
docs/                     constitution, architecture, catalogue, i18n, decisions, progress
imports/                  restored source inputs — source-only, not in Git
```

Everything the UI knows about products goes through `src/lib/catalogue/queries.ts`.
That is the single seam where Supabase replaces the generated data later.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · sharp for the
catalogue image pipeline · Playwright for the QA gate.

Approved backend direction (**not started**): Supabase PostgreSQL, Auth, Storage and Row
Level Security, on Vercel, with a validated two-way Google Sheet ↔ Supabase sync.
Firebase is permanently unapproved.
