# Jojo Usafi

Jojo Usafi is a scalable ecommerce retail store for Dar es Salaam. EcoPlus is the
first brand catalogue it sells — not the whole store.

**The storefront runs on Supabase.** English and Kiswahili, on the real Product Master and
the approved photography: 201 products imported, 95 on the public shelf, photographs served
from Supabase Storage, and 193 tests proving the database, Auth, Row Level Security and
Storage behave as claimed.

**A shopper can buy, and staff can run the shop.** Guest checkout reserves stock atomically
and writes the order in one transaction; the admin dashboard shows the real orders and works
them — confirm, prepare, send out, complete with the payment actually collected, cancel, mark
a delivery failed — and edits prices, stock and delivery areas, with every write refused if
the signed-in person's role does not allow it.

What does not exist yet: online payments, the Website/Reports/Staff/Settings screens, and the
Google Sheet connection. See [`PROTOTYPE_NOTES.md`](./PROTOTYPE_NOTES.md) for what is still
mocked in the UI and [`docs/PROGRESS.md`](./docs/PROGRESS.md) for exactly where things stand.

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

The back office is at `/admin`, behind a sign-in guard: **sign in at `/admin/sign-in`**. Jojo
Usafi's Owner account is set up; further staff are added by the Owner. Every operational
screen — Home, Orders, Products, Customers, Delivery zones — reads the real database and
writes it, and what a person can change depends on their role. To see the Manager and Order
staff views, run `npm run qa:staff create` for a development login.

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
| `npm run test` | 162 unit tests — pure functions, **no database needed** |
| `npm run schema:check` | Offline: the migrations are internally consistent and agree with the domain layer |
| `npm run qa:screenshots` | Full QA gate — screenshots and behaviour checks at 390/430/768/1024/1440 in both languages, plus the signed-in admin dashboard and its dialogs (a server must be running; set `BASE_URL` for anything other than port 3000) |

These need the hosted development project, and `.env.local`:

| Command | What it does |
| --- | --- |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the live schema |
| `npm run db:types:check` | Fail if the committed types and the live schema have drifted |
| `npm run test:db` | 193 tests against real PostgreSQL, Supabase Auth and Supabase Storage |
| `npm run qa:staff create` | A development Manager and Order staff login for dashboard QA. Prints one password and stores none. `status` and `remove` complete the set |
| `npm run dev:zones` | Four placeholder delivery areas, each marked as a development fixture |
| `npm run dev:orders` | Two development orders, placed through the real `jojo_place_order` |
| `npm run verify:cache` | Changes a price in the editor and reads the shop as a shopper — proves the storefront cache is invalidated (a server must be running) |

### Connecting to the development database

```bash
npx supabase login                                    # once, if not already
npx supabase link --project-ref dyjhacbbedytcstxxjzl  # Jojo Usafi Dev, free tier
cp .env.example .env.local                            # then fill in the three values
```

`.env.local` is git-ignored and must never be committed. The migration path against a hosted
project is always `npx supabase db push --dry-run`, read the plan, then `npx supabase db
push` — `db reset` is never used on a hosted project.

### If `npm run dev` shows a 500 with "Cannot find module './933.js'"

`next build` and `next dev` share the `.next` folder and their output does not mix. If you
ran a build and then went back to `npm run dev`, delete `.next` and start again:

```bash
rm -rf .next && npm run dev
```

## The catalogue

The shelf is generated, not hand-written. `scripts/build-catalogue.mjs` reads the Product
Master CSV and the approved photography from `imports/` — which is source-only and
git-ignored — and writes the committed product images, catalogue data and validation
report. SKU is the identity key, images are matched on the exact SKU with no fuzzy
matching, and a product with no approved photograph is never shown.

`scripts/import-catalogue.mjs` then loads that artifact into Supabase — idempotent, dry-runnable,
and incapable of deleting a product. `docs/CATALOGUE_IMPORT_REPORT.md` records every run.

Current state: **201 master rows → 95 publishable products**, 106 withheld for having no
approved photograph. Full detail, including the two items needing Ibrahim's input, is in
[`docs/CATALOGUE_REPORT.md`](./docs/CATALOGUE_REPORT.md) and
[`docs/CATALOGUE.md`](./docs/CATALOGUE.md).

## Project layout

```
src/app/(en)/             English routes
src/app/(sw)/sw/          Kiswahili routes
src/views/                one shared implementation per page
src/components/layout/    header, footer, menu, cart dock, language controls
src/components/home/      homepage sections
src/components/product/   product card, product photo, add-to-cart controls
src/components/cart/      cart drawer
src/lib/catalogue/        catalogue types, generated data and the query layer
src/lib/admin/            the dashboard: model, reads, the authorisation gate, the writes
src/lib/domain/           business rules as pure TypeScript, 162 unit tests, no I/O
src/lib/supabase/         the three clients, generated types, environment validation
src/lib/i18n/             locale config, dictionaries, client hook
src/lib/                  cart state, formatting, site settings, colour tones
supabase/migrations/      the schema — 19 migrations, all applied to the dev project
tests/db/                 193 tests against the real database, Auth and Storage
scripts/                  catalogue build, i18n check, schema check, type generation, QA gate
public/products/          approved product photography, one file per SKU
preview/screenshots/      QA screenshots
docs/                     constitution, architecture, data model, decisions, progress
imports/                  restored source inputs — source-only, not in Git
```

Everything the UI knows about products goes through `src/lib/catalogue/queries.ts` — which
now reads Supabase, three cached queries for the whole catalogue rather than one per product.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · sharp for the
catalogue image pipeline · Playwright for the QA gate.

Backend: Supabase PostgreSQL, Auth, Storage and Row Level Security on a free development
project — **and the storefront reads it**. Vercel hosting, the order backend and a validated
two-way Google Sheet ↔ Supabase sync are still ahead. Firebase is permanently unapproved.
