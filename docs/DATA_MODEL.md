# Data Model

The **Supabase PostgreSQL** schema, authored as version-controlled migrations in
`supabase/migrations/`. Firebase/Firestore is permanently unapproved — see `docs/DECISIONS.md`,
2026-09-08.

> **Status: applied and verified.** All 15 migrations have been executed against the hosted
> development project (*Jojo Usafi Dev*, `dyjhacbbedytcstxxjzl`, free tier). Everything below
> is checked statically by `npm run schema:check` and — since Build 06 — proved at runtime by
> `npm run test:db`, 112 tests against the real database, Supabase Auth and Supabase Storage.
>
> The database holds **no business data**: no products, no customers, no orders, no delivery
> zones. Only the reference rows the migrations themselves insert — 2 locales, 6 pack types,
> 2 option axes — because those are true of every environment.
>
> The one exception is **staff**: since 2026-09-09 there is a single `admin_profiles` row, the
> real Owner, created by the first-Owner bootstrap rather than by a seed. See *Authorization →
> Supabase Auth* below.

## Design rules

1. **Jojo Usafi is the retailer, not EcoPlus.** Nothing in the schema assumes cleaning
   products, EP codes or a single brand. A completely unrelated brand is rows, not a
   migration.
2. **Money is `integer` TZS.** Every amount is a whole number of shillings in a column named
   `*_tzs`, constrained `>= 0`. No `numeric`, no `float`, no `money` type. `schema:check`
   fails the build if one appears.
3. **SKU is the stable identity.** It is never silently rewritten once used on an order — a
   trigger refuses.
4. **History is append-only.** Four ledgers cannot be updated or deleted, by anyone,
   including a service-role client.
5. **Correctness lives in the database.** A CHECK constraint holds every rule that must be
   true regardless of which code path wrote the row.

## Migrations

| File | Contents |
| --- | --- |
| `20260909090000_foundation.sql` | extensions, `jojo_set_updated_at`, `jojo_forbid_mutation`, all 16 enum types |
| `20260909090100_catalogue.sql` | locales, pack types, suppliers, brands, categories, media, families, option axes, products, product media, localized content |
| `20260909090200_inventory.sql` | `inventory` running totals, `inventory_movements` ledger |
| `20260909090300_customers_and_delivery.sql` | customers, addresses, delivery zones |
| `20260909090400_orders.sql` | order numbers, orders, order items, order events, SKU immutability trigger |
| `20260909090500_admin_and_audit.sql` | admin profiles and roles, `audit_events` |
| `20260909090600_sync.sql` | sync jobs, events, state, conflicts; `analytics_events` |
| `20260909090700_views_and_rls.sql` | `product_shelf`, `inventory_ledger_check`, RLS enabled on all 30 tables |
| `20260909130000_auth_foundation.sql` | `auth.users` foreign keys, the role helper functions, the last-Owner guard |
| `20260909130100_rls_policies.sql` | 95 Row Level Security policies |
| `20260909130200_storage.sql` | three media buckets and their policies |
| `20260909130300_owner_bootstrap.sql` | `jojo_owner_exists()`, `jojo_claim_first_owner()` |
| `20260909130400_grants.sql` | which verbs and columns each role holds |
| `20260909130500_function_hardening.sql` | yes/no functions that never return null; `next_order_number()` closed |
| `20260909130600_function_grants_explicit.sql` | EXECUTE taken from `PUBLIC` and granted by name |

`supabase/seed.sql` deliberately inserts **no business data** — see the file for why.

## The 30 tables

**Catalogue** — `locales` · `pack_types` · `suppliers` · `brands` · `categories` ·
`media_assets` · `product_families` · `product_option_axes` · `product_option_values` ·
`product_family_axes` · `products` · `product_option_assignments` · `product_media` ·
`product_content` · `category_content`

**Stock** — `inventory` · `inventory_movements`

**People and places** — `customers` · `customer_addresses` · `delivery_zones`

**Commerce** — `orders` · `order_items` · `order_events`

**Staff and audit** — `admin_profiles` · `audit_events`

**Synchronisation and measurement** — `sync_jobs` · `sync_events` · `sync_state` ·
`sync_conflicts` · `analytics_events`

**Views** — `product_shelf` (the one definition of "a customer may see this") ·
`inventory_ledger_check` (does the running total match the ledger?). Both are
`security_invoker = on`, so they enforce the caller's policies rather than bypassing them.

## The product model

```
product_family          "Multix Multipurpose Detergent Lemon Fresh"
   ├── declares its axes via product_family_axes
   │        size (ordinal)          scent (unordered)
   └── has sellable SKUs
            products: EP01-A02, 5LT, TSh 34,000
```

Size and scent are **rows in `product_option_axes`**, not columns. A future brand whose
products vary by colour, grit or voltage adds rows. A family with no axes has exactly one
SKU, which is legitimate.

Each SKU carries: SKU, EAN/ITF-14 where supplied, family, brand, category, supplier,
display attributes, `price_tzs`, `offer_price_tzs`, lifecycle
(`draft`/`active`/`hidden`/`archived`), `storefront_visible`, `low_stock_threshold`, media
references and merchandising flags.

A product is public only when `lifecycle = 'active'` **and** `storefront_visible` **and** it
has a `primary` image. That is the `product_shelf` view, so no caller can define it
differently.

## Inventory

```
on_hand    physically in the store
reserved   physically present, already promised to an order
available  GENERATED ALWAYS AS (on_hand - reserved) STORED
```

`on_hand >= 0`, `reserved >= 0` and `reserved <= on_hand` are CHECK constraints, so
`available` can never be negative and stock can never be promised twice.

Every change is a movement, and `inventory_movements` is append-only. A movement records
signed deltas on both columns, and a CHECK constraint enforces that each `kind` moves stock
only in the direction its name claims:

| kind | on_hand | reserved |
| --- | --- | --- |
| `receipt` | + | 0 |
| `stock_count` | ± | 0 |
| `correction` | ± | 0 |
| `reservation` | 0 | + |
| `reservation_release` | 0 | − |
| `sale` | − | − |
| `returned_delivery` | + | 0 |
| `damage_loss` | − | 0 |

`correction`, `stock_count` and `damage_loss` additionally require a reason; the four
order-driven kinds require an `order_id`.

**Still not built:** transactional reserve/release functions. Build 06 was scoped to the
database, Auth, Row Level Security and Storage, and these belong with the checkout that
calls them — a reservation is one statement inside the same transaction that writes the
order, so building it before the order-writing path exists would be building it twice.

`src/lib/domain/inventory.ts` computes what a movement *would* do and refuses the impossible;
the CHECK constraints refuse it again. What is still missing is atomicity under concurrency:
two shoppers taking the last jerrycan at the same moment. The database now exists to test
that against, which is the part that was blocking it.

## Orders

An order is a historical record. Customer name, phone, email, zone name, delivery fee and
every line's product name, size, unit price and line total are **snapshotted**. The foreign
keys to `customers`, `delivery_zones` and `products` are all `on delete set null`, so losing
a reference can never destroy the record of what was sold.

Orders are stored **before** WhatsApp is opened. WhatsApp is a communication channel; it is
not the database.

### States

`new` → `awaiting_confirmation` → `confirmed` → `preparing` → `out_for_delivery` →
`completed`, with `cancelled` reachable before dispatch and `delivery_failed` reachable from
`out_for_delivery`.

The transition table lives in `src/lib/domain/orders.ts`, because a sequence needs to know
where the order came from and the current row does not remember that. Staff never see these
names — `STATE_LABEL` is what appears on screen.

### Payment

`payment_preference` (what the customer chose) and `payment_method` / `payment_status` (what
actually happened) are separate fields. Four CHECK constraints:

- unpaid ⇒ no method, no reference, no `paid_at`
- paid ⇒ method **and** `paid_at` present
- paid by `digital` ⇒ `payment_reference` present and non-blank
- `state = 'completed'` ⇒ `payment_status = 'paid'`

### Arithmetic

`total_tzs = subtotal_tzs - discount_tzs + delivery_fee_tzs` and
`line_total_tzs = unit_price_tzs * quantity` are CHECK constraints, not conventions.

## Synchronisation

The Sheet ↔ Supabase loop is survivable because four questions have answers:

| Question | Mechanism |
| --- | --- |
| Already applied? | `idempotency_key`, unique on both `sync_jobs` and `sync_events` |
| Our own write returning? | `sync_state.db_fingerprint` / `sheet_fingerprint` comparison |
| Computed against a stale version? | `base_fingerprint` vs the current fingerprint |
| Both sides changed one field? | a `sync_conflicts` row — never resolved automatically |

`src/lib/domain/sync.ts` implements all four as pure functions with 25 tests. Nothing is
connected to Google in this build.

## Authorization

Two locks, with different jobs:

```
GRANT   decides which VERBS and which COLUMNS a role may ever touch
POLICY  decides which ROWS it then sees or changes
```

Row Level Security is enabled on all 30 tables and there are **95 policies**. Every one is
exercised by `tests/db/03-rls.test.ts` as a real signed-in session.

### Who may do what

| | `anon` | signed in, not staff | Order staff | Manager | Owner |
| --- | --- | --- | --- | --- | --- |
| The shelf, brands, categories, zones | read | read | read | read | read |
| Every product, including hidden ones | — | — | read | read + write | read + write |
| Prices, stock, visibility, website content | — | — | read | write | write |
| Suppliers | — | — | — | read + write | read + write |
| Orders, lines, history | — | own, once accounts exist | read + advance | read + advance | read + advance |
| Order money and customer snapshot | — | — | — | — | — (server only) |
| Customers | — | own | read | read + write | read + write |
| Stock ledger | — | — | read | + the four human movement kinds | same |
| Audit, sync, analytics | insert measurement only | — | — | read | read |
| Staff | — | own profile | own profile | read | read + write |
| DELETE, anywhere | — | — | — | — | — |

`service_role` bypasses RLS entirely and is read only by `src/lib/supabase/admin.ts`, which
is `server-only`.

### The parts that are not policies

- **Column grants.** RLS decides rows, not columns. All three staff roles hold UPDATE on
  `orders`, restricted by grant to `state`, the payment fields, the reason fields, the
  lifecycle timestamps and `staff_note`. `anon` holds SELECT on exactly three columns of
  `inventory` — `product_id`, `location_code`, `available` — and never learns `on_hand`.
- **Table grants.** `anon` cannot name `orders`, `customers`, `suppliers`, `admin_profiles`,
  `audit_events` or the sync tables at all; the request fails before a row is examined.
- **No client writes to orders.** There is no INSERT policy on `orders`, `order_items` or
  `customers` for anybody with a browser token. Checkout is a server action.
- **`analytics_events` is the one exception**, and is an allow-list: a browser may insert
  `page_view`, `product_impression`, `product_view`, `search`, `add_to_cart`,
  `remove_from_cart`, `checkout_started` and `whatsapp_initiated`, with no `customer_id` and
  no `order_id`. It may never read the table back.

### Asking who the caller is

RLS asks the same questions through one set of `SECURITY DEFINER`, `STABLE` functions with a
fixed `search_path`, so "what counts as staff" has exactly one definition — an
`admin_profiles` row, linked to this login, active:

```
jojo_admin_role()        owner | manager | order_staff | null
jojo_admin_id()          the caller's admin_profiles.id
jojo_is_staff()          jojo_is_owner()        jojo_manages_catalogue()
jojo_customer_id()       jojo_owns_order(uuid)
jojo_product_is_public(uuid)   jojo_family_is_public(uuid)   jojo_media_is_public(uuid)
```

The three visibility predicates repeat the `product_shelf` rule for the tables underneath it,
minus the primary-image join — a policy on `product_media` cannot require the image to be
visible already in order to make it visible.

`jojo_is_owner()` and `jojo_manages_catalogue()` return **false, never null**, for a caller
with no staff profile. They were three-valued until `npm run test:db` caught it; a NULL
policy result denies the row correctly, but the dashboard asks these questions directly and
`null` is not `false` in TypeScript either.

### Supabase Auth

`admin_profiles.auth_user_id` and `customers.auth_user_id` are real foreign keys to
`auth.users`, both `on delete set null` — deleting a login must never delete the staff record
the order timeline and the audit trail name as the actor.

Guest checkout stays the default and creates no login, so in practice the only
`authenticated` callers today are staff.

**The first Owner.** Only an Owner may create staff, and a new shop has none.
`jojo_claim_first_owner(text)` gives the Owner seat to the signed-in account if and only if no
active Owner exists — under an advisory lock, writing an `audit_events` row, and raising for
every caller afterwards. `jojo_owner_exists()` is readable before sign-in so the setup screen
can choose which form to show. No password is ever typed into a file or a migration.

EXECUTE on it is granted to `authenticated` and to nobody else — not `anon`, not
`service_role`, not PUBLIC — and the seat goes to `auth.uid()`. It therefore **cannot** be
invoked on somebody's behalf with a privileged key; it happens inside the session of the
account being made Owner, or not at all.

> **Done on this database, 2026-09-09.** Ibrahim Abdul Tayeb (the Owner’s own email address) holds
> the Owner seat, linked by foreign key to a real `auth.users` row, with the claim in
> `audit_events`. `/admin/setup` has disabled itself accordingly.
>
> Neither the screen nor the grant was removed, deliberately: a migration applies to **every**
> environment, and a fresh production project will have no Owner and will need exactly this
> function on its first day. The gate is a question about state, asked where it matters — see
> `docs/DECISIONS.md`, 2026-09-09.

A trigger then refuses to demote, deactivate or delete the last active Owner, including with
the service-role key.

## Storage

| Bucket | Public read | Limit | Types | Written by |
| --- | --- | --- | --- | --- |
| `product-media` | yes | 5 MB | webp, png, jpeg, avif | Owner, Manager |
| `brand-media` | yes | 2 MB | webp, png, svg | Owner, Manager |
| `site-content` | yes | 5 MB | webp, png, jpeg, avif | Owner, Manager |

Deleting is narrower than replacing: **only an Owner** may remove an object, because
`product_media.media_id` is `on delete restrict` and the bytes under a live product page
should be at least as hard to remove as the row pointing at them.

Path convention, which is what makes `media_assets_path_unique` meaningful:

```
product-media/<SKU>/<sku>-<role>-<n>.webp      EP01-A02/ep01-a02-primary-1.webp
brand-media/<brand-slug>/logo.webp
site-content/<slot>/<name>.webp
```

SKU-first, because SKU is the stable identity: renaming a product never moves its
photographs, and an orphaned folder reads immediately as a SKU that no longer exists.

**The buckets are empty.** Build 06 established the architecture and its security; moving
the 95 approved photographs out of `public/products/` is later work.

## Localisation

Interface copy lives in `src/lib/i18n/dictionaries` and exists in both languages — the i18n
parity check enforces it. Catalogue content is different: the Product Master is English-only,
so `product_content` and `category_content` hold a row per locale and the storefront **falls
back to English rather than inventing a translation**.

Adding a language is a row in `locales`.

## TypeScript

`src/lib/domain/` holds the same rules as pure functions with no I/O — 156 unit tests, no
database required. `scripts/schema-check.mjs` compares the two sides (enum members, the SKU
pattern, the phone pattern, the order-number pattern, the default delivery fee, the table
list) and fails if they drift.

`src/lib/supabase/database.types.ts` is **generated from the real database** by
`npm run db:types` and is never hand-edited. `src/lib/supabase/types.ts` holds the friendly
names — `ProductRow`, `OrderRow`, `AdminRoleValue` — as aliases into it, so a name here
cannot describe a column that is not there. `npm run db:types:check` fails if the repository
and the database have drifted apart.

One caveat, found by testing rather than by reading: `supabase gen types` does not mark a
`GENERATED ALWAYS` column as read-only, so `inventory.available` appears in the generated
Insert and Update types and assigning to it compiles. PostgreSQL refuses it at runtime with
`428C9`, and `tests/db/01-schema.test.ts` asserts that it does.
