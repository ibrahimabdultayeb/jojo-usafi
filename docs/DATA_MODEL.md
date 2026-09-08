# Data Model

The **Supabase PostgreSQL** schema, authored as version-controlled migrations in
`supabase/migrations/`. Firebase/Firestore is permanently unapproved — see `docs/DECISIONS.md`,
2026-09-08.

> **Status: authored, not yet applied.** No Supabase project exists and no migration has
> been executed against PostgreSQL. Everything below has been verified only by static
> inspection (`npm run schema:check`). Runtime verification is Build 06.

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

**Not built yet:** transactional reserve/release functions. They need real concurrency
testing against a running PostgreSQL. `src/lib/domain/inventory.ts` computes what a
movement *would* do and refuses the impossible; Build 06 makes it atomic.

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

Row Level Security is **enabled on all 30 tables with no policies**, which denies the `anon`
and `authenticated` roles everything. That is the correct state at the end of Build 05:
nothing in the application reads Supabase yet, so a closed door is right and an open table
would be a silent hole.

Build 06 writes and tests the policies:

- public read of `product_shelf` rows only
- customers read and write only their own orders and addresses
- admin access scoped by role — Owner / Manager / Order Staff
- the sync worker writes through a dedicated, audited role

The service-role key bypasses RLS entirely and is read only by `src/lib/supabase/admin.ts`,
which is `server-only`.

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

`src/lib/supabase/types.ts` is a **hand-authored, unverified schema contract**. Build 06
replaces it with `supabase gen types typescript` output from the real development database.
