# Testing Requirements

## The gate today

Every one of these must pass before a commit:

```bash
npm run typecheck        # TypeScript, no emit
npm run lint             # ESLint
npm run test             # 189 unit tests (vitest) — no database needed
npm run schema:check     # SQL is internally consistent and agrees with the domain layer
npm run i18n:check       # en + sw key, placeholder and array parity
npm run catalogue:check  # committed catalogue still matches imports/
npm run build            # production build
npm run qa:screenshots   # needs a running server (npm run start)
npm run verify:cache     # a price saved in the editor reaches the shop immediately
```

and, since Build 06, the half that needs a real database:

```bash
npm run db:types:check   # the generated types still match the live schema
npm run test:db          # 213 tests against PostgreSQL, Supabase Auth and Storage
```

The two halves are deliberately separate. `npm run test` must keep working on a laptop with
no network, no Docker and no Supabase project — that is what makes the domain layer provable
on its own. `npm run test:db` proves nothing about business rules and everything about
whether PostgreSQL, PostgREST, Supabase Auth and Supabase Storage behave the way those rules
assume. It needs `.env.local` and the CLI linked to the development project.

**Run the two database-touching gates one at a time.** `npm run test:db` and
`npm run qa:screenshots` share the one development project, and running them together fails
both for reasons that are not defects: the QA gate photographs the suite's fixture products
and reports their torn-down images as broken, and the suite reads stock the browser has moved.

`supabase db reset` is never part of the gate: it is not run against a hosted project. The
migration path is `db push --dry-run`, read the plan, then `db push`.

## Domain unit tests

`npm run test` — 189 tests over `src/lib/domain/`, the admin capability matrix and the Google Sheet sync planner, all pure
TypeScript with no I/O:

| Area | Covers |
| --- | --- |
| `sku` | pattern, normalisation, duplicates, length, multi-brand codes |
| `money` | integer shillings, typed input, line totals, order totals, offer prices |
| `phone` | eleven input shapes normalising to one E.164 value; landlines and other countries refused; idempotence |
| `delivery` | zone validation, free-delivery consistency, the TSh 4,000 default |
| `inventory` | available = on_hand − reserved, all eight movement kinds, over-reservation and negative stock refused, ledger replay |
| `orders` | the whole transition table, payment consistency, completion requires payment, totals recomputed rather than trusted |
| `sync` | fingerprint stability, echo detection, stale writes, conflicts, retry backoff, record validation |
| `content` | locale fallback to English, missing-translation reporting |
| `admin/permissions` | the capability matrix both the screens and `authorize()` read: every role works orders; only Owner and Manager touch pricing, stock and visibility; only the Owner manages staff and settings |
| `sheets/plan` | the Google Sheet sync decision, as a pure function: which side may change what, conflicts vs safe field merges, echoes, duplicate and blank SKUs, an unclassified column stopping the run — and that no plan can ever name an inventory field |

They exist because the rules had to be provable before the database was available. Each one
has a CHECK constraint or trigger as its counterpart in `supabase/migrations/`.

## Offline schema check

`npm run schema:check` reads `supabase/migrations/` and asserts, **statically**:

- every statement is closed — balanced quotes, parentheses and `$$` bodies
- no money column is anything but `integer`, and every one is constrained non-negative
- every referenced table, enum and view resolves, and is created before it is used
- Row Level Security is enabled on every table, and no table is missed
- every append-only ledger carries its `jojo_forbid_mutation` trigger
- every view is `security_invoker = on`
- the SQL and the TypeScript agree — enum members, the SKU pattern, the phone pattern, the
  order-number pattern, the default delivery fee
- `src/lib/supabase/database.types.ts` — generated from the real database — lists exactly
  the tables the migrations create

It contacts no database and proves nothing about execution. That is `npm run test:db`, and
`npm run db:types:check` is the other half of the same guard: `schema:check` catches the
migrations disagreeing with the generated types, and `db:types:check` catches the generated
types disagreeing with the live schema.

## Database, Auth, RLS and Storage tests

`npm run test:db` — 213 tests against the hosted development project. Ten files, run in
name order by a custom sequencer, sharing one database with `fileParallelism` off.

| File | Tests | Proves |
| --- | --- | --- |
| `01-schema.test.ts` | 43 | CHECK constraints refuse; the append-only triggers refuse; `updated_at` moves; SKU immutability; `inventory.available` is computed by the database; `product_shelf` and `inventory_ledger_check` mean what they say |
| `02-auth.test.ts` | 20 | the three roles resolve from `admin_profiles`; the Owner seat is taken and cannot be taken again by anyone; a signed-in non-staff account cannot promote itself; the last Owner cannot be demoted, deactivated or deleted; deleting a login leaves the staff record behind |
| `03-rls.test.ts` | 39 | five callers — anonymous, signed-in stranger, Order staff, Manager, Owner — against every policy |
| `04-storage.test.ts` | 10 | bucket configuration; who may upload, replace and delete |
| `05-real-data-untouched.test.ts` | 6 | every real staff and audit row is byte-for-byte what it was before the suite ran |
| `08-order-lifecycle.test.ts` | 15 | the whole journey — place, confirm, prepare, dispatch, complete with payment — asserting that stock leaves only at completion; completion refuses without payment and digital without a reference; illegal transitions refused; both delivery-failure outcomes; every order function closed to the browser |
| `07-commerce.test.ts` | 25 | quoting is the database answer and not the browser one; reservation is atomic; the last unit cannot be sold twice (1-in-stock/2-orders and 3-in-stock/5-orders); a refused order leaves nothing behind; customer matching on phone; cancellation releases once and is idempotent; tracking needs the number AND the phone; the commerce path is closed to the browser |
| `06-catalogue.test.ts` | 14 | the real catalogue as an anonymous shopper receives it: 95 on the shelf, 201 kept, EP01-A01 blocked, EP23-A02 not invented, photographs filed and fetchable, nothing newly readable or writable |
| `10-sheet-sync.test.ts` | 20 | the catalogue sync against the real database and an in-memory spreadsheet: both directions applied, a `STOCK QTY` of 999,999 moving nothing and writing no ledger row, conflicts recorded and not re-raised, a deleted sheet row leaving the product alone, a second run writing nothing, Google being down leaving checkout working, and orders, ledgers and staff rows untouched |
| `09-admin-operations.test.ts` | 24 | the dashboard's operations run as the people who use them: Order staff refused pricing, stock, zones and self-promotion; Manager allowed all four but refused Owner and refused to rewrite what an order sold for; stock moved only through the ledger, with an actor and a reason; the whole staff journey to Completed with cash and with a digital reference; cancellation and both delivery-failure answers; what each screen can read |

### The real spreadsheet is never opened by the gate

`tests/db/11-real-sheet-inspection.test.ts` and `12-real-sheet-detail.test.ts` read Ibrahim's
actual Product Master, and are **skipped unless `INSPECT_REAL_SHEET=1`**. They exist as files
rather than as throwaway commands so the first connection is repeatable and reviewable.

Both wrap the Google gateway in a proxy whose write methods throw, so their safety does not
depend on the `dryRun` flag being honoured: a write attempt fails loudly instead of landing in
the sheet. Run them with:

```bash
INSPECT_REAL_SHEET=1 npx vitest run --config vitest.db.config.ts tests/db/11-real-sheet-inspection.test.ts
```

### Fixtures are scoped to one run

Every run mints a token — eight hex characters — and every fixture identifier carries it:
SKU `ZZ1A2B3C4D-P1`, email `zz1a2b3c4d-owner@jojo-usafi.test`, storage path, customer phone,
analytics session. Teardown is rendered per run from `teardown.sql.tmpl` and deletes exactly
that token, plus the previous run's if it crashed — both tokens this suite minted itself.

**Teardown identifies rows by WHO MADE THEM, never by what they are or what happened.** No
rule matches a role, an action name, a lifecycle or a shared email domain. Build 06 had one
that matched `audit_events` on `action = ...first_owner_claimed` and destroyed Jojo Usafi's
real audit row the first time the real bootstrap ran. There is no pattern left in that file
that a real row could match.

It runs as `postgres` through the CLI, because the four append-only ledgers refuse DELETE
from everyone including the service role. It does **not** disable the last-Owner trigger:
fixture Owners are never the last Owner, so it never fires. A consequence worth stating
plainly: **an order with history cannot be deleted through the API at all**, and **a staff
member named in the audit trail cannot be deleted by anybody** — the delete nulls
`audit_events.actor_admin_id`, which is append-only. History is permanent by design.

**Nothing in the suite touches real data.** The last-Owner guard is exercised in
`last-owner-guard.sql`, a transaction that always rolls back;
`05-real-data-untouched.test.ts` then compares every real row against a snapshot taken
before any fixture existed. The suite also **fails closed**: if there is not exactly one real
active Owner before it starts, nothing runs at all.

**Two kinds of "no" appear, and they are not interchangeable.**

| | Means |
| --- | --- |
| error `42501` | the **grant** refused: wrong verb, wrong column, or the role may not name the table. The request dies before a row is examined. |
| an empty result | the **policy** refused: the role may read the table, and no row in it is theirs. This is what a denied SELECT looks like — and a denied UPDATE, which changes zero rows rather than raising. |

Asserting an error where the answer is an empty result tests nothing.

## Development QA staff — how the dashboard gets looked at

The dashboard is behind the sign-in guard, so visual QA needs a session. It uses a
**development-only** Manager and Order staff account, and never Ibrahim's real Owner:

```bash
npm run qa:staff create   # creates or refreshes them, prints one password, stores none
npm run qa:staff status   # what exists on this machine
npm run qa:staff remove   # deletes exactly what create made
npm run dev:orders        # two development orders, so there is something to work on
```

Four rules hold it safe, and they are the same rules the test fixtures follow:

1. **No password is ever stored.** `create` mints a random one and prints it once.
   `qa:screenshots` mints its own and resets it on the exact recorded auth user id, so the
   gate can sign in without anybody having written a password down.
2. **Cleanup is by exact identity.** Every account is recorded — auth user id and
   `admin_profiles` id — in `.qa-staff.local.json`, which is gitignored. `remove` deletes
   those exact ids. It never searches by role, email domain, name or business state.
3. **It fails closed.** No manifest means `remove` refuses rather than guessing. A recorded
   row whose role has become `owner`, or whose email no longer matches, is left alone and
   reported.
4. **Development project only**, checked before anything is written.

`npm run dev:orders` places its orders through `jojo_place_order` — the same function
checkout calls — so the rows are shaped like real ones, with a real reservation and a real
order number. Both carry a marker in the customer note saying what they are, and the script
does nothing if they already exist.

## Known gaps

- **Track Order has no rate limit.** Guessing a six-digit order number and a nine-digit phone
  together is not a realistic attack, but a determined script should still be slowed down.
  That needs a shared counter, so it belongs with deployment.
- **The Website screen is still a prototype.** `shop_settings` exists; nothing writes it.
  It is the last screen reading `src/mocks/admin/data.ts`, and says so on its face.
- **Reports, Staff and Settings** are marked "Coming soon" and are empty.

## What is still NOT verified

- **an amended order** — changing an order's lines before dispatch is not built.
- **reservation expiry** — `jojo_stale_reservations` exists and is tested; nothing schedules
  it, because the durations are Ibrahim's decision.
- **Google Sheet sync** — the rules are unit-tested; nothing has ever talked to Google.
- **component unit tests** — the screens are covered by the QA gate and by the database
  tests behind them, not by rendering assertions.

## What the QA gate checks

`scripts/qa-screenshots.mjs` walks every key page in **both languages** at **390 / 430 /
768 / 1024 / 1440** and fails on anything a shopper would notice:

- horizontal overflow
- console errors and uncaught page errors
- broken or missing product images
- a product showing another SKU's photograph
- product images with no accessible name
- touch targets under 44px on touch viewports (the hit area accounts for stretched links)
- floating layers overlapping — the WhatsApp button and the mobile cart dock
- the hero down control failing to scroll, or failing to move focus
- the first-visit language chooser failing, or reappearing after a choice
- the EN/SW switcher losing the page, the query string or the cart
- a withheld product (`EP01-A01`) being reachable
- an orphan image (`EP23-A02`) or any unapproved photo reaching the shelf
- a product shelf resolving to the wrong number of columns for its width
  (2 / 2 / 3 / 4 / 5), or rendering a top row that disagrees with that count
- a fixed-length shelf ending in a part-full row
- **locale layout stability** — see below

Screenshots land in `preview/screenshots/`, named `page-locale-width.png` for the storefront
and `page-width.png` for the English-only admin.

### The dashboard pass

Since Build 08C the gate also signs in as the development QA Manager and audits the
dashboard at all five widths: Home, Orders, an order, Products, the Product editor,
Customers, More and Delivery Zones — plus the dialogs, which only exist after a click and
are where a phone-sized dashboard usually goes wrong:

- Add stock and Set counted stock, on the product editor
- Cancel order and Delivery failed, behind "Something went wrong with this order"
- Record the payment, behind Complete order
- the delivery-zone editor

Each is checked for horizontal overflow and 44px touch targets, and photographed. If no QA
staff account exists on the machine the pass is skipped with a note rather than failing:
that is a missing fixture, not a defect in the shop. If a signed-in staff member is bounced
to `/admin/sign-in`, or an order does not open, that **is** a failure — and a dialog whose
opener is not on the screen says so out loud, because a silent skip once let two of the four
order dialogs go unaudited while the run reported success.

It then signs in again as the development **Order staff** account and checks that the
smaller role really does see less: no Delivery zones, Website, Reports, Staff or Settings in
the More menu, no editable price field, and no stock buttons. That is a courtesy check on
what is drawn, not the boundary — the boundary is in the database, and
`tests/db/09-admin-operations.test.ts` proves an Order staff token is refused even when every
check in this repository is bypassed.

`QA_ONLY=admin npm run qa:screenshots` runs only the admin passes — about four minutes
rather than twenty-five, which is what makes re-checking a dialog cheap enough to actually
do.

## Locale layout stability

The stability pass loads the home, Shop All and product pages in **both languages at every
QA width** and compares the boxes of the controls marked `data-qa-anchor` in the markup —
logo, each nav slot, search, the language control, the cart button, the mobile menu and
search buttons, the shop filters and sort menu, and the two hero actions.

It asserts nothing about the translated text itself: "Track Order" and "Fuatilia Agizo" are
allowed to be different widths. What fails the gate is the **slot** around them changing,
because that is what drags unrelated controls across the screen.

- horizontal position and width are compared **everywhere**
- vertical position and height are compared **only inside the header**, which is fixed
  furniture; elsewhere a translated paragraph may honestly take an extra line
- tolerance is 2px, which absorbs sub-pixel rounding and nothing a shopper could see

Adding a persistent control means adding a `data-qa-anchor` to it. Adding a language means
nothing at all: the reserved widths and this comparison both read `locales`.

## Production readiness — still required

- ~~unit tests~~ — done for the domain layer; still needed for components
- ~~integration tests **against a real database**~~ — done, `npm run test:db`
- Playwright user-journey tests (only the QA gate exists today)
- ~~**Supabase Row Level Security policies tested**~~ — done, 39 tests as five callers
- Google Sheet ↔ Supabase synchronization tested end to end. The rules are unit-tested
  (loop, echo, stale write, conflict, retry, duplicate SKU, invalid value); what remains is
  the same handling against a live Sheet and a live database, including partial failures
- order workflow verified end to end
- cart and checkout verified against a real backend
- loading, empty and error states verified
- accessibility audit beyond the automated checks

Mobile QA is mandatory for UI work, in both languages.
