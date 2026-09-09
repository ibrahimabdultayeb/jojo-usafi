# Architecture

## Application

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4, deployed on Vercel.

## Backend direction — approved 2026-09-08

Firebase is **permanently unapproved** for Jojo Usafi. The approved direction is:

- **Supabase PostgreSQL** — operational database
- **Supabase Auth** — customer and admin authentication
- **Supabase Storage** — product and content media
- **Supabase Row Level Security** — the authorization boundary
- **Supabase migrations / local development** — schema as code
- **Next.js on Vercel** — storefront and admin
- **Google Sheet** — the human-friendly catalogue control surface
- **Validated two-way Google Sheet ↔ Supabase synchronization**

**As of Build 06 the database is real.** A free Supabase development project exists — *Jojo
Usafi Dev*, `dyjhacbbedytcstxxjzl`, ap-south-1 — and all 15 migrations have been applied to
it: 30 tables, 2 views, 16 enum types, 95 Row Level Security policies, 3 Storage buckets and
the Supabase Auth foundation for Owner / Manager / Order staff. No billing is attached and
no paid feature is enabled.

What is real and what is not:

| | |
| --- | --- |
| Schema applied, constraints and triggers firing | **yes**, proved by `npm run test:db` |
| Row Level Security enforcing, per role | **yes**, 112 tests against real sessions |
| Supabase Auth, staff roles, first-Owner bootstrap | **yes**, mechanism built and tested |
| Storage buckets and their security | **yes** — and deliberately **empty** |
| The real Owner account | **yes** — Ibrahim Abdul Tayeb, claimed 2026-09-09 |
| Admin sign-in and session | **yes** — `/admin/sign-in`, `/admin/setup`, session middleware |
| A sign-in guard on the ten dashboard screens | **not yet** — they show mock data; the guard lands with the data |
| The 95 product photographs in Storage | **not uploaded** — still `public/products/` |
| The catalogue in the database | **not imported** — still a committed build artifact |
| The application reading Supabase | **not wired** — the storefront still reads the file |
| Google Sheet synchronisation | **not connected** |

See `docs/DATA_MODEL.md`, `docs/TESTING_REQUIREMENTS.md` and `docs/PROGRESS.md`.

```
Google Sheet
     ↕
synchronization layer  (validated, loop-safe, audited)
     ↕
Supabase PostgreSQL
     ↕
Storefront + Admin Dashboard
```

Public storefront traffic must never depend directly on Google Sheets availability.

### Local development without Docker — 2026-09-09

Docker Desktop cannot start on this laptop: WSL returns `Wsl/CallMsi/E_ACCESSDENIED`. The
local Supabase stack (`supabase start`, `supabase db reset`) is therefore unavailable, and
development deliberately does not depend on it. Supabase is unchanged as the backend; only
the convenience of running PostgreSQL on this machine is missing.

Build 06 replaced the local stack with the hosted free development project, which turned out
to be the better arrangement anyway: the migrations, the policies and Supabase Auth are now
proved against the same software production will run rather than against a local
approximation of it. `supabase db reset` is never run against a hosted project — the path is
`db push --dry-run`, read the plan, then `db push`. See `docs/DECISIONS.md`, 2026-09-09.

## Backend layering

```
supabase/migrations/               the schema — 15 migrations, all applied
supabase/seed.sql                  deliberately empty of business data
src/lib/domain/                    the rules as pure TypeScript, 156 unit tests, no I/O
src/lib/supabase/env.ts            environment validation — no defaults, no placeholders
src/lib/supabase/client.ts         browser, as the visitor    — anon key, RLS applies
src/lib/supabase/server.ts         server, as the visitor     — anon key, RLS applies
src/lib/supabase/admin.ts          server, as nobody          — service role, RLS BYPASSED
src/lib/supabase/database.types.ts GENERATED from the real database — never hand-edited
src/lib/supabase/types.ts          friendly aliases into the generated types
scripts/schema-check.mjs           offline: the SQL and the domain layer agree
scripts/gen-types.mjs              generate / drift-check the types against the database
tests/db/                          112 tests against the real database, Auth and Storage
```

## Authorization: two locks, with different jobs

```
GRANT   decides which VERBS and which COLUMNS a role may ever touch
POLICY  decides which ROWS it then sees or changes
```

Neither is sufficient alone, and that is the point — a mistake in a policy is contained by
the grant, and a grant that is too generous is contained by the policy.

| Caller | Holds | Sees |
| --- | --- | --- |
| `anon` | SELECT on 15 catalogue tables, three columns of `inventory`, INSERT on `analytics_events` | active, visible, photographed products; active brands, categories and delivery zones |
| `authenticated`, not staff | SELECT / INSERT / UPDATE, never DELETE | the same shelf; their own customer row and orders, once accounts exist |
| Order staff | + orders, order lines and history, customers, the stock ledger | may advance an order — and only its operational columns |
| Manager | + pricing, stock, visibility, zones, website content, suppliers, audit, sync, analytics | everything except staff management |
| Owner | + `admin_profiles` | everything |
| `service_role` | everything, RLS bypassed | read only by `src/lib/supabase/admin.ts`, which is `server-only` |

Nobody holds DELETE through the API — not even the Owner. A product is archived, a staff
member deactivated, a stock mistake corrected by a compensating movement. Four ledgers
(`order_events`, `inventory_movements`, `audit_events`, `analytics_events`) additionally
refuse UPDATE and DELETE by trigger, which the service role cannot bypass either.

**The browser reads; the server writes.** There is no INSERT policy on `orders`,
`order_items` or `customers` for anybody holding a browser token. Checkout is a server action
that prices the cart from the database, reserves the stock and writes the order with its
first event in one transaction. The single exception is `analytics_events`, where a browser
may insert the browsing-side event kinds with no customer and no order attached.

## Storage

Three public-read buckets, screened by size and MIME type at the door:

```
product-media   5 MB   webp/png/jpeg/avif    <SKU>/<sku>-<role>-<n>.webp
brand-media     2 MB   webp/png/svg          <brand-slug>/logo.webp
site-content    5 MB   webp/png/jpeg/avif    <slot>/<name>.webp
```

Owner and Manager upload and replace; only an Owner deletes, because
`product_media.media_id` is `on delete restrict` and the bytes under a live product page
should be at least as hard to remove as the row pointing at them. Nothing private lives in
Storage. **Empty as of Build 06** — the 95 approved photographs are still committed build
artifacts under `public/products/`.

The three clients are separate files on purpose: reaching for the privileged one has to be a
deliberate act with a different import. `server.ts` and `admin.ts` both import `server-only`,
so pulling either into a client component is a build error rather than a leak.

`src/lib/domain/` imports nothing from Supabase, React or Next. That is what lets the
business rules be proved correct before the database exists.

## Catalogue pipeline (built)

Until Supabase exists, the catalogue is a committed build artifact rather than a live read.
The seam is the same one Supabase will occupy.

```
imports/jojo-usafi-product-master.csv   201 rows   (source-only, git-ignored)
imports/white-bg-products/               96 PNGs   (source-only, git-ignored)
                    │
                    ▼
       scripts/build-catalogue.mjs        exact SKU matching + validation
                    │
      ┌─────────────┼──────────────────────────┐
      ▼             ▼                          ▼
public/products/  src/lib/catalogue/       docs/CATALOGUE_REPORT.md
  <SKU>.webp        generated/*.json         validation report
                    │
                    ▼
       src/lib/catalogue/queries.ts        the ONLY module the UI reads through
                    │
                    ▼
              Storefront
```

Rules the pipeline enforces — see `docs/CATALOGUE.md`:

- SKU is the only identity key. Images match on the exact leading SKU token.
- No fuzzy name matching, ever. No product is given another SKU's photograph.
- Nothing is invented: no prices, stock, descriptions, categories or product identity.
- All 201 master rows are preserved in `generated/catalogue.json`; only rows marked
  `publishable` are exposed by `queries.ts`.

`queries.ts` is synchronous today because it reads a committed file. When Supabase lands,
these functions become async reads and components change from `const x = getX()` to
`const x = await getX()` — nothing else moves.

## Internationalisation (built)

English at `/`, Kiswahili at `/sw/`. See `docs/I18N.md`.

Each language has its own root layout (`src/app/(en)` and `src/app/(sw)`) so `<html lang>`
is correct in the static HTML rather than patched after hydration. Both layouts render the
same `StorefrontLayout`, and every route file is a thin wrapper around a shared view in
`src/views/`, so there is one copy of each page.

## Layering

```
src/app/(en) · src/app/(sw)   route wrappers, metadata, canonical + hreflang
src/views/                    one shared implementation per page
src/components/               presentational + interactive components
src/lib/catalogue/            types, generated data, the query seam
src/lib/domain/               business rules — money, SKU, phone, stock, orders, sync
src/lib/supabase/             environment, the three clients, the schema contract
src/lib/i18n/                 locale config, dictionaries, client hook
src/lib/cart.tsx              cart state (localStorage, keyed by SKU)
supabase/                     config, migrations, seed
scripts/                      catalogue build, i18n parity check, schema check, QA gate
```

## Expected domains

catalogue · brands · suppliers · categories · inventory · customers · orders ·
promotions · analytics · admin · site content · sync · audit logging

This document must be updated as implementation decisions are finalized.
