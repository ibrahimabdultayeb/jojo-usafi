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
Usafi Dev*, `dyjhacbbedytcstxxjzl`, ap-south-1 — and all 19 migrations have been applied to
it: 30 tables, 2 views, 16 enum types, 95 Row Level Security policies, 3 Storage buckets and
the Supabase Auth foundation for Owner / Manager / Order staff. No billing is attached and
no paid feature is enabled.

What is real and what is not:

| | |
| --- | --- |
| Schema applied, constraints and triggers firing | **yes**, proved by `npm run test:db` |
| Row Level Security enforcing, per role | **yes**, 215 tests against real sessions |
| Supabase Auth, staff roles, first-Owner bootstrap | **yes**, mechanism built and tested |
| Storage buckets and their security | **yes** — and deliberately **empty** |
| The real Owner account | **yes** — Ibrahim Abdul Tayeb, claimed 2026-09-09 |
| Admin sign-in and session | **yes** — `/admin/sign-in`, `/admin/setup`, session middleware |
| The 95 product photographs in Storage | **yes** — `product-media/<SKU>/` |
| The catalogue in the database | **yes** — 201 products, 95 on the public shelf |
| The application reading Supabase | **yes** — storefront and admin product screens |
| Google Sheet synchronisation | **live** — both directions synchronised, one description held for review. See `docs/GOOGLE_SHEET_SYNC.md` |
| The stock reservation engine | **yes** — one transaction, concurrency proved |
| Server-authoritative quotation and order creation | **yes** |
| Cancellation with reservation release | **yes** — idempotent |
| A sign-in guard on the real-data admin routes | **yes** — all seven redirect |
| The customer-facing checkout, confirmation and Track Order screens | **yes** — real, bilingual, guest checkout |
| Order transitions, payment completion, delivery-failed | **yes** — server operations, and the admin screens that call them |
| Admin write screens (orders, product, stock, zones) | **yes** — real reads, real writes, role-enforced |
| The Website, Reports, Staff and Settings screens | **not built** — Website is the last screen on mock content, and says so |

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
supabase/migrations/               the schema — 19 migrations, all applied
supabase/seed.sql                  deliberately empty of business data
src/lib/domain/                    the rules as pure TypeScript, 190 unit tests, no I/O
src/lib/supabase/env.ts            environment validation — no defaults, no placeholders
src/lib/supabase/client.ts         browser, as the visitor    — anon key, RLS applies
src/lib/supabase/server.ts         server, as the visitor     — anon key, RLS applies
src/lib/supabase/admin.ts          server, as nobody          — service role, RLS BYPASSED
src/lib/supabase/database.types.ts GENERATED from the real database — never hand-edited
src/lib/supabase/types.ts          friendly aliases into the generated types
scripts/schema-check.mjs           offline: the SQL and the domain layer agree
scripts/gen-types.mjs              generate / drift-check the types against the database
tests/db/                          215 tests against the real database, Auth and Storage
scripts/import-catalogue.mjs       CSV artifact -> Supabase, idempotent, never deletes
src/lib/catalogue/queries.ts       the storefront read: product_shelf, cached 5 minutes
src/lib/catalogue/admin.ts         the admin read, under the CALLER's own RLS
```

## The admin dashboard (Build 08C)

Every operational screen reads the real database and every control writes it. The layering
is deliberately three files, each with one job:

```
src/lib/admin/model.ts        the vocabulary and the view-model — labels, stages, AdminOrder
src/lib/admin/orders.ts       the READS: orders, timeline, home snapshot, customers, zones
src/lib/admin/authorize.ts    the GATE: signed in? active staff? does the role allow it?
src/lib/admin/actions.ts      the WRITES: one server action per operation
src/lib/admin/permissions.ts  the capability matrix, read by both the screens and the gate
src/lib/admin/settings.ts     the READS for the shop's own settings, and what is still missing
src/lib/admin/staff.ts        the READS for the roster, including "is this the only Owner?"
src/lib/admin/owner-actions.ts the WRITES only an Owner may make: staff, settings, the website
```

**Reads go through the caller's own session.** `orders.ts` deliberately does not import the
service-role client: staff see everything because a policy says so, and a stranger sees an
empty screen rather than the shop's order book. A policy mistake shows up as missing data,
not as a leak.

**Writes are split by what they touch.**

| Operation | Client | Why |
| --- | --- | --- |
| Product price, offer, visibility, lifecycle | caller's session | the product policies already say Owner and Manager; RLS is the enforcement |
| Add stock, count stock | caller's session | `jojo_add_stock` / `jojo_count_stock` re-ask `jojo_manages_catalogue()` themselves |
| Delivery zones | caller's session | same |
| Advance, complete, cancel, delivery-failed | service role, behind `authorize()` | one transaction spans `orders`, `inventory`, `order_events` and `inventory_movements` |
| Amend an order | service role, behind `authorize()` | `jojo_amend_order` is one transaction over four tables, and locks every product either side mentions |
| Website words, shop details, reservation times | caller's session | `shop_settings` admits only an Owner by policy; the grant was added in 0021 |
| Invite a staff member | service role (Auth admin) | only the Auth admin API can send an invitation, and nothing here ever sees a password |
| Audit rows | service role | `audit_events` has no INSERT policy for anybody holding a browser token |

The service-role path is never reachable without passing `authorize()` first, and
`authorize()` reads the same capability matrix the screens read — so a button that is drawn
and an action that is allowed cannot drift apart. The UI hiding a control is never the
boundary; it decides what is worth rendering.

**No arithmetic happens twice.** Reservation maths, transition legality, the payment rules
and the delivery quote all live in SQL functions proved in Build 08. The actions translate a
refusal into a sentence and revalidate the screens that have gone stale. `orderTotals()` in
`model.ts` re-adds the lines for display and is the only sum in the dashboard.

## Settings reach the storefront (Build 10)

The Owner's Website screen writes `shop_settings`; the storefront reads it through one
cached function and treats every text field as an **override**.

```
src/lib/site-content.ts       one cached read + resolveContent(), the pure rule
src/lib/contact.ts            the same for the shop's own telephone, email, address
src/lib/ContactContext.tsx    those details handed to the four client components
   ↓
StorefrontLayout             the announcement strip, and whether it appears at all
HomeView                     the promotion band and which sections are drawn
Hero                         headline, supporting line, button words, button link
Footer / ContactView         the shop's real details, or the placeholders
```

Three properties, in order of how much trouble each avoids:

1. **Blank means the site's own wording.** Not "say nothing". Until somebody opens that
   screen every column is null, so the other rule would have emptied the homepage the moment
   the screen was wired up. Turning something off is always a switch.
2. **One query, cached for five minutes under the `catalogue` tag** — the same tag the shelf
   uses, so an Owner saving a change drops both and sees the result immediately, while an
   ordinary visitor costs nothing.
3. **The rule is a pure function.** `resolveContent()` takes a row and a locale and returns
   what to render, so both languages and every fallback are proved offline in
   `src/lib/site-content.test.ts` without a database.

## Jobs: written, protected, and scheduled by nothing (Build 10)

```
POST /api/sync/catalogue              run the catalogue sync
POST /api/jobs/expire-reservations    release stock held by unconfirmed orders
```

Both share `src/lib/jobs/authorise.ts`, which is **closed by default**: a missing or short
secret means every request is refused, so a deployment that forgets to configure one is shut
rather than open. The comparison is constant-time, and a wrong secret is answered exactly like
an unconfigured one — telling a caller which it is tells them how close they are.

**Nothing schedules either of them.** No cron entry, no Vercel schedule, no Supabase job, no
paid scheduler. They exist so that when a schedule is decided it calls something already
written, authorised, audited and proven idempotent. The expiry job additionally does nothing
today even if called, because `reservation_expiry_minutes` is null.

## The Google Sheet sync (Build 09)

Full detail in [`GOOGLE_SHEET_SYNC.md`](./GOOGLE_SHEET_SYNC.md). The shape:

```
src/lib/sheets/columns.ts   the field authority matrix — who owns each of the 39 columns
src/lib/sheets/rows.ts      spreadsheet cells → a validated catalogue record, or an issue
src/lib/sheets/plan.ts      the whole decision, as a PURE function
src/lib/sheets/google.ts    the only code that talks to Google. One read, one batched write
src/lib/sheets/run.ts       reads, applies, writes back, records the audit
src/lib/sheets/status.ts    what the Catalogue Sync screen shows
src/lib/sheets/actions.ts   Sync now, and settling a conflict
src/app/api/sync/catalogue  a protected endpoint for a future schedule. Nothing calls it yet
```

**The decision is a pure function.** `planSync` takes a sheet snapshot, the database's
products and what the two last agreed on, and returns a plan. It reads nothing, writes
nothing and cannot see a clock — which is why every rule in the brief is a unit test over a
literal, and why a dry run is genuinely free: it is the same function without the applier.

**Three-way, never last-write-wins.** The comparison is sheet value, database value, and the
**base** — what they last agreed. A field moves only if the side it comes *from* actually
changed it. Without the base, a value that was simply always different is indistinguishable
from a change, which is how naive syncs lose data. Both sides changing the same field is a
conflict, and a conflict freezes that product until a person decides.

**Stock is not in the conversation.** `STOCK QTY` is classified `database`, so the plan has no
way to express an inventory change at all. The shop's real figure is reported back into a
read-only column beside it instead.

**An unclassified column stops the run.** A column `columns.ts` does not name is not skipped
and not guessed at: reading rows through a map nobody has checked is how a spreadsheet
silently starts writing the wrong thing into the shop.

**Google is never in a customer's path.** No storefront or checkout module imports any of
these files, no Google call happens inside a customer request, and a sync that fails is a
sync that failed — the shop, the orders and the admin's own writes are untouched.

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
Storage.

**Populated in Build 07**: the 95 approved photographs live at
`product-media/<SKU>/<sku>-primary-1.webp`, each with its sha256 on the `media_assets` row
so a re-import uploads nothing that has not changed. 2.6 MB — comfortably inside the free
tier. The orphan image `EP23-A02` was **not** uploaded.

The three clients are separate files on purpose: reaching for the privileged one has to be a
deliberate act with a different import. `server.ts` and `admin.ts` both import `server-only`,
so pulling either into a client component is a build error rather than a leak.

`src/lib/domain/` imports nothing from Supabase, React or Next. That is what lets the
business rules be proved correct before the database exists.

## Catalogue pipeline

The CSV is now an IMPORT SOURCE, not a runtime read. The storefront reads Supabase; the
committed artifact is the deterministic middle step that turns the Product Master into rows,
and the one place SKU-to-photograph matching happens.

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

## Signing in, and getting a password (Build 11)

```
/admin/sign-in           email + password, through a server action
/admin/forgot-password   asks Supabase to email a link
/admin/auth/callback     ?code= and ?token_hash=  → server side
/admin/set-password      #access_token=…          → browser side, by necessity
```

The split is forced by how Supabase delivers a link. An admin-generated
invitation puts the session in the URL **fragment**, which is never transmitted
to a server, so only the browser can read it — and `@supabase/ssr`'s PKCE client
will not do it unprompted, because PKCE detection looks for `?code=` and ignores
hash tokens. The fragment is therefore parsed by hand.

All four are in the middleware's public allow-list, because reaching them is how
somebody with no password gets one.

**The middleware also checks staff, not just sign-in.** A Supabase account that
had never been added to the shop used to reach the dashboard frame; RLS kept
every row empty, but the application was still telling a stranger they were in
the back office. It now asks for an active `admin_profiles` row and sends anybody
else to the sign-in screen, which explains both cases.

## Deployment (Build 11)

Full detail in [`STAGING.md`](./STAGING.md). The shape:

```
GitHub  ibrahimabdultayeb/jojo-usafi
   ↓
Vercel  ecoplus/jojo-usafi
          Preview      →  Supabase  Jojo Usafi Dev (dyjhacbbedytcstxxjzl)
                          https://jojo-usafi-staging.vercel.app
          Production   →  no variables set, deliberately
```

Production is left empty so that a deployment reaching it fails its build with
the name of the missing variable, rather than quietly serving the development
database to the public as the real shop.

**Staging is the production build against the development database.** That is
what makes it worth having: the remaining class of defect this project cannot
find locally is the deployment-only one — a missing variable, a header that never
arrives, an auth redirect pointing at localhost, a secret inlined into a bundle.

`APP_ENV` decides whether a deployment is indexed, and anything that is not the
literal string `production` means staging. See `src/lib/environment.ts` for why
the default falls that way.

**Production will be a separate Supabase project**, not a promoted development
one. The reasoning and the ordered procedure are in `STAGING.md` §7.

## Expected domains

catalogue · brands · suppliers · categories · inventory · customers · orders ·
promotions · analytics · admin · site content · sync · audit logging

This document must be updated as implementation decisions are finalized.
