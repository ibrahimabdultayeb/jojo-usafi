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

**Nothing connects to Supabase yet and no cloud resources exist.** As of Build 05 the schema
is authored (`supabase/migrations/`, 30 tables) and the domain layer and client boundary are
written, but no migration has been executed against PostgreSQL and no Supabase project has
been created. See `docs/DATA_MODEL.md` and `docs/PROGRESS.md`.

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

Build 06 creates a **free** Supabase development project and becomes the first build that can
honestly claim the migrations apply and the policies hold. Local Docker may be revisited
later, but it is no longer on the critical path. See `docs/DECISIONS.md`, 2026-09-09.

## Backend layering (authored, not yet running)

```
supabase/migrations/          the schema — 30 tables, 2 views, 16 enums, RLS on everything
supabase/seed.sql             development seed, deliberately empty of business data
src/lib/domain/               the same rules as pure TypeScript, 156 unit tests, no I/O
src/lib/supabase/env.ts       environment validation — no defaults, no placeholder values
src/lib/supabase/client.ts    browser, as the visitor        — anon key, RLS applies
src/lib/supabase/server.ts    server, as the visitor         — anon key, RLS applies
src/lib/supabase/admin.ts     server, as nobody              — service role, RLS BYPASSED
src/lib/supabase/types.ts     hand-authored schema contract  — replaced by generation
scripts/schema-check.mjs      static check that the SQL and the domain layer agree
```

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
