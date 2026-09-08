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

**No backend work has started.** Nothing in this repository connects to Supabase, and no
cloud resources exist. See `docs/PROGRESS.md` for what is actually built.

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
src/lib/i18n/                 locale config, dictionaries, client hook
src/lib/cart.tsx              cart state (localStorage, keyed by SKU)
scripts/                      catalogue build, i18n parity check, QA gate
```

## Expected domains

catalogue · brands · suppliers · categories · inventory · customers · orders ·
promotions · analytics · admin · site content · sync · audit logging

This document must be updated as implementation decisions are finalized.
