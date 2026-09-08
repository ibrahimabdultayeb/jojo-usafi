# Testing Requirements

## The gate today

Every one of these must pass before a commit:

```bash
npm run typecheck        # TypeScript, no emit
npm run lint             # ESLint
npm run test             # domain unit tests (vitest) — no database needed
npm run schema:check     # SQL is internally consistent and agrees with the domain layer
npm run i18n:check       # en + sw key, placeholder and array parity
npm run catalogue:check   # committed catalogue still matches imports/
npm run build            # production build
npm run qa:screenshots    # needs a running server (npm run start)
```

`npm run db:*` does not exist and `supabase db reset` is not part of the gate: there is no
local PostgreSQL on this machine — see **What is NOT verified** below.

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
- `src/lib/supabase/types.ts` lists exactly the tables the migrations create

It contacts no database and proves nothing about execution.

## What is NOT verified — Build 06

Docker Desktop cannot start on this laptop (WSL returns `Wsl/CallMsi/E_ACCESSDENIED`) and no
Supabase project exists, so none of the following has happened and none may be claimed:

- **migrations applied** — the SQL has never been executed by PostgreSQL
- **constraints enforced** — every CHECK, unique index and foreign key is unexercised
- **triggers fired** — `updated_at`, append-only protection and SKU immutability are unrun
- **generated column correct** — `inventory.available` has never been computed
- **RLS enforced** — policies do not exist yet, let alone hold
- **Supabase Auth** — no user, staff account or session has ever been created
- **concurrent stock reservation** — no transaction, no concurrency test
- **`src/lib/supabase/types.ts`** — hand-authored, never compared to a real database
- **the three Supabase clients** — written, typechecked, never connected to anything
- **Google Sheet sync** — the rules are tested; nothing has ever talked to Google

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
- integration tests **against a real database**
- Playwright user-journey tests (only the QA gate exists today)
- **Supabase Row Level Security policies tested** — the authorization boundary
- Google Sheet ↔ Supabase synchronization tested end to end. The rules are unit-tested
  (loop, echo, stale write, conflict, retry, duplicate SKU, invalid value); what remains is
  the same handling against a live Sheet and a live database, including partial failures
- order workflow verified end to end
- cart and checkout verified against a real backend
- loading, empty and error states verified
- accessibility audit beyond the automated checks

Mobile QA is mandatory for UI work, in both languages.
