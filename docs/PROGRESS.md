# Jojo Usafi Progress

## Current stage

Storefront prototype on the **real catalogue**, in **English and Kiswahili**, with real
product photography — and, since Build 06, a **real Supabase database behind it**.

All 15 migrations are applied to a free hosted development project. The constraints fire,
the triggers refuse, Row Level Security holds for each of the three staff roles, Supabase
Auth works and the Storage buckets are secured — all proved by 129 tests against the actual
database rather than asserted in a document.

Jojo Usafi has a real Owner — **Ibrahim Abdul Tayeb** — who signs in at `/admin/sign-in`.
The first-Owner bootstrap is done and has disabled itself.

**The storefront reads Supabase.** 201 products imported from the Product Master, 95 on the
public shelf, 95 photographs served from Supabase Storage, opening stock explained by a
receipt movement per product. The admin's product screens read the real catalogue too, under
the caller's own Row Level Security.

What is still not true: no order has ever been placed, orders and customers in the admin are
still mock, product writing is not enabled, the ten dashboard screens are not yet behind a
sign-in guard, and nothing has talked to Google Sheets. That is Build 08 onward.

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
`qa:screenshots` — 125 screenshots, all 15 locale-stability comparisons stable, no
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
`catalogue:check` · `build` (325 pages) · `qa:screenshots` (125 screenshots, all 15
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

#### 129 tests against the real database

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
(325 pages) · `qa:screenshots` (125 screenshots, all 15 locale-stability comparisons stable,
no overflow, console errors, broken images, small touch targets, floating-layer collisions
or wrong shelf columns).

Against the real database: `db:types:check` · `test:db` (129 tests).

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

## Next

- Confirm the open business rules (delivery fee, free-delivery threshold, served areas,
  retail prices, cut-off time)
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
- **Build 08 candidates**, in the order they unblock each other:
  1. Transactional stock reservation, with real concurrency tests — it belongs with the
     checkout that calls it
  2. Checkout as a server action that prices the cart from the database and writes the order
     **before** WhatsApp opens
  3. Admin writes: product edits, stock counts, order state — with the sign-in guard that
     belongs with them, and cache invalidation on save
  4. The validated two-way Google Sheet ↔ Supabase synchronisation
- Then: the validated two-way Google Sheet ↔ Supabase synchronisation

Claude must update this file after meaningful milestones.
