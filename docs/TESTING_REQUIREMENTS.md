# Testing Requirements

## The gate today

Every one of these must pass before a commit:

```bash
npm run typecheck        # TypeScript, no emit
npm run lint             # ESLint
npm run test             # domain unit tests (vitest) — no database needed
npm run schema:check     # SQL is internally consistent and agrees with the domain layer
npm run i18n:check       # en + sw key, placeholder and array parity
npm run catalogue:check  # committed catalogue still matches imports/
npm run build            # production build
npm run qa:screenshots   # needs a running server (npm run start)
```

and, since Build 06, the half that needs a real database:

```bash
npm run db:types:check   # the generated types still match the live schema
npm run test:db          # 109 tests against PostgreSQL, Supabase Auth and Storage
```

The two halves are deliberately separate. `npm run test` must keep working on a laptop with
no network, no Docker and no Supabase project — that is what makes the domain layer provable
on its own. `npm run test:db` proves nothing about business rules and everything about
whether PostgreSQL, PostgREST, Supabase Auth and Supabase Storage behave the way those rules
assume. It needs `.env.local` and the CLI linked to the development project.

`supabase db reset` is never part of the gate: it is not run against a hosted project. The
migration path is `db push --dry-run`, read the plan, then `db push`.

## Domain unit tests

`npm run test` — 156 tests over `src/lib/domain/`, which is pure TypeScript with no I/O:

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

`npm run test:db` — 109 tests against the hosted development project. Four files, run in
name order by a custom sequencer, sharing one database with `fileParallelism` off.

| File | Tests | Proves |
| --- | --- | --- |
| `01-schema.test.ts` | 43 | CHECK constraints refuse; the append-only triggers refuse; `updated_at` moves; SKU immutability; `inventory.available` is computed by the database; `product_shelf` and `inventory_ledger_check` mean what they say |
| `02-auth.test.ts` | 18 | the three roles resolve from `admin_profiles`; the first-Owner bootstrap works once and never again; the last Owner cannot be demoted, deactivated or deleted; deleting a login leaves the staff record behind |
| `03-rls.test.ts` | 38 | four callers — anonymous, signed-in stranger, Order staff, Manager, Owner — against every policy |
| `04-storage.test.ts` | 10 | bucket configuration; who may upload, replace and delete |

Fixtures are fake, marked `ZZTEST` / `zztest` / `aa000000-`, and removed afterwards. Nothing
invented ever persists: no prices, customers or orders that could put unreal figures on the
dashboard's revenue tiles.

Two things about the suite are worth knowing before changing it.

**Teardown runs as `postgres`, through the CLI, not through the API.** `order_events`,
`inventory_movements`, `audit_events` and `analytics_events` carry `jojo_forbid_mutation`,
which refuses DELETE from everyone including the service role — so `tests/db/teardown.sql`
disables those triggers around itself. A consequence worth stating plainly: **an order with
history cannot be deleted through the API at all**, because the cascade to `order_events`
hits the append-only trigger. History is permanent by design.

**Two kinds of "no" appear, and they are not interchangeable.**

| | Means |
| --- | --- |
| error `42501` | the **grant** refused: wrong verb, wrong column, or the role may not name the table. The request dies before a row is examined. |
| an empty result | the **policy** refused: the role may read the table, and no row in it is theirs. This is what a denied SELECT looks like — and a denied UPDATE, which changes zero rows rather than raising. |

Asserting an error where the answer is an empty result tests nothing.

## What is still NOT verified

- **concurrent stock reservation** — the transactional reserve/release functions are not
  built. They belong with the checkout that calls them; see `docs/DATA_MODEL.md`.
- **the storefront and admin against Supabase** — the three clients are written,
  typechecked and now pointed at a real project, but no page reads the database yet. The
  storefront still reads the committed catalogue artifact.
- **the catalogue in the database** — 95 products exist as a build artifact, not as rows.
- **product photography in Storage** — the buckets and their policies are proved; they are
  empty.
- **the order workflow end to end** — no order has been placed through the application.
- **Google Sheet sync** — the rules are unit-tested; nothing has ever talked to Google.
- **the real Owner account** — the bootstrap is built and tested with fixture logins. No
  real staff account exists.

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

120 screenshots land in `preview/screenshots/`, named `page-locale-width.png` for the
storefront and `page-width.png` for the English-only admin.

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
- ~~**Supabase Row Level Security policies tested**~~ — done, 38 tests as five callers
- Google Sheet ↔ Supabase synchronization tested end to end. The rules are unit-tested
  (loop, echo, stale write, conflict, retry, duplicate SKU, invalid value); what remains is
  the same handling against a live Sheet and a live database, including partial failures
- order workflow verified end to end
- cart and checkout verified against a real backend
- loading, empty and error states verified
- accessibility audit beyond the automated checks

Mobile QA is mandatory for UI work, in both languages.
