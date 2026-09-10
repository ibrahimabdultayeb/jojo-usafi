# Jojo Usafi Progress

## Current stage

Storefront prototype on the **real catalogue**, in **English and Kiswahili**, with real
product photography — and, since Build 06, a **real Supabase database behind it**.

All 19 migrations are applied to a free hosted development project. The constraints fire,
the triggers refuse, Row Level Security holds for each of the three staff roles, Supabase
Auth works and the Storage buckets are secured — all proved by 193 tests against the actual
database rather than asserted in a document.

Jojo Usafi has a real Owner — **Ibrahim Abdul Tayeb** — who signs in at `/admin/sign-in`.
The first-Owner bootstrap is done and has disabled itself.

**The storefront reads Supabase.** 201 products imported from the Product Master, 95 on the
public shelf, 95 photographs served from Supabase Storage, opening stock explained by a
receipt movement per product. The admin's product screens read the real catalogue too, under
the caller's own Row Level Security.

The **commerce engine** is built and proved: stock reservation under a lock, server-authoritative
quotation, atomic order creation, JU numbering, cancellation with release. Real-data admin
routes are behind the sign-in guard.

**A shopper can buy.** Checkout, the confirmation screen and Track Order are real and
bilingual; guest orders reserve stock atomically and appear with a JU number.

**And the shop can be run.** Since Build 08C a staff member signs in on a phone and works the
real orders — confirm, prepare, send out, complete with the payment that was actually
collected, cancel, or mark a delivery failed — and changes prices, adds and counts stock, and
edits delivery areas. Every write is refused if the person's role does not allow it, by the
database rather than by the screen. The invented orders, customers, zones and sales figures
are deleted, not kept as a fallback.

**The Google Sheet sync is live.** As of 2026-09-10 the sheet and the shop agree on every
catalogue field they share, in both directions, with one deliberate exception — a single
product description held for content review. Stock has never been synchronised and never will
be. See `docs/GOOGLE_SHEET_SYNC.md`.

What is still not true: the **Website** screen saves nothing and says so; Reports, Staff and
Settings are empty; and no product has yet been synced to or from a real Google Sheet.

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
customer accounts, the analytics pipeline, Google Sheet synchronisation and any Vercel
deployment.

The admin dashboard exists as a **mock-data prototype only**. Nothing in it writes anywhere.

## Recovery Build B — admin prototype recovered — 2026-09-08

The Build 04 admin prototype was recovered from the previous laptop
(`archive/old-laptop-pre-supabase`, tag `old-laptop-pre-supabase`, commit `b96c758`) and
ported onto this Supabase baseline. Only the admin frontend and its UX documentation were
brought across; the old Firebase-era planning and backend documentation was deliberately
left behind.

**What came across**
- Ten screens at `/admin` in their own root layout: Home, Orders, Order detail, Products,
  Product editor, Customers, Customer detail, More, Delivery zones, Website — plus Reports,
  Staff and Settings placeholders that explain what will be there
- Five-item bottom navigation on phones, identical sidebar from `lg` up
- One obvious next action per order stage; internal stage names never shown
- Cancellation requires a reason; delivery failure asks "Were the items returned?" with **no
  default** and states each choice's stock consequence; completion is gated on recording the
  payment, and a digital payment requires a transaction reference
- Products run on the real 95-product shelf. SKU locked, no delete control anywhere, stock
  changed by adding or counting rather than by typing over a number
- New delivery zones default to TSh 4,000; Free delivery visibly disables the fee
- Website edits named slots only, bilingual EN/SW, no page builder
- Owner / Manager / Order staff capability matrix that the screens already consult

**Adapted for this baseline**
- Backend references reworded from Firebase to Supabase (Row Level Security as the real
  authorization boundary; a server action writing Supabase as the real save)
- Layering moved onto this repository's floating-layer contract — admin top bar z-40,
  bottom navigation z-50, sheets and toasts z-60 — instead of the old CSS variables
- The mock product wrapper matches this catalogue's `Product` type, and the Home screen's
  "Missing image" count is now the **real** number of withheld master rows rather than a
  hard-coded one
- `qa:screenshots` gained an admin pass over all ten screens

## UI refinement patch — 2026-09-08

The last local UI work before the backend build. Three specific refinements on top of the
approved storefront and admin; nothing was redesigned.

**Desktop shelf density**
- The product shelf now runs 2 / 3 / 4 / **5** columns at `< 768` / `>= 768` / `>= 1024` /
  `>= 1280`, matching the reference's five-across desktop row
- The fifth column starts at 1280px rather than 1024px: at 1280 a five-across card is
  ~227px, the same card the four-across laptop layout already ships, where at 1024 it
  would fall to ~176px and squeeze the name, pack size and price row
- Homepage shelves are handed enough products to fill the widest row — 10 best sellers,
  5 per category rail, 5 related products — and trim their own tail at narrower column
  counts, so a shelf always ends on a complete row instead of one orphan card
- Shop All deliberately does not trim: a part-full last row there is where the catalogue
  ends
- Card proportions, gaps, image area, price prominence and the add button are unchanged

**English / Kiswahili layout stability**
- Persistent controls reserve the width of their **longest** translation instead of
  fitting the one on screen, so the interface skeleton stays locked while the text changes
- `StableText` renders every locale's version of a label into one grid cell and hides all
  but the current one with `visibility: hidden` — the browser measures the real strings in
  the real font, so there are no magic widths to go stale and a third language would be
  reserved for automatically
- Reserved: the four desktop nav slots, the cart label, the shop "All" chip, the sort menu
  and the two hero actions. The header logo, search field, language control and cart button
  are now pixel-identical in both languages
- No font was shrunk and no copy was truncated

**WhatsApp**
- One canonical mark, `src/components/ui/WhatsAppIcon.tsx`, used by the storefront support
  button, mobile menu, footer, contact and track-order pages, and the admin's "WhatsApp
  customer" actions
- The admin's malformed icon was `Icon.tsx`'s `whatsapp` entry — a filled brand mark traced
  with that set's 2px unfilled stroke, which drew the glyph's silhouette as a scribble.
  That entry is deleted, not repaired, so the wrong thing is unreachable rather than merely
  discouraged
- Admin action buttons carry the mark at 20px; icon-only controls keep their 44px target

**QA gate extended**
- The rendered column count is asserted at every QA width, and a fixed-length shelf that
  ends in a part-full row fails
- New **locale layout-stability pass**: home, Shop All and product are loaded in both
  languages at 390 / 430 / 768 / 1024 / 1440 and the boxes of every `data-qa-anchor`
  control are compared. Horizontal position and width must match within 2px everywhere;
  vertical position must match inside the header too. Translated text is free to be a
  different width — the slot around it is not

**Verified**
`typecheck` · `lint` · `i18n:check` · `catalogue:check` · `build` (325 pages) ·
`qa:screenshots` — 80 screenshots, all 15 locale-stability comparisons stable, no
overflow, console errors, broken images, small touch targets or floating-layer collisions.

### Build 05 — Supabase domain contracts, without a database runtime — 2026-09-09

**Environment**
- Docker Desktop is unusable on this laptop: WSL returns `Wsl/CallMsi/E_ACCESSDENIED`. No
  time was spent repairing it. The local Supabase stack is unavailable and is no longer on
  the critical path.
- Supabase remains the approved backend, unchanged. **No hosted project was created, no
  account linked, no billing attached, no paid feature enabled. Cost: TZS 0 / USD 0.**

**Supabase project structure**
- `supabase` CLI 2.117.0 installed as a dev dependency; `npx supabase init` run
- `supabase/config.toml`, `supabase/migrations/`, `supabase/seed.sql`
- `supabase start` was **not** run; `supabase db reset` was **not** run

**Schema — authored, never applied**
- 8 migrations: 30 tables, 2 views, 16 enum types, 4 functions, 176 statements
- Catalogue: suppliers, brands, categories, media, families, **option axes** — size and
  scent are rows, not columns — sellable SKUs, product media, localized content, locales
- Inventory: running totals with `available` as a stored generated column, plus an
  append-only ledger covering all eight movement kinds
- Customers, addresses and delivery zones; guest checkout stays the default
- Orders, order items and an append-only order-event history, with everything
  customer-visible snapshotted onto the order
- Admin profiles and roles; `audit_events`; sync jobs, events, state and conflicts;
  `analytics_events`
- Row Level Security **enabled on all 30 tables with no policies** — deny by default until
  Build 06 writes and tests them
- `supabase/seed.sql` deliberately inserts no business data: no invented zones, prices,
  customers or orders

**Domain layer and client boundary**
- `src/lib/domain/` — money, SKU, Tanzanian phone, delivery zones, inventory, orders and
  payment, customers, localized content, Sheet sync. Pure TypeScript, no I/O, Zod validation
- `src/lib/supabase/` — environment validation with no defaults, a browser client, a server
  client, and a `server-only` service-role client whose file states in full what it bypasses
- `src/lib/supabase/types.ts` — hand-authored schema contract, labelled unverified, to be
  replaced by generated types in Build 06
- `.env.example` — variable names only, never a value
- `scripts/schema-check.mjs` — static check that the SQL is internally consistent and agrees
  with the TypeScript; it catches a drifting enum, pattern or default fee

**Verified offline**
`typecheck` · `lint` · `test` (**156 domain tests**) · `schema:check` · `i18n:check` ·
`catalogue:check` · `build` (325 pages) · `qa:screenshots` (80 screenshots, all 15
locale-stability comparisons stable). The approved storefront and admin UI are untouched.

**Not verified — needs a real database**
Migrations applying, constraints firing, triggers running, the generated column computing,
RLS enforcing, Supabase Auth, concurrent stock reservation, and the generated database
types. Listed in full in `docs/TESTING_REQUIREMENTS.md`.


### Build 06 — the database is real — 2026-09-09

The first build that may say the migrations apply, the constraints fire and the policies
hold, because a real PostgreSQL did it. **BUILD 06 COMPLETE.**

**Cost: TZS 0 / USD 0.** Free tier throughout. No billing attached, no paid feature or
add-on enabled, no limit approached.

#### The project

*Jojo Usafi Dev* — `dyjhacbbedytcstxxjzl`, ap-south-1 (Mumbai), free tier. The Supabase CLI
was already authenticated, so no browser authorisation was needed. **No database password
was ever required**: the CLI provisions a temporary login role through the Management API,
so `db push`, `db query` and `gen types` all worked without one.

The account also holds an unrelated project, `mushus-stock`. It was verified untouched
(`linked: false`) before and after every operation. `scripts/gen-types.mjs` and
`tests/db/support.ts` both **pin** the development ref and refuse to run against anything
else, rather than trusting whatever happens to be linked.

Every push was `--dry-run` first, the plan read, then applied. `db reset` was never used.

#### Build 05's schema, applied

All 8 Build 05 migrations applied to the empty database, then verified by querying
PostgreSQL's own catalogue:

- 30 tables, RLS enabled on all 30, 0 policies (the correct end state of Build 05)
- 2 views, both `security_invoker = on`
- 16 enum types, 31 triggers, 92 CHECK constraints
- `inventory.available` really is `GENERATED ALWAYS AS (on_hand - reserved) STORED`
- all four append-only ledgers really carry `jojo_forbid_mutation`
- no money column is anything but `integer`
- reference data seeded by the migrations: 2 locales, 6 pack types, 2 option axes
- zero business rows, zero auth users

#### Seven new migrations

| | |
| --- | --- |
| `130000_auth_foundation` | real `auth.users` foreign keys; the role helper functions; the last-Owner guard; `search_path` pinned on the Build 05 functions |
| `130100_rls_policies` | 95 policies across all 30 tables |
| `130200_storage` | `product-media`, `brand-media`, `site-content` and their policies |
| `130300_owner_bootstrap` | `jojo_owner_exists()`, `jojo_claim_first_owner()` |
| `130400_grants` | which verbs and columns each role holds |
| `130500_function_hardening` | yes/no functions that never return null; `next_order_number()` closed to the public |
| `130600_function_grants_explicit` | EXECUTE taken from `PUBLIC` and granted by name |

#### Three things the database said that the documentation did not

Each was found by running something, not by reading something.

**1. This project grants nothing by default — not even to the server.**
The first fixture insert failed with `permission denied for table suppliers`, using the
service-role key. Supabase provisioned this project from a hardened template: a new table in
`public` gets `Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) for `anon`, `authenticated`
**and** `service_role`, and no SELECT, INSERT, UPDATE or DELETE for anybody. The same
template installs an `ensure_rls` event trigger that switches RLS on for every new table.

So the 95 policies were necessary and not sufficient; briefly, the schema was one that
nothing at all could read or write. `130400_grants` states the privileges explicitly.
Migration `130100` carries a correction note rather than being quietly rewritten, because it
was applied believing the opposite. **A migration that adds a table must now do two jobs:
grant it and give it a policy, or it is invisible.**

**2. `revoke ... from anon` is not `revoke ... from public`.**
`130500` revoked EXECUTE on the staff-identity functions from `anon`, and the tests then
watched an anonymous caller execute them anyway. `anon` never held a grant of its own — it
was executing them as a member of `PUBLIC`, which is everybody, and revoking a privilege
somebody does not hold changes nothing. `130600` takes EXECUTE from `PUBLIC` and hands it
out by name. A REVOKE that appears to do nothing is a signal, not a formality.

**3. A yes/no function was answering "null".**
`jojo_manages_catalogue()` was `jojo_admin_role() in ('owner','manager')`, and for a caller
with no staff profile `jojo_admin_role()` is NULL, so the answer was NULL rather than false.
Never a security hole — a NULL policy result denies the row exactly as false does — but the
admin dashboard asks these questions directly to decide which controls to draw, and `null`
is not `false` in TypeScript either. Fixed in `130500`.

#### Supabase Auth and the three roles

`admin_profiles.auth_user_id` and `customers.auth_user_id` are now real foreign keys to
`auth.users`, both `on delete set null` — deleting a login must never delete the staff record
the order timeline and the audit trail name as the actor.

Owner / Manager / Order staff resolve through one `SECURITY DEFINER` function, so "what
counts as staff" has exactly one definition: an `admin_profiles` row, linked to this login,
**active**. A deactivated staff member stops being staff immediately, and can still read the
one row that says so, which is how the dashboard says it plainly instead of showing an empty
screen.

There must always be an Owner: a trigger refuses to demote, deactivate or delete the last
active one, including with the service-role key.

#### The first Owner — prepared, not created

> Accurate as of Build 06. The seat was claimed later the same day — see **Owner bootstrap
> completed** below.

Only an Owner may create staff, and there is no Owner. `jojo_claim_first_owner(text)` gives
the seat to the signed-in account if and only if no active Owner exists — under an advisory
lock, writing an `audit_events` row, and raising for every caller afterwards.
`jojo_owner_exists()` is readable before sign-in so the setup screen can choose which form to
show.

No password is ever typed into a file, a migration or a document, and nothing has to be
deleted afterwards.

**Ibrahim's two steps, when he chooses:**

1. Sign up at the project's Auth page (or through the admin sign-in screen, once built) with
   the real Jojo Usafi email address and a password only he knows.
2. Signed in as that account, call the RPC once:
   `select public.jojo_claim_first_owner('Ibrahim Abdul Tayeb');`

The seat is then taken forever, and every other staff account is created from inside the
dashboard.

#### Storage — architecture, deliberately empty

Three public-read buckets, screened by size and MIME type before a byte is written:
`product-media` (5 MB), `brand-media` (2 MB), `site-content` (5 MB). Owner and Manager upload
and replace; **only an Owner deletes**, because `product_media.media_id` is
`on delete restrict` and the bytes under a live product page should be at least as hard to
remove as the row pointing at them.

**No product photography was uploaded.** The 95 approved images remain committed build
artifacts in `public/products/`. The only object ever written was a five-byte test file,
removed by the test that wrote it.

#### Types generated from the real schema

`src/lib/supabase/database.types.ts` is generated by `npm run db:types` from the hosted
schema and is never hand-edited. Build 05's hand-written row interfaces are **gone**;
`src/lib/supabase/types.ts` now holds the friendly names — `ProductRow`, `OrderRow`,
`AdminRoleValue` — as aliases into the generated file, so none of them can describe a column
that is not there. `npm run db:types:check` fails if the repository and the database drift.

Rewriting the test fixtures against the generated types immediately caught four typing
mistakes at `npm run typecheck` that would otherwise have been runtime failures against
Mumbai.

One caveat found by testing: `supabase gen types` does **not** mark a `GENERATED ALWAYS`
column as read-only, so `inventory.available` appears in the generated Insert and Update
types and assigning to it compiles. The database refuses it with `428C9`, and a test asserts
that it does.

#### 169 tests against the real database

`npm run test:db` — a second Vitest project, separate on purpose so `npm run test` keeps
working with no network, no Docker and no Supabase project.

| | | |
| --- | --- | --- |
| `01-schema.test.ts` | 43 | constraints refuse, triggers refuse, `available` is computed, the views mean what they say |
| `02-auth.test.ts` | 18 | the three roles, the bootstrap once and never again, the last-Owner guard |
| `03-rls.test.ts` | 39 | five callers against every policy |
| `04-storage.test.ts` | 10 | bucket configuration and who may write |

Fixtures are fake and obviously so (`ZZTEST`, `zztest`, `aa000000-`), and are removed
afterwards. No invented price, customer or order persists.

Two things the tests established that are worth carrying forward:

- **An order with history cannot be deleted through the API at all.** `order_events`
  cascades from `orders` and then the append-only trigger refuses the cascade. History is
  permanent by design — and it is why teardown has to run as `postgres` through the CLI.
- **Two kinds of "no" are not interchangeable.** `42501` means the *grant* refused, before
  any row was examined. An empty result means the *policy* refused. A denied UPDATE changes
  zero rows rather than raising, so asserting an error there would test nothing.

#### npm audit — read, documented, not force-fixed

2 vulnerabilities: 1 high, 1 moderate. Both are `postcss@8.4.31`, the copy **bundled inside
`next`** (`node_modules/next/node_modules/postcss`). The direct `postcss` devDependency is
already `8.5.28` and is unaffected.

- **Development / build-time only.** PostCSS compiles CSS at build time on a developer
  machine and on Vercel. It is not in the runtime bundle a shopper loads. **No shopper is
  exposed under any configuration.**
- All four advisories require the attacker to control the **CSS being compiled**. This
  project's CSS is `globals.css` plus Tailwind, authored in-repo. No user input reaches
  PostCSS.
- The only fix npm offers is `next@16.3.4` — a **semver-major** framework upgrade.

No fix applied and `npm audit fix --force` was not run: a major framework upgrade to patch a
build-time tool against an input this project does not have is a far larger risk than the
finding. Reassessed when Next 16 is adopted deliberately. Full reasoning in
`docs/DECISIONS.md`.

#### Supabase security advisor

Run before and after. 19 findings remain, all `WARN`, all deliberate:

- 13 + 5 "SECURITY DEFINER function is executable" — the RLS helper functions, which have to
  be callable by the roles whose policies evaluate them. After `130600` the anonymous list is
  only the three public-visibility predicates and `jojo_owner_exists()`; every
  staff-identity function is now closed to `anon`. `rls_auto_enable` in that list is
  Supabase's own platform function, not ours.
- 1 `extension_in_public` — `citext`. **Deliberately not moved.** `anon`, `authenticated` and
  `service_role` have no `search_path` of their own and resolve through `"$user", public`;
  `extensions` is on `postgres`'s path and nobody else's. Moving 47 citext functions would
  risk every email comparison on `customers.email` and `admin_profiles.email` finding no
  operator — a real outage — to remove a little published surface. The safe order is written
  down in `docs/DECISIONS.md`.

#### Verified

Offline: `typecheck` · `lint` · `test` (156 domain tests) · `schema:check` (15 migrations,
377 statements) · `i18n:check` (211 keys) · `catalogue:check` (95 publishable) · `build`
(325 pages) · `qa:screenshots` (80 screenshots, all 15 locale-stability comparisons stable,
no overflow, console errors, broken images, small touch targets, floating-layer collisions
or wrong shelf columns).

Against the real database: `db:types:check` · `test:db` (169 tests).

The approved storefront and admin UI are untouched. Not one component changed in this build.

#### Deliberately not done

Build 07 was not started. The catalogue was not imported, product images were not uploaded,
Google Sheets was not connected, no page was wired to Supabase, and the transactional stock
reservation functions were not written — they belong with the checkout that calls them.

#### One thing to be aware of

While reading the project's API keys, the CLI printed the **legacy `service_role` JWT** into
this session's transcript before it could be redirected to a file. The keys actually written
to `.env.local` are the modern `sb_publishable_…` / `sb_secret_…` pair, not the legacy ones,
and `.env.local` is git-ignored and was never committed.

The exposed key belongs to a development project with no business data and no billing, so
the practical risk is low — but it does bypass Row Level Security, so the tidy thing is to
disable the legacy JWT keys for this project in the Supabase dashboard
(*Settings → API Keys → Legacy keys*). Nothing in this repository uses them.


### Owner bootstrap completed — 2026-09-09

Jojo Usafi has an Owner. **Ibrahim Abdul Tayeb**, linked by foreign
key to a real `auth.users` row, with the claim recorded in `audit_events`. Between Build 06
and Build 07, and scoped to authentication only — no page was wired to Supabase.

#### What the function actually requires

Inspected before anything was invoked, from `pg_proc` rather than from the migration file:

```
public.jojo_claim_first_owner(p_full_name text) returns admin_profiles
  SECURITY DEFINER · owner postgres · search_path = public, pg_temp
  ACL: {postgres=X/postgres, authenticated=X/postgres}
```

EXECUTE is granted to `authenticated` **and to nobody else** — not `anon`, not
`service_role`, not PUBLIC. The body gives the seat to `auth.uid()`. So the claim can only
happen inside the session of the very account being made Owner: it cannot be performed on
somebody's behalf with a privileged key, and there is no argument for "which user" to get
wrong.

#### The authentication infrastructure did not exist, so it was built

The instruction said to use the existing admin sign-in. There was none: no sign-in page, no
session handling, no middleware — and the layout carried a comment referring to a
`src/middleware.ts` that had never existed. The admin ran on a hard-coded `currentUser` mock.

Added, and no more than this:

- `src/middleware.ts` — refreshes Supabase session cookies, matching `/admin` only, so a
  signed-in staff member is not quietly logged out mid-shift. It is **not** the authorization
  boundary; Row Level Security is.
- `src/lib/admin/session.ts` — who is signed in and what may they do, read through the
  caller's **own** session so RLS answers. The service-role client is deliberately not
  imported. It distinguishes three states that must not be confused: nobody signed in,
  signed in but not staff, and signed-in staff.
- `/admin/sign-in` — real email-and-password sign-in as a server action, so the session
  cookie is written `HttpOnly` and no access token is handed to page JavaScript. Supabase's
  developer wording is replaced with plain language, and a wrong email and a wrong password
  give the *same* message so the page cannot be used to discover which addresses have
  accounts.
- `/admin/setup` — the one-time claim screen.
- `AdminShell` renders both without dashboard chrome: offering a nav bar to somebody who is
  not signed in advertises destinations they cannot reach, and the bottom navigation would
  cover a password field on a phone.

**The ten dashboard screens are deliberately still unguarded.** They show mock data; there is
nothing behind them to protect, and the guard belongs with the build that gives them real
data. That is Build 07, and this was not it.

#### How the claim was made without a password

The account holder was not at the terminal and the password must not be handled. The claim
was therefore made the passwordless way Supabase already supports, which
`scripts/claim-first-owner.mjs` performs:

1. mint a single-use magic-link token for the account — service role
2. exchange it for a real session — **anon key**, an ordinary sign-in
3. call `jojo_claim_first_owner` with that session — anon key, RLS in force
4. sign out

Step 3 is exactly what the web form does. RLS is never bypassed, no password is read, typed,
stored or printed, and the service-role key is used only to issue the link — which is what
"email me a sign-in link" does every day.

**No account is hard-coded.** The script discovers the one confirmed login that is not a
`@jojo-usafi.test` fixture, and refuses — listing what it found — if that is ambiguous. It
also refuses outright once a seat is taken, so it cannot be used a second time.

#### Verified from the database, not from the script's output

| | |
| --- | --- |
| `jojo_owner_exists()` | true |
| Profile | Ibrahim Abdul Tayeb · role **owner** · active |
| Link | `auth_user_id` joins `auth.users`; emails match; 0 orphan profiles |
| Audit | one `admin_profile.first_owner_claimed` row, actor `staff`, source `admin` |
| Second claim | refused — "Jojo Usafi already has an Owner" |
| Anonymous claim | refused with `42501`, before the function body runs |
| Non-staff self-promotion | `INSERT` into `admin_profiles` refused `42501`; `UPDATE` of the Owner's row changes 0 rows |
| RLS still sane | that same non-staff account still reads the public shelf — RLS denies staff data, not everything |
| Boundary intact | 95 policies, RLS on all 30 tables, unchanged |

#### The bootstrap is disabled by state, not by deletion

`/admin/setup` now renders "Already set up" and no form; the "set up the Owner account" link
is gone from the sign-in page. The function raises for every caller.

Neither was removed, and that is deliberate. **A migration applies to every environment**,
including a fresh production project on its first day, which will have no Owner and will need
exactly this screen and exactly this function. Revoking the bootstrap because this development
database had finished with it would arrive in production having already disabled the thing
production depends on. The right gate for a capability whose availability differs per
environment is a question about that environment's state — which is what both layers ask.

#### A bug this found, in Build 06's own test teardown

`tests/db/teardown.sql` deleted `audit_events where action =
'admin_profile.first_owner_claimed'` — written when the only such row could have been a
fixture's. The first test run after the real bootstrap deleted **Jojo Usafi's own audit row**
as tidy-up.

Caught immediately by the test asserting that row exists. The clause is removed — teardown now
matches fixtures by what they *are*, never by what *happened*, and the clause was redundant
anyway since a fixture claim's `entity_key` already matches `zztest%`. The row was
reconstructed from `admin_profiles.invited_at` and carries
`request_id = 'reconstructed-2026-09-09-after-test-teardown-deleted-it'`, so the trail is
honest about its own repair.

The last-Owner guard tests were reworked as part of the same fix: they now run against the
real Owner row with the fixture Owner stood down, and every attempt is wrapped in a restore
that puts the row back — re-inserting it from a snapshot if necessary. A test that discovers a
broken guard must not also be the thing that leaves the shop without an Owner. That safety net
earned its place on the very first run, when the guard tests failed for an unrelated reason
and the deletion actually went through.

#### Verified

`typecheck` · `lint` · `test` (156) · `schema:check` · `i18n:check` · `catalogue:check` ·
`db:types:check` · `build` (325 static pages, unchanged; the two new routes are dynamic) ·
`qa:screenshots` (**125** screenshots — the sign-in page joins the gate at all five widths) ·
`test:db` (**112** tests).

No migration was added. The database schema is byte-for-byte what Build 06 left.


### Build 07 — the real catalogue, in the database and on the shelf — 2026-09-09

The storefront now reads Supabase. 201 products, 95 on the public shelf, 95 photographs in
Storage, and the local CSV demoted from "what the shop is" to "what the shop is imported
from". **Cost: TZS 0** — 2.6 MB of images on the free tier.

#### 0. Test isolation, before anything was imported

The Owner-bootstrap build ended with an uncomfortable finding: teardown had deleted Jojo
Usafi's real audit row, and the last-Owner tests had been mutating the real Owner — on one
run a DELETE actually went through. None of that could be allowed near real catalogue data,
so it was fixed first and verified before a single product was imported.

**Every run now mints a token** (`run-context.ts`), eight hex characters, and every fixture
row carries it — SKUs `ZZ1A2B3C4D-P1`, emails `zz1a2b3c4d-owner@jojo-usafi.test`, storage
paths, the customer phone number, the analytics session. Teardown is rendered per run from
`teardown.sql.tmpl` and deletes **that token and nothing else**. The previous run's token is
swept too, if it crashed — but only ever a token this suite minted itself.

**The rule that broke last time is now explicit**: teardown identifies rows by who made
them, never by what they are or what happened. No matching on a role, an action name, a
lifecycle or a shared email domain. There is no pattern left in that file that a real row
could match — and because fixture Owners are never the last Owner, the
`admin_profiles_last_owner` trigger is no longer disabled during cleanup either.

**The last-Owner guard is exercised without touching a committed row.** It only fires for
the last active Owner, and Jojo Usafi's is permanent, so the whole scenario moved into
`last-owner-guard.sql`: a transaction that creates probe Owners, stands the others down
*inside the transaction*, exercises all three refusals, and always `ROLLBACK`s.

**`05-real-data-untouched.test.ts` is the regression test.** `globalSetup` snapshots every
real `admin_profiles` and `audit_events` row *before* any fixture exists; the last test file
compares the live rows against that snapshot **byte for byte**, whole rows, sorted keys. It
also fails closed: if there is not exactly one real active Owner before the suite starts,
nothing runs at all, because a suite that cannot identify the fixtures cannot be trusted to
decide what to delete.

Two protections were discovered while writing it, both worth knowing:

- **A staff member who appears in the audit trail cannot be deleted by anybody.** Deleting a
  profile nulls `audit_events.actor_admin_id`, and that table is append-only, so the delete
  is refused outright. Deactivation is the only way to retire someone — which is exactly
  what the dashboard offers.
- The `restoring()` net written during the bootstrap build earned its place on its very
  first run and is now unnecessary, because nothing points at the real Owner any more.

#### 1–4. The importer

`scripts/import-catalogue.mjs` — dry-run first, idempotent, and incapable of deleting.

It reads the **built artifact** rather than re-parsing the CSV, and re-runs
`build-catalogue.mjs --check` first so the two cannot disagree. Parsing the master a second
time was the obvious alternative and the wrong one: SKU-to-photograph matching would then
exist in two places, and that is the one rule this catalogue cannot afford to get wrong.

The builder gained the columns the database needs and the shelf never showed — EAN, ITF-14,
offer price, stock quantity, low-stock threshold — so `catalogue:check` guards them too.

What it refuses to do: delete a product because a row vanished from the master; invent a
product for an orphan photograph; correct a suspicious price; raise a blocked product's
visibility. **Blocked always wins over the master's WEBSITE STATUS**, so a re-import can
never publish something that should not be public.

Classification is real: it reads the existing rows, compares column by column, and reports
insert / update / unchanged. **The second run reported 201 unchanged, 0 uploads, 95 images
reused** — which is what idempotent means.

#### 3. Families and variants, from the data rather than from an assumption

65 families, and the size axis is declared **only for families whose data actually varies by
size**. Scent is deliberately not modelled: the Product Master carries one descriptive name
per row and no scent column, so a scent axis would have to be guessed out of product names —
the fuzzy identity matching this catalogue refuses everywhere else. 12 size values,
65 family-axis rows, 201 assignments. Every SKU keeps its own price, barcode, size, stock,
image, visibility and merchandising flags.

#### 5–6. Photographs in Storage

The 95 approved WebP files — the ones the approved Build 03 pipeline already produced, white
background, 800px square, unaltered — uploaded to the existing `product-media` bucket under

```
product-media/<SKU>/<sku>-primary-1.webp
```

A second bucket was not created: `product-media` already exists with the policies Build 06
wrote and tested, and duplicating that surface to gain a different name would be a cost with
no benefit. The path convention is the one already recorded on `media_assets.storage_path`.

Each object's **sha256 is stored on the `media_assets` row**, so a re-import compares
checksums and uploads nothing that has not changed. No images were re-encoded, and no orphan
or archive image was uploaded — `EP23-A02` exists only in the import report.

#### 7. What is actually in the database

| | |
| --- | --- |
| Products | **201** — every master row kept |
| On the public shelf | **95** |
| Withheld, kept | **106** (105 no approved photograph; `EP01-A01` also `PRICE_IMPLAUSIBLE`) |
| Brands / categories / suppliers | 22 / 5 / 1 |
| Families | 65, all varying by size |
| Photographs in Storage | 95, one folder per SKU |
| Wrong-SKU photographs | **0** |
| `EP23-A02` | not a product — orphan image, reported only |
| `EP01-A01` | price **128** unchanged, not visible, not on the shelf |

#### 8. Opening stock

201 inventory rows, `on_hand` from the master's STOCK QTY, `reserved` 0, `available` equal to
`on_hand` — 12,822 units. Every opening balance is explained by a `receipt` movement
referencing the import run, so the ledger reconciles from day one rather than beginning with
unexplained numbers.

Stock is initialised **once per product**. A re-import never resets a count the shop has
since corrected, sold from or received against: after day one the ledger is the authority,
not the spreadsheet.

#### 9–11. The storefront reads Supabase

`src/lib/catalogue/queries.ts` is still the only seam, and is now async and Supabase-backed.
The UI was not redesigned; server components gained `await`.

**Three queries for the whole catalogue, shared by every visitor for five minutes.** The
shelf comes from the `product_shelf` view — the one definition of "a customer may see this" —
so the storefront cannot publish something the database considers hidden, because it has no
way to see it. A homepage rendering four shelves, a category strip and a brand row costs the
same three queries as a single product page, and usually none: the 95 product pages per
language are prerendered with 5-minute ISR.

Reads go through a **session-less anon client**, so pages stay cacheable and everything is
fetched under exactly the policies a shopper's browser would get.

Client components — the cart drawer, the checkout summary, the mobile menu — receive the
published catalogue through `CatalogueProvider` rather than importing a JSON file. The cart
still stores only SKUs and quantities; the catalogue turns them back into products to draw.
This ships *less* to the browser than before: 95 published products instead of all 201 rows.

One deliberate UI change: the product page no longer shows "Supplied by". `suppliers` is
closed to anonymous readers by policy, and a shopper does not need the shop's supply chain.

#### 12. The admin reads the real catalogue

`/admin`, `/admin/products` and the product editor now show real SKUs, names, prices, stock,
visibility, images and missing-image state. The invented stock/hidden/sync figures are gone.

It reads through **the caller's own session, not the service role** — because the ten
dashboard screens are still not behind a sign-in guard, and a privileged read would hand the
shop's full price and stock list to anyone who typed `/admin`. Row Level Security answers
instead: staff see all 201, anyone else sees the 95 that are already public, and the page
says which. Writing products is still not enabled; orders and customers remain mock.

That boundary announced itself during QA: the admin pages returned 500 with
`permission denied for table inventory`, because an anonymous reader holds a column grant
covering `available` and not `on_hand`. The query now asks for what the caller may see.

#### 13. Security, re-checked after the import

Verified with the anon key, in `06-catalogue.test.ts`: a shopper still cannot read
`suppliers`, `inventory.on_hand`, `audit_events` or the sync tables; cannot update a price;
and cannot upload into `product-media`. Availability, which the shelf needs, is readable.

#### 14. Import audit

Every run writes an `audit_events` row (`catalogue.imported`) with the counts, and produces
`docs/CATALOGUE_IMPORT_REPORT.md` plus `src/lib/catalogue/generated/import-report.json` —
rows read, inserts, updates, unchanged, blocked with reasons, image matches, missing images,
orphan images, warnings and errors. No secrets are logged.

#### Verified

`typecheck` · `lint` · `test` (156) · `schema:check` · `i18n:check` · `catalogue:check` ·
`db:types:check` · `build` (230 static pages) · `qa:screenshots` (**125** screenshots, all 15
locale-stability comparisons stable, SKU↔photograph checked against the Storage URLs) ·
`test:db` (**129** tests).

Plus, specifically: importer dry-run, importer idempotency (second run 0 changes, 0 uploads),
PostgreSQL row counts, public-visibility checks, Storage object/SKU mapping, RLS as an
anonymous shopper, real storefront fetch, and the byte-for-byte real-Owner regression test.

#### Deliberately not done

Build 08 was not started: no Google Sheets API, no Apps Script, no Sheet↔Supabase sync.
Product writing from the admin is not enabled. Orders and customers are still mock. The ten
dashboard screens are still not behind a sign-in guard — that belongs with the build that
lets them write.

#### One thing to be aware of

Catalogue caching is **time-based** (5 minutes) rather than invalidated by the importer. A
re-import is visible on the storefront within five minutes, not immediately. A
`revalidateTag('catalogue')` endpoint needs an authenticated caller to be safe, so it belongs
with the admin write path rather than being bolted on here.


### Build 08 — the reservation engine, proved — 2026-09-09 · **PARTIAL**

The transaction that makes Jojo Usafi a shop rather than a catalogue is built,
applied and proved against the real database, including the last-unit race. The
customer-facing checkout screen that would drive it is **not** built. Cost: TZS 0.

#### What the engine does

One PostgreSQL function, one transaction, all of it or none of it:

```
lock the inventory rows (FOR UPDATE, in product-id order — no deadlock)
  → price every line from the current rows
  → check the shelf, the quantities and the availability
  → upsert the customer on phone
  → allocate JU-000123 from a sequence
  → write the order, its snapshotted lines, the reservation,
    two ledger movements and two order events
```

Fail anywhere and PostgreSQL unwinds the lot. **A cart reserves nothing** —
stock is committed at exactly one moment, a successful order.

#### The trust boundary

The browser may say **which SKUs and how many**, and which delivery area. It may
not say what anything costs: there is no parameter anywhere in
`jojo_quote_order`, `jojo_place_order` or `src/lib/commerce/checkout.ts` for a
price, a subtotal, a delivery fee or a total. A hostile request carrying its own
figures changes nothing because there is nowhere to put them — asserted by a
test that sends `unit_price: 1` and gets 10,000 back.

`jojo_place_order` is granted to `service_role` **only**. An anonymous caller
gets `42501` before the function body runs; the reachable path is a Next.js
server action holding the key, which is where request shaping and, later, rate
limiting belong.

#### Concurrency, proved

| Scenario | Result |
| --- | --- |
| 1 in stock, 2 simultaneous orders | exactly **1** succeeded, 1 refused |
| 3 in stock, 5 simultaneous orders | exactly **3** succeeded, 3 distinct order numbers |
| After each race | `available = 0`, `reserved <= on_hand`, never negative |
| Refused attempt | no order, no lines, no events, stock untouched |
| One bad line among several | **nothing** reserved |

#### The rest of the engine

- **Order numbers** come from a sequence via `next_order_number()`. Never derived
  by counting rows; two simultaneous orders cannot collide.
- **Customer matching** is on `phone_e164`, normalised in TypeScript (ten unit
  tests) and re-validated by the column's own CHECK. A returning shopper updates
  one row — and the ORDER keeps its own snapshot, so renaming a customer later
  never rewrites what an old order said. Both asserted.
- **Cancellation** releases the reservation, writes the movement and the events,
  and is **idempotent**: `reservation_released_at` means a retry returns
  `already: true` and gives nothing back twice.
- **Track order** needs the order number **and** the phone. A right number with a
  wrong phone is indistinguishable from a wrong number — otherwise every order
  could be read by counting upward. The projection excludes staff notes, actor
  identities, payment references and all audit/sync internals.
- **Reservation expiry** has a home without an invented duration:
  `shop_settings.reservation_warning_minutes` / `reservation_expiry_minutes` both
  start **null** — undecided, not zero — and `jojo_stale_reservations()` can
  already list what would qualify. No reservation can be held forever unfindable.
- **Stock operations** are `jojo_add_stock` and `jojo_count_stock`. `on_hand` is
  never overwritten bare: both write the number and its ledger movement in one
  transaction, with the staff member's identity. A count that agrees writes
  nothing; a count below what is already promised to orders is refused rather
  than breaking `reserved <= on_hand`.

#### A bug the tests caught

`jojo_cancel_order` failed with `42804`. A bare `'system'` in a VALUES list is an
UNKNOWN literal that PostgreSQL resolves to the target enum; wrap it in a CASE
inside `INSERT … SELECT` and it is decided as `text` first, and there is no
implicit cast from text to an enum. Fixed in migration 0017 — exactly the sort of
thing a test against a real database catches and a careful reading does not.

#### Admin routes are now guarded

Build 06 deliberately left the dashboard open because it showed invented data.
That reasoning expired when the screens got real prices, stock and orders. All
seven real-data routes now redirect a signed-out visitor to `/admin/sign-in`,
asserted by the QA gate. Middleware answers only "is anybody signed in"; whether
that person is staff stays with Row Level Security, so there is one authority and
not two.

`revalidateCatalogue()` drops the five-minute storefront cache on demand and
refuses anybody who is not active staff — an open version would be a cheap way to
make the shop slow.

#### NOT BUILT — the honest half

The customer never sees any of this yet.

- **No checkout screen.** `/checkout` is still the Build 03 visual shell. The
  server action (`src/lib/commerce/actions.ts`), the quotation, the validation and
  the order path behind it are written and tested; what is missing is the form —
  a delivery-zone chooser, payment-preference options, and the bilingual copy for
  all of it, since `i18n:check` requires English and Kiswahili parity.
- **No confirmation screen**, **no wired Track Order page** — same reason.
- **No admin write UI.** `jojo_add_stock`, `jojo_count_stock` and the RLS policies
  for product and delivery-zone edits all exist and are tested; the Product editor
  and Delivery Zones screens still do not call them.
- **No admin order list on real data.**
- **No amendment function.** The contract is documented; the code is not written.

This was a scope call, not a discovery: the engine plus its concurrency proof
took the build's time, and rushing a bilingual checkout rewrite of the approved
storefront without room to verify it would have risked the one thing that is
working. **Build 09 must finish this before Google Sheets.**

#### Development delivery zones

Checkout needs at least one active area, and the real list is Ibrahim's decision.
`scripts/seed-dev-zones.mjs` writes four placeholders, each carrying a `notes`
value that says in full that it is a development fixture awaiting the real list.
They are not in `supabase/seed.sql` and must be replaced before launch.

#### Verified

`typecheck` · `lint` · `test` (156) · `schema:check` (18 migrations) ·
`i18n:check` · `catalogue:check` · `db:types:check` · `build` (230 static pages) ·
`qa:screenshots` (**80** screenshots; the admin guard asserted on all seven
real-data routes) · `test:db` (**154** tests, 25 of them commerce).

The QA gate lost the ten admin dashboard screenshots, because those screens now
require a session. Closing that needs a seeded QA staff account — recorded in
`docs/TESTING_REQUIREMENTS.md`.


### Build 08B — the customer can buy — 2026-09-09 · **PARTIAL**

A shopper can now put something in a basket, check out as a guest, get a JU number and
track the order. The staff-facing half of the same operations exists and is tested in the
database, but the admin screens still do not call it. Cost: TZS 0.

#### Checkout — real

`/checkout` and `/sw/checkout` are working guest checkout, one page, mobile first, no account.

**The money on that screen is not that screen's opinion.** The cart knows SKUs and quantities;
every figure comes back from `jojo_quote_order`, which prices the basket inside PostgreSQL.
The quote is re-requested whenever the basket or the delivery area changes, so a price that
moved while the basket sat open is shown *before* the shopper commits, not after. A line that
cannot be filled says so by name and by number — "Only 3 of Multix 5LT left" — with a link
back to the basket, rather than a generic failure.

Fields are as required: name, phone, optional email, active delivery area, address, optional
notes, and a payment preference. Phone is normalised server-side by the domain layer's rule
(ten unit tests) and re-validated by the column's own CHECK. A free-delivery zone shows
**FREE**, not "TSh 0".

Double submission is prevented by `useFormStatus` — the framework disables the button while
the action is in flight, rather than a piece of state this component has to remember to reset.

#### Confirmation and Track Order — real

`OrderReceived` renders **after** the row exists in PostgreSQL: the order number, the items,
subtotal, delivery, total, area, address and payment preference, then *Track my order* and a
prefilled WhatsApp support link. WhatsApp is support, never the way to order.

Track Order is wired to `jojo_track_order`. Both the order number **and** the phone are
required, and a wrong phone is answered exactly like a wrong number — otherwise knowing that
JU-000128 exists would be enough to read it and every order could be read by counting upward.
Statuses are friendly, in both languages, from a new `orderStatus` dictionary.

**267 i18n keys, EN and SW in sync**, and the locale layout-stability gate is still green.

#### The middle of an order's life — new, and tested

Build 08 built the two ends: created, and cancelled. Migration 0018 adds the moves between,
each a single transaction:

- **`jojo_advance_order`** — enforces the same transition table as
  `src/lib/domain/orders.ts`, so a request that never touched the application still cannot
  send a completed order back out for delivery. It is idempotent, and it refuses cancellation
  and delivery-failure outright, pointing at the functions that handle their stock properly.
- **Completion is where stock actually leaves the shop.** Until then nothing is deducted,
  because until the customer has it, the shop still has it. Completing converts the
  reservation into a `sale` (`on_hand -= n`, `reserved -= n`) and demands the payment: a
  method always, and a transaction reference for digital.
- **`jojo_fail_delivery`** asks the question the admin prototype always asked — *were the
  items returned?* — and it has no default, because guessing corrupts the stock figures in one
  direction or the other:
  - **returned** → the goods are back and still promised to this order, which can be sent out
    again. Nothing moves.
  - **not returned** → `on_hand` falls, the reservation is released, and a `damage_loss`
    movement records it with the reason. Two movements rather than one, because `damage_loss`
    may only touch `on_hand` and a single row would have to lie about which column moved.

#### End to end, proved

`tests/db/08-order-lifecycle.test.ts` walks the whole journey against the real database:
place → confirm → prepare → out for delivery → complete with payment, asserting at every step
that `on_hand` has not moved and the reservation is still held, and that at completion —
and only then — the stock is deducted and a `sale` movement written. Plus: completion refused
without payment, digital refused without a reference, illegal transitions refused, both
delivery-failure outcomes, and every order function closed to an anonymous caller.

#### Two accessibility regressions the QA gate caught

Both in the new checkout, both real:

- the breadcrumb link was 44px tall and 25px wide — `min-w-11` restored;
- the payment radios were 20×20. The input now covers the whole 56px card and the dot is
  drawn with `peer-checked`, so what a thumb has to hit is the card while the control is
  still a real radio with real focus.

#### NOT BUILT — the admin half

The staff-facing screens still show mock orders and still do not write:

- **Admin Orders** list and detail are mock; real DEV orders do not appear.
- **Next actions, payment completion, cancellation and delivery-failed dialogs** are not
  wired — though every one of the server operations behind them now exists and is tested.
- **Product writes, stock Add/Count, delivery-zone writes** are not wired;
  `jojo_add_stock`, `jojo_count_stock` and the RLS policies are ready.
- **`revalidateCatalogue()`** exists and refuses non-staff, but nothing calls it yet, because
  nothing writes yet.
- **No QA staff account** was seeded, so the ten dashboard screens still have no visual QA.

Same reason as last time, stated plainly: the customer path plus the order-lifecycle engine
took the build, and the admin wiring is a second build's worth of forms and dialogs. What is
shipped works; what is missing is honestly missing.

#### Verified

`typecheck` · `lint` · `test` (156) · `schema:check` (19 migrations) · `i18n:check`
(267 keys) · `catalogue:check` · `db:types:check` · `build` (230 static pages) ·
`qa:screenshots` (80 screenshots, both languages at all five widths, admin guard asserted) ·
`test:db` (**169** tests).

## Build 08C — live admin operations — 2026-09-09

**The shop can now be run from a phone.** A staff member signs in, sees the real orders, opens
one, moves it forward, records what was actually paid, cancels it or marks the delivery
failed — and changes prices, adds stock, counts stock and edits delivery areas. Every one of
those is a real write to the development database, and every one is refused if the person's
role does not allow it.

This build wired the approved Build 04 dashboard to the engine Build 08 proved. **No screen
was redesigned.** Home / Orders / Products / Customers / More, mobile-first, plain language,
one obvious next action, no raw state dropdown, no destructive delete, SKU locked — all of it
is exactly as approved; only what is underneath changed.

### The three files that made it work

```
src/lib/admin/model.ts        the vocabulary and the view-model
src/lib/admin/orders.ts       the READS — under the caller's own Row Level Security
src/lib/admin/authorize.ts    the GATE — signed in? active staff? does the role allow it?
src/lib/admin/actions.ts      the WRITES — one server action per operation
```

`orders.ts` deliberately never imports the service-role client. Reads run on the signed-in
staff member's session, so a policy mistake shows up as an empty screen rather than as a leak.
The service role is used by exactly four writes — advance, complete, cancel, delivery-failed —
because each is one transaction across `orders`, `inventory` and two append-only ledgers, and
neither ledger has an INSERT policy for a browser token.

Nothing in `actions.ts` does arithmetic. Reservation maths, transition legality, the payment
rules and the delivery quote all stay in the SQL functions; the actions decide **who may ask**,
and turn a refusal into a sentence.

### What each screen does now

| Screen | Before | Now |
| --- | --- | --- |
| Home | seven invented orders, TSh 186,400 | real counts, today's real sales, the five most recent orders, the real `order_events` feed |
| Orders | mock list | every real order, searchable by number, name or phone, filtered by the five stages staff work through |
| An order | mock detail, buttons that did nothing | real lines, real timeline, real WhatsApp and call links, and four working operations |
| Products | real (Build 07) | unchanged, but counting **available** stock rather than what is in the store |
| Product editor | `mockSave()` on a timer | real writes: price, offer, show on website, featured, best seller, archive |
| Stock | a number the screen changed locally | **Add stock** and **Set counted stock**, both through the ledger |
| Customers | seven invented people | real customers, their real spend, their real order history and the addresses their orders actually went to |
| Delivery zones | five invented areas | the real zones checkout quotes from — development placeholders visibly marked "Example area — replace" |

### The four dialogs

- **Complete order** asks for the payment first, and completion + payment go in **one** call
  because they are one transaction. Recording the payment and hoping completion follows would
  leave a paid order that never completed.
- **Cancel order** demands a reason, releases the reservation, and says how many items went
  back on the shelf.
- **Delivery failed** asks the one question that decides the stock — *were the items returned?*
  — with no default answer, then either leaves the reservation held so the order can go out
  again, or writes the goods off with a `damage_loss` movement.
- **Add stock / Set counted stock** never overwrite a number. A count records the
  **difference** and must say why; a count that matches writes nothing and says so.

Every operation refreshes from the database rather than from a guess, so the screen cannot
disagree with the shop about what happened.

### Honest about the Sheet

The editor says **"Saved"** and, separately, **"Product sheet sync: not connected yet."** There
is no Google Sheet write-back, so a badge reading "Synced" would be the dashboard lying about
where the truth is. Build 09 changes that sentence; nothing before then does.

### The mock data is gone

`src/mocks/admin/data.ts` used to export orders, customers, zones, today's figures, the
attention counts and an activity feed. All deleted. The vocabulary that lived beside them —
stage labels, next actions, cancellation reasons, `AdminOrder` — moved to
`src/lib/admin/model.ts`, which is not a mock. What remains in the mocks file is the Website
screen's draft content, because that screen genuinely is still a prototype and says so.

A dashboard that can fall back to plausible fiction is a dashboard that can quietly show
fiction. An empty database now produces an empty screen with a sentence explaining it.

### Development QA staff — no password anywhere

```bash
npm run qa:staff create   # a Manager and an Order staff account, one password, printed once
npm run qa:staff status
npm run qa:staff remove   # deletes exactly what create made, by recorded id
npm run dev:orders        # two orders, placed through jojo_place_order like a customer's
```

No password is stored. `create` mints a random one and prints it; `qa:screenshots` mints its
own and resets it on the exact recorded auth user id before signing in through the real form.
Cleanup is by exact identity — recorded auth user id and profile id in a gitignored manifest —
never by role, email domain, name or business state, and it refuses rather than guessing when
the manifest is missing. **Ibrahim's real Owner account is never touched**, and
`05-real-data-untouched.test.ts` still proves that row is byte-for-byte unchanged.

### The dashboard has its visual QA back

The QA gate now signs in as the development QA Manager and audits Home, Orders, an order,
Products, the Product editor, Customers, More and Delivery Zones at all five widths — plus the
dialogs, which only exist after a click and are where a phone-sized dashboard usually goes
wrong. Each is checked for horizontal overflow and 44px touch targets.

### Proved against the real database

`tests/db/09-admin-operations.test.ts` — 24 tests, signed in as real staff tokens:

- **Order staff refused**: a price change (zero rows), taking a product off the website, adding
  stock, recording a count, changing a delivery fee, promoting itself to Owner.
- **Manager allowed**: price and offer (and the shelf shows it), stock through the ledger with
  an actor and a reference, a count that records the difference and one that records nothing,
  a delivery fee that checkout then quotes.
- **Manager refused**: promoting itself to Owner, and rewriting what an order sold for — that
  one dies on the column grant, before any policy is consulted.
- **The whole staff journey**: confirm → prepare → out for delivery → complete with cash, and
  again with a digital reference; stock leaves only at completion; cancellation puts it back;
  both delivery-failure answers do the right thing.
- **What each screen can read**: staff see orders, customers and the stock breakdown; a
  stranger is refused all three on the grant; Order staff get no audit trail.

Plus six offline tests pinning the capability matrix both the screens and `authorize()` read,
so a control that is drawn and an operation that is permitted cannot drift apart.

### Three corrections worth recording

**A test that was wrong about the database.** The first version of the "items came back" test
compared the reservation against the figure from *before* the order was placed, and read a
correctly-held reservation as a leak. The database was right: an order whose goods came back
keeps its reservation, because it can be sent out again, and releasing it would let the same
units be sold twice.

**Database jargon on the order screen — caught by the screenshots, not by review.** The
timeline was showing the ledger's own summaries: `preparing → out_for_delivery`, `new →
confirmed`, and `checkout` / `system` as the person who did it. That is exactly what
`docs/ADMIN_UX.md` forbids, in the one place an operator looks to find out what happened.
Each sentence is now composed from the event's kind and destination state — "Sent out for
delivery", "Being prepared" — and the actor codes are translated. The ledger keeps its
precise wording, because that is the ledger's job.

**A QA pass that skipped quietly.** The dashboard pass waited 600ms after clicking into an
order and then read the URL. Client-side navigation had not finished, so it captured the
orders *list* as the order URL, and the delivery-failed and payment dialogs were audited
against the wrong page and silently found nothing — the run passed with two of four dialogs
never looked at. It now waits for the route, fails if the order does not open, and says so
when a dialog's opener is absent. `QA_ONLY=admin` re-runs the dashboard pass in four minutes
instead of twenty-five.

### Verified

`typecheck` · `lint` · `test` (**162**) · `schema:check` (19 migrations) · `i18n:check`
(267 keys) · `catalogue:check` · `db:types:check` · `build` · `qa:screenshots` (**122**
screenshots, PASS) · `test:db` (**193**) · `verify:cache` (a price saved in the editor is on
the shop on the next request).

One process at a time, and that turned out to matter: running `test:db` and `qa:screenshots
together against the one development database failed both — the QA gate photographed the
suite's fixture products and reported their torn-down images as broken, and the suite read
stock the browser had moved. Neither was a defect. Both gates now run alone.

### The cache is proved end to end

`npm run verify:cache` changes a price in the real editor as the development QA Manager,
then reads the product page as a signed-out shopper and requires the new price to be there —
and puts the old price back. Both halves of the invalidation are one line each and both look
obviously correct, which is exactly the wiring that is silently broken: nothing fails when it
is, the price simply arrives up to five minutes late, in production, when nobody is looking.

### Still not done

- **The Website screen** still saves nothing, and says so on its face. It is the last screen
  reading the mocks file.
- **Reports, Staff and Settings** are marked "Coming soon".
- **Order amendment** before dispatch, and the **reservation-expiry scheduler** — the function
  exists and is tested; the durations are Ibrahim's decision.
- **Google Sheets.** Nothing in this build touched Google, by instruction. That is Build 09.

## Build 09 — the Google Sheet catalogue sync — 2026-09-09

**Built, tested and waiting for a key.** The two-way synchronisation between the Product
Master and Supabase is complete: the engine, the admin screen, the conflict resolution and 43
new tests. What it does not have is a Google service account and a spreadsheet ID, which only
Ibrahim can create — six free steps, listed in `docs/GOOGLE_SHEET_SYNC.md`. Until then the
Catalogue Sync screen says "Not connected" and nothing else in the shop is affected.

### The rule the design is arranged around

**The Sheet is a control surface, not a second database.** Supabase stays the operational
source of truth; the storefront reads Supabase and only Supabase. Every one of the Product
Master's 39 columns is classified in `src/lib/sheets/columns.ts` with an explicit owner, and
**a column that file does not name stops the whole run** — reading rows through a map nobody
has checked is how a spreadsheet silently starts writing the wrong thing into the shop.

### Stock cannot be set from the Sheet

`STOCK QTY` was authoritative once. It is not now: the ledger is. Change that cell from 10 to
1000 and the sync creates **no units** — the plan structure has no way to express an
inventory change at all, so this is not a rule that could be forgotten, it is a shape the code
cannot make. The shop's real figure is written back into a read-only column beside it.

Proved twice: the plan can never name an inventory field, and against the real database a
`STOCK QTY` of 999,999 moves `on_hand` by nothing and adds **zero** rows to
`inventory_movements`.

### Three-way, never last-write-wins

The comparison is the Sheet's value, the database's value, and the **base** — what the two
last agreed on. A field moves only if the side it came *from* actually changed it.

- Sheet changes the name, dashboard changes the price → **merged**.
- Both change the price → **conflict**. Neither applied, neither defaulted to, and the product
  frozen until a person decides on *Admin → More → Catalogue sync*.

Two of the first tests written failed before the base was threaded through — a price raised in
the dashboard was being silently undone by a spreadsheet that had simply not caught up. That
is the failure mode this whole mechanism exists to prevent, and it was real.

### A product missing from the Sheet is reported, never removed

Not deleted, not archived, not hidden. Orders point at it, and rows vanish for reasons that
have nothing to do with intent. A test asserts the plan's own JSON contains no delete or
archive verb, so the rule cannot be weakened without something noticing.

### Google is never in a customer's path

No storefront or checkout module imports the sync. No Google call happens inside a customer
request. A sync that fails is a sync that failed: the shop keeps serving, checkout keeps
taking orders, admin operations keep working, and admin product edits keep saving to Supabase
and revalidating the storefront. Proved by a test that kills the gateway and then places and
cancels a real order.

### The admin screen

*Admin → More → Catalogue sync*, Owner and Manager only — a new `catalogue.sync` capability.
Connected or not, when it last ran, how many products, how many need a decision, how many
rows need fixing. One primary action, **Sync now**, and a **Check first, change nothing** dry
run beside it. Outcomes are sentences — *"Sync complete. 3 products updated from the sheet.
1 product needs a decision."* — never JSON.

A conflict shows the product, the field, both values and two equally weighted buttons. Neither
is preselected; neither is styled as the recommendation. The shop does not know which is right.

### Connection and credentials

A Google **service account** with the OAuth scope `spreadsheets` and nothing else, reaching
exactly one spreadsheet because that spreadsheet is shared with its email address. No Drive
scope, so it cannot see anything else. The JWT is signed by hand with `node:crypto` rather
than pulling in `googleapis` — sixty readable lines instead of a package carrying every Google
API there is.

Nothing is committed: `.env.example` holds names and placeholders, `.env.local` is gitignored,
and no credential reaches a log line, an error message or this repository. A key-parsing
failure is reported *without* the underlying exception, because a `node:crypto` key error can
echo part of the key.

### Manual only, on purpose

No cron, no Apps Script poller, no paid scheduler. `POST /api/sync/catalogue` exists so a
schedule has something safe to call when one is decided; it requires a bearer secret compared
in constant time and **refuses every request when that secret is unset or too short** — a
deployment that forgets it is closed, not open.

### Business-rule correction, as instructed

Two things were listed as launch blockers and are not:

- **A global free-delivery spend threshold** — there is none. Free delivery is a property of a
  delivery area. The EcoPlus reference has a TSh 30,000 threshold; Jojo Usafi has not adopted it.
- **A same-day delivery cut-off** — none at launch. Delivery timing is confirmed with the order.

Both removed from the blocker lists and recorded as decisions rather than gaps. Nothing in the
code changed: neither was ever implemented, because neither was ever decided.

### One thing worth recording

The sync's own database tests were leaving their `sync_jobs` rows behind, and the Catalogue
Sync screen was reporting a test run as the shop's last sync. Seventy-six had accumulated.
They were removed by their own ids, and the test file now collects and deletes exactly the
jobs it starts — never "all sync jobs", which is the rule Build 06 learned the hard way.

### Verified

`typecheck` · `lint` · `test` (**185**) · `schema:check` · `i18n:check` (267) ·
`catalogue:check` · `db:types:check` · `build` · `qa:screenshots` (**127**, PASS) ·
`test:db` (**213**).

The two database-touching gates are run one at a time; running them together fails both for
reasons that are not defects.

### Still not done

- **Connecting it.** Six human-only steps, all free, in `docs/GOOGLE_SHEET_SYNC.md`.
- **Creating products from the Sheet.** Reported today. The writing half needs brand, category
  and family to resolve, and a decision about what happens when they do not.
- **A schedule.** The endpoint is ready; the deployment architecture is not.
- **Media through the Sheet.** Images stay matched on exact SKU in Storage. A Sheet image URL
  never becomes a product photograph.

## Build 09 continued — the real Sheet, connected and read — 2026-09-10

The Google setup is done: project *Jojo Usafi Sheets Sync*, the Sheets API enabled, and a
service account with Editor access to **one** spreadsheet — *Jojo Usafi Ecommerce Master
Control* → *Product Master*. The four settings are in the git-ignored `.env.local`; the JSON
key was deleted. No billing account was involved, and the private key was never read, printed
or logged by anything in this session.

**This pass was read-only and nothing was synced.** The gateway was wrapped in a proxy whose
write methods throw, so the safety of the pass did not rest on the `dryRun` flag being
honoured — a write attempt would have failed loudly rather than landing in the sheet. Zero
were attempted.

### What the real Product Master turned out to be

201 data rows, 39 columns, **every header recognised, none unknown, none missing**. 200 rows
read cleanly, 200 unique SKUs, no duplicates, and **not one price differs from the shop**.

One row has a problem: **EP04-A01** at row 50 has the text `True` in its `PRODUCT PRIORITY`
cell — a boolean pasted into a number column. The row is refused and reported; its price, name
and status are all fine.

### Two faults the first connection found

Both would have damaged Ibrahim's own spreadsheet, and neither was visible without real data.

**A first sync would have overwritten his columns.** The first-meeting rule was "the database
is the operational truth, so bring the sheet up to it". Against the real sheet that meant
rewriting **105 `WEBSITE STATUS` cells from `Show` to `Hide`** and **14 `PRODUCT PRIORITY`
cells to `0`**.

Neither database value was a decision anybody had made. All 105 of those products are hidden
because the Build 07 importer found no approved photograph — the flag records a missing photo,
not a wish to hide anything. The `0` priorities are a column default for a field never
imported. His `Show` and his 1–6 ordering were the only stated intentions in either pair, and
they would have gone silently. Worse, when photographs arrived the sheet would have read
`Hide` and nothing would have put it back.

The rule is now: **on a first meeting, neither side wins.** Nothing flows either way, the
database's values are recorded as the agreed base, and only the read-only system columns are
written. From the second run on, those 105 `Show` values read as genuine sheet edits — visible
in a dry run, applied deliberately.

**A row that could not be read was also counted as missing from the sheet.** EP04-A01 appeared
under both headings at once. A row with a typo is not an absent row, and the "missing" list
exists precisely so that a person eventually reads it and retires something.

### What a first real sync would now do

| | |
| --- | --- |
| Sheet → Supabase | **0 changes** |
| Supabase → Sheet | 200 rows, **905 cells — every one a system report column** |
| Conflicts | 0 |
| New SKUs in the sheet | 0 |
| Products missing from the sheet | 0 |
| Rows needing attention | 1 |

Plus five header cells appended to the right of the existing 39. **No column of Ibrahim's is
written, moved, renamed or reordered.**

### Stock, EP01-A01, EP23-A02

The dry run proposes **zero** changes to the shop, so stock is protected twice over: no
inventory field appears in any proposed change, and `STOCK QTY` is not among the cells to be
written. The sheet's stock snapshot stays as typed; the shop's real availability appears
beside it in `SYSTEM AVAILABLE STOCK`.

**EP01-A01** — sheet row 2 at TSh 128, shop at TSh 128, off the website for *no approved
photo* and *switched off*. No change proposed. Not corrected, not multiplied.

**EP23-A02** — in neither the sheet nor the shop. Still an approved photograph with no
product. Nothing proposed.

### Also

A dry run now reads as **"Last checked — Checked, nothing changed"** on the admin screen
rather than "Last sync — Finished". The job row already carried the distinction; the screen
was not reading it.

### Verified

`typecheck` · `lint` · `test` (**189**) · `build` · `qa:screenshots` (127, PASS) ·
`test:db` (**213** passed, 3 skipped — the two real-sheet inspections are skipped unless
`INSPECT_REAL_SHEET=1`).

After the pass: 201 products, 95 visible, 95 on the shelf, all `sort_priority` still 0, 204
inventory movements, 2 orders, and `sync_state` / `sync_events` / `sync_conflicts` all empty.
Nothing moved.

## Build 09 continued — the baseline sync, and a stop — 2026-09-10

Ibrahim's two decisions came in: EP04-A01's bad priority cell cleared to blank (meaning *no
decision*, not a number to invent), and **Show** confirmed as *intent* — "publish this when it
satisfies the system's own requirements" — never as proof that a product is publishable.

The sync was run in stages, each one a file under `tools/sync/` that refuses to do anything
without its own flag. They are operations, not tests: `npm run test` and `npm run test:db`
never open the real spreadsheet.

### Step A — the sheet, rechecked

201 data rows, **201 parsed cleanly, 201 unique SKUs**, no duplicates, no malformed rows, and
**not one price differs from the shop**. EP04-A01's blank cell reads as 0 — the database's own
"no decision" — rather than an invented figure.

### Step B — the baseline, written

**910 cells: the five system columns across 201 rows, plus their five headers.** Zero of
Ibrahim's own cells. Afterwards, byte for byte: every inventory row, every price, the public
shelf and the counts of orders, order items and customers were unchanged. 201 agreements
recorded, no conflicts, and all 201 rows of the sheet's system values match the shop exactly.

Two independent guards: the plan was recomputed and checked before the run, and the gateway
was wrapped so a write to any column but the five would throw before reaching Google.

### Step C — the second plan, calculated and not applied

116 products, stable across two calculations, no conflicts, no issues, nothing new or missing:

| Field | Products | |
| --- | --- | --- |
| Show on website | **106** | approved |
| Display order | **14** | **not approved** |
| Description | **1** | **not approved** |

No inventory field, no price, no lifecycle, no SKU, no web address — asserted one by one. All
106 products that would become visible lack a photograph, none is on the shelf, and
`product_shelf` requires a primary image regardless of the flag, so the expected shelf after
applying is **95 — unchanged**.

### Why it stopped there

The instruction was to stop if the second plan held anything materially beyond the approved
website-intent changes. It does: 14 display-order values and 1 description. All three fields
are `Both ways` in the authority matrix and none is destructive — in every case the Sheet is
supplying something the database never had — but 15 changes across two other fields is not
"approximately 105 website-intent changes", so **steps D, E and F have not run.**

### Two faults the first real run found

**Google refuses a write past the edge of the grid.** The tab is exactly 39 columns wide, so
appending five system columns was rejected. A spreadsheet is a fixed grid, not an infinite
plane. `appendHeaders` now widens the tab first, idempotently.

**Worse: the run reported success anyway.** The failed append was caught, noted, and the run
carried on to record an agreement describing a sheet that had never been written. `sync_state`
is the reference point for echo detection, stale writes and conflicts — an agreement against a
version that never existed poisons all three, permanently and invisibly.

A failed header append or cell write now records **no agreement** and reports the run as
failed. The database half stands; the next run does the sheet half again. Two tests cover it.

The agreement that broken run recorded was deleted and its job row corrected from `applied` to
`failed` with an explanation. The record of the run stays — it happened — but it no longer
claims to have succeeded.

Neither fault was visible in any test, because the in-memory sheet grows to fit whatever is
written to it. That was a reasonable fake for everything else and exactly wrong here.
`MemorySheet` gained `failHeadersWith` so the failure can be reproduced deliberately.

### Verified

`typecheck` · `lint` · `test` (**189**) · `build` · `test:db` (**215** passed, 3 skipped).

After the two runs: 201 products, 95 visible, 95 on the shelf, 204 inventory movements, 2
orders, 201 agreements, 0 conflicts. Nothing operational moved.

## Build 09 complete — the sheet and the shop agree — 2026-09-10

Ibrahim's approval was field-specific: apply the website visibility intent and the
display order, hold the one product description for content review. The engine had
no way to do that, so `runCatalogueSync` gained `applyFields` — it narrows what may
flow **before** anything is written and before the agreement is computed, which is
what makes holding a field safe rather than merely hopeful.

### Two counts, and they are not the same

| | |
| --- | --- |
| Products affected | **116** |
| Field-level changes | **121** |

A product can appear under more than one field, which is the whole difference.

| Field | Products | |
| --- | --- | --- |
| Show on website | **106** | applied |
| Display order | **14** | applied |
| Description | **1** | **held** |

### What was proved

**Step D.** Verified as an end state rather than a count of deltas: for all 201
rows, website intent agreeing **201/201**, display order agreeing **201/201**,
nothing disagreeing. **The public shelf stayed at 95** — 106 products now say
*Show* and not one reached a customer, because `product_shelf` still requires an
approved photograph. Inventory, prices, the ledger, orders and customers were
byte-identical.

**Step E.** Two checks, a real run, another check: Sheet → Supabase stayed at
exactly **1** every time — the held description. Blank ≡ no decision, proved on
EP04-A01: blank cell, 0 in the shop, no difference and no write. And the
`SYSTEM LAST SYNCED` timestamp cannot start a cycle, because the system columns
are not in the comparison at all.

**Step F.** A full round trip on display order, on one safe product: sheet → shop,
shop → sheet, then both sides changed to different values → **conflict raised,
neither applied**, row frozen across a further sync. Resolved in the shop's
favour, the decision travelled to the sheet, and both sides were restored exactly.

### Three more faults found by doing it for real

**"Show" was doing two jobs.** It recorded a merchandising wish *and* stood in for
"we have what we need to sell this", because the Build 07 importer set it from the
second meaning. Ibrahim separated them: intent is intent, and publishability is
decided independently. Two tests in `06-catalogue.test.ts` were asserting the old
coincidence and now assert the shelf rule instead — a stronger claim that survives
the flag changing meaning, which is exactly what happened to it.

**PostgREST caps a response at 1000 rows and says nothing.** The agreed-base
loader was one unbounded select ordered oldest-first. With 1993 base rows it read
the OLDEST 1000, so every comparison used a stale base — invisibly, with no error.
It surfaced as a settled conflict refusing to stick. Both state reads are now
paged, the base read is newest-first, and superseded snapshots are pruned: 1792
removed, 201 current ones kept.

**Resolving a conflict recorded nothing.** Deleting `sync_state` left the base in
`sync_events`, so the same disagreement returned on the next run for ever. A
resolution now writes a fresh base — and when the *shop* wins, it records the
sheet's rejected value on purpose, so the database reads as changed and the
decision travels out to the sheet.

Also: the agreement was written two round trips per product, 402 sequential calls
to Mumbai, and the first attempt at Step D was killed by a timeout partway through
— after every product update had already landed. It is batched now, and the run
went from timing out at five minutes to finishing in ninety seconds.

### The one held description

**EP10-A02, Shower Gel Bubblegum.** Currently public, and has **no** description in
Supabase at all — so nothing is displayed anywhere. The sheet's text is preserved
untouched. Two things worth a look before it is approved: the copy calls the
product *Bubbles* while the catalogue calls it *Shower Gel Bubblegum*, and it makes
germ-killing claims that are a regulatory question rather than a stylistic one.

Every run reports it as one outstanding change and applies nothing.

### Verified

`typecheck` · `lint` · `test` (**190**) · `schema:check` · `i18n:check` (267) ·
`catalogue:check` · `db:types:check` · `build` · `qa:screenshots` (**127**, PASS) ·
`test:db` (**215** passed, 3 skipped).

Final state: 201 products, 95 on the public shelf, 201 with visibility intent, 204
inventory movements, 2 orders, 201 agreements, **0 open conflicts**. EP01-A01 still
TSh 128 and off the shelf for want of a photograph; EP23-A02 still not a product.

### Known, and left alone deliberately

`SYSTEM LAST SYNCED` is rewritten for all 201 rows on every run, so a sync that
changes nothing still writes 201 cells. It is correct and harmless — the column
cannot feed the comparison — but it is noise in the sheet's revision history and
work nobody needs. Worth narrowing to rows that actually changed, in a later build.

## Build 10 — operational completeness — 2026-09-10

The build that closes the gaps between "the shop works" and "the shop could open".
Three migrations, four new screens' worth of real data, two new operations in the
database, and the end of `src/mocks/`.

### What was built

**Order amendment before dispatch.** Staff can change what is in an order while it
is still in the shop: quantities up or down, a line removed, another product added.
The screen sends the FULL final list and the database works out the difference —
never a delta, because two people amending from two phones would each compute a
delta from a different starting point and both would apply. `jojo_amend_order` locks
every product either side mentions, in id order, checks each increase against real
availability before anything moves, re-prices the order from the catalogue and
writes the movements to the ledger. Two amendments racing for the last unit: exactly
one wins, and the other is told how many are left. After `out_for_delivery` the
control is gone and the screen says why.

**New products from the Google Sheet.** A row the shop has never seen becomes an
internal draft — `lifecycle = draft`, not visible, an inventory row at zero —
whatever the sheet says about status or stock. Brand, category, family and supplier
must resolve to exactly one existing row after normalising case and punctuation:
zero matches or two matches both refuse the row rather than guess. A duplicate SKU,
a price at or below zero, a price below TSh 1,000 and an offer price that is not
lower are each refused with the shop's own sentence.

**The Website, Settings and Staff screens, all real.** The last three screens
reading invented data now read `shop_settings` and `admin_profiles`. `src/mocks/`
was deleted; `src/` holds only `app`, `components`, `lib`, `views`, `types` and the
middleware.

**The words on the website reach the website.** Announcement, hero, promotion band
and eight section switches, per language, read by the storefront through one cached
function. Every text field is an override: clearing it restores the copy the site
was designed with, in the right language. Turning something off is always a switch,
which is why migration 0022 gives the announcement strip one of its own.

**And the shop's own details reach the shop.** The storefront read
`255700000000` from `src/lib/site.ts` in six places. It now reads
`shop_settings` and falls back to that placeholder only while the value is
unset — so the number Ibrahim types on the Settings screen is the number
customers reach, everywhere, immediately. The old `whatsappLink()` helper was
removed rather than repointed: a helper that silently reads a placeholder looks
correct in review and is wrong in production.

**Owner safety.** The Staff screen draws no controls at all on the last active Owner
or on your own account — the database refuses both regardless, and offering a button
that will be refused is a trap rather than a rule. An Owner is never created by
invitation. No password is ever seen or shown: Supabase sends the invitation and
owns the credential.

**Reservation expiry, configurable and unscheduled.** Two durations in
`shop_settings`, both null, and null means nothing expires. `jojo_expire_reservations`
cancels through the ordinary path so the release is written once. The protected
endpoint exists; nothing calls it.

### Two faults worth recording

**The Owner could not save their own settings.** Migration 0018 wrote the Owner
UPDATE policy on `shop_settings` and granted only SELECT. The grant decides the
verb and the policy decides the row, and a missing grant refuses before any policy
is consulted — so the screen would have failed for the one person allowed to use
it. Fixed in 0021.

**`42804`, again.** `jojo_amend_order` chose its movement kind with a `CASE` over
string literals inside an `INSERT ... SELECT`, which PostgreSQL resolves as `text`
before it meets the enum column. Exactly the trap migration 0017 hit. Fixed by
hoisting the value into a typed variable — written down twice now because it is
genuinely surprising: the same literal in `VALUES` coerces quite happily.

### And one piece of noise, removed

`SYSTEM LAST SYNCED` was written on every row of every run, because its value is
`now` and therefore always differed from the sheet. A sync that changed nothing
rewrote 201 cells, which buried real edits in Google's revision history. It is now
stamped when the shop actually wrote to that row, or when a row has never carried
one. A recheck afterwards reported **0 rows to write back**. The column is a report
column — never read as input, never in a fingerprint, never in a base — so this
cannot disturb the merge, which was the condition attached to touching it at all.

### Where it stands

- Migrations: **21 applied**, types regenerated and checked
- `npm run test`: **203 passing**
- `npm run test:db`: **255 passing**, 3 skipped (the two real-spreadsheet files)
- Real Sheet: **201 data rows, 0 problems, 0 rows to write back**
- The shop after every real-Sheet operation: 201 products, 95 on the shelf, 3 orders,
  208 movements — byte for byte what it was before

### One thing Ibrahim decides

The Settings screen lists what is still missing before the shop can open, computed
from what the database actually holds rather than from a checklist: the WhatsApp
number, phone, email, address, logo, and how long an unconfirmed order may hold
stock. Every one starts empty and says "Not set yet", because a plausible-looking
placeholder phone number is worse than a visibly missing one — the missing one gets
fixed before launch and the plausible one gets discovered by a customer.

## Next

- Confirm the open business rules (delivery fee, served areas, retail prices). A global
  free-delivery spend threshold and a same-day cut-off time are **decided against for V1** —
  free delivery is per area, and delivery timing is confirmed with the order.
- Confirm the `EP01-A01` price and add a master row for `EP23-A02`
- Provide the real Jojo Usafi WhatsApp number, phone, email and logo
- ~~**Build 06:** create a free Supabase development project, apply the migrations for real,
  generate the database types, write and test the Row Level Security policies, set up
  Supabase Auth~~ — **done, 2026-09-09**
- ~~**Ibrahim:** claim the Owner account~~ — **done, 2026-09-09.** Ibrahim Abdul Tayeb is the
  Owner; sign in at `/admin/sign-in`. Further staff are added by the Owner.
- **Ibrahim, tidy-up:** disable the legacy JWT API keys for the development project in the
  Supabase dashboard (*Settings → API Keys → Legacy keys*). Nothing in this repository uses
  them; the reason is under *Build 06 → One thing to be aware of*.
- ~~**Build 07:** import the catalogue, move the photographs into Storage, wire the
  storefront to Supabase~~ — **done, 2026-09-09**
- ~~**Build 08:** reservation engine, quotation, atomic orders~~ — **done, 2026-09-09**
- ~~**Build 08B:** the customer path — checkout, confirmation, Track Order~~ — **done,
  2026-09-09**
- ~~**Build 08C:** live admin operations — real orders, real writes, real stock, QA staff~~ —
  **done, 2026-09-09**
- **Ibrahim, to try it:** run `npm run qa:staff create` in the terminal to get a development
  Manager and Order staff login (the password prints once and is stored nowhere), then sign
  in at `/admin/sign-in` to see what each role can and cannot do. `npm run qa:staff remove`
  deletes them again. Your own Owner account is untouched by any of it.
- ~~**Build 09:** the validated two-way Google Sheet ↔ Supabase catalogue sync~~ — **built and
  tested, 2026-09-09. Not connected.**
- ~~**Ibrahim, to switch the sync on:** the Google service account and spreadsheet~~ — **done,
  2026-09-10.** Connected, read and checked; no sync run yet.
- ~~**Ibrahim, the catalogue sync decision**~~ — **done, 2026-09-10.** Visibility intent and
  display order applied; the EP10-A02 description held for content review.
- ~~**Ibrahim, the EP10-A02 description**~~ — **done, 2026-09-10.** Replacement copy approved
  and written to both sides. It remains the only product in the catalogue with a description.
- ~~**Build 10:** operational completeness — order amendment, new products from the Sheet,
  the Website / Settings / Staff screens on real data, Owner safety, reservation expiry~~ —
  **done, 2026-09-10.**
- **Ibrahim, before the shop opens** — all of it on **More → Settings**, which lists what is
  still missing:
  1. The real **WhatsApp number, phone, email and address**
  2. The **logo** (the screen says where it will go; uploading arrives with the media screen)
  3. **How long an unconfirmed order holds stock** — until this is set, nothing expires and
     stock is released only by cancellation
  4. The real **delivery areas and fees**, replacing the four development placeholders
- **Build 11**, in whatever order Ibrahim wants them:
  1. **Reports** — the last "Coming soon" screen, waiting on real orders to report on
  2. **Media** — uploading and replacing a product photograph, and the logo
  3. A **schedule** for the sync and for reservation expiry, once the deployment
     architecture is settled. Both endpoints already exist and are protected.
  4. **Kiswahili product content** — `product_content` is per-locale; the master has one
     language

Claude must update this file after meaningful milestones.
